"""Generic file upload endpoint — uploads to Backblaze B2."""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
import boto3
from botocore.config import Config

from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.models import User
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["Uploads"])


def get_s3_client():
    if settings.B2_KEY_ID and settings.B2_KEY_ID != "mock":
        return boto3.client(
            "s3",
            endpoint_url=settings.B2_ENDPOINT,
            aws_access_key_id=settings.B2_KEY_ID,
            aws_secret_access_key=settings.B2_APP_KEY,
            region_name=settings.B2_REGION,
            config=Config(signature_version='s3v4'),
        )
    return None


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = {"application/pdf"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5 MB
MAX_DOC_SIZE = 100 * 1024 * 1024   # 100 MB


@router.post("/image")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    folder: str = Form("images"),
    user: User = Depends(get_current_user),
):
    """Upload an image (thumbnails, avatars, etc). Returns the public URL."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid image type: {file.content_type}. Allowed: jpg, png, webp, gif")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    base_url = str(request.base_url).rstrip("/")
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"

    try:
        s3 = get_s3_client()
        if s3:
            s3.put_object(
                Bucket=settings.B2_BUCKET_NAME,
                Key=key,
                Body=contents,
                ContentType=file.content_type,
            )
            # Route through backend proxy to bypass Private Bucket 401s
            url = f"{base_url}{settings.API_V1_PREFIX}/uploads/b2/{key}"
        else:
            # Mock mode — save locally
            import os
            static_dir = os.getenv("STATIC_DIR", "static")
            local_dir = f"{static_dir}/uploads/{folder}"
            os.makedirs(local_dir, exist_ok=True)
            local_path = f"{local_dir}/{uuid.uuid4().hex}.{ext}"
            with open(local_path, "wb") as f:
                f.write(contents)
            
            url = f"{base_url}/static/uploads/{folder}/{os.path.basename(local_path)}"
    except Exception as e:
        logger.error(f"Image upload exception: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Upload Error: {str(e)} | Endpoint: {settings.B2_ENDPOINT}")

    return {"url": url, "key": key, "size": len(contents)}

@router.get("/b2/{key:path}")
def proxy_b2_image(key: str):
    """Proxy image fetch for private B2 buckets."""
    s3 = get_s3_client()
    if not s3:
        raise HTTPException(status_code=400, detail="B2 storage not configured")
    
    try:
        response = s3.get_object(Bucket=settings.B2_BUCKET_NAME, Key=key)
        
        def iterfile():
            for chunk in response['Body'].iter_chunks(chunk_size=1024 * 64):
                yield chunk
                
        return StreamingResponse(
            iterfile(),
            media_type=response['ContentType'],
            headers={
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        )
    except Exception as e:
        logger.error(f"B2 proxy error: {str(e)}")
        raise HTTPException(status_code=404, detail="Image not found")


@router.post("/ebook-file")
async def upload_ebook_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload a PDF file for an ebook. Returns the B2 key."""
    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"Only PDF files are allowed. Got: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 100MB)")

    ext = "pdf"
    file_id = uuid.uuid4().hex
    key = f"ebooks/{file_id}.{ext}"

    s3 = get_s3_client()
    try:
        if s3:
            s3.put_object(
                Bucket=settings.B2_BUCKET_NAME,
                Key=key,
                Body=contents,
                ContentType="application/pdf",
            )
        else:
            # Local mode — save with same name as key
            import os
            static_dir = os.getenv("STATIC_DIR", "static")
            local_dir = f"{static_dir}/uploads/ebooks"
            os.makedirs(local_dir, exist_ok=True)
            local_path = f"{local_dir}/{file_id}.{ext}"
            with open(local_path, "wb") as f:
                f.write(contents)
    except Exception as e:
        logger.error(f"Ebook upload exception: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Upload Error: {str(e)} | Endpoint: {settings.B2_ENDPOINT}")

    return {"b2_key": key, "filename": file.filename, "size": len(contents)}
