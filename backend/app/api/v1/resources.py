"""Resource endpoints — admin CRUD + student download/preview."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from app.schemas.resource import ResourceCreateLink, ResourceUpdate, ResourceResponse
from app.services.resource_service import ResourceService

router = APIRouter(prefix="/resources", tags=["Resources"])


# ── Admin endpoints ──────────────────────────────────────────────

@router.post("/courses/{course_id}/upload", response_model=ResourceResponse, status_code=201)
async def upload_resource(
    course_id: uuid.UUID,
    title: str = Form(...),
    file: UploadFile = File(...),
    title_bn: str | None = Form(None),
    module_id: uuid.UUID | None = Form(None),
    lesson_id: uuid.UUID | None = Form(None),
    is_downloadable: bool = Form(True),
    sort_order: int = Form(0),
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file resource."""
    try:
        resource = await ResourceService.upload_file(
            db, course_id, file, title,
            title_bn=title_bn, module_id=module_id, lesson_id=lesson_id,
            is_downloadable=is_downloadable, sort_order=sort_order,
        )
        await db.commit()
        await db.refresh(resource)
        return ResourceResponse.model_validate(resource)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/courses/{course_id}/link", response_model=ResourceResponse, status_code=201)
async def create_link_resource(
    course_id: uuid.UUID,
    data: ResourceCreateLink,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Add an external link resource."""
    resource = await ResourceService.create_link(
        db, course_id, data.title, data.external_url,
        title_bn=data.title_bn, module_id=data.module_id, lesson_id=data.lesson_id,
        sort_order=data.sort_order,
    )
    await db.commit()
    await db.refresh(resource)
    return ResourceResponse.model_validate(resource)


@router.get("/courses/{course_id}", response_model=list[ResourceResponse])
async def list_course_resources(
    course_id: uuid.UUID,
    level: str | None = None,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all resources for a course, optionally filtered by level."""
    resources = await ResourceService.list_for_course(db, course_id, level=level)
    return [ResourceResponse.model_validate(r) for r in resources]


@router.patch("/{resource_id}", response_model=ResourceResponse)
async def update_resource(
    resource_id: uuid.UUID,
    data: ResourceUpdate,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update resource metadata."""
    resource = await ResourceService.get_by_id(db, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    updated = await ResourceService.update(db, resource, data.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(updated)
    return ResourceResponse.model_validate(updated)


@router.delete("/{resource_id}", status_code=204)
async def delete_resource(
    resource_id: uuid.UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Delete resource and its file from storage."""
    resource = await ResourceService.get_by_id(db, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    await ResourceService.delete(db, resource)
    await db.commit()


# ── Student endpoints ────────────────────────────────────────────

@router.get("/courses/{course_id}/lesson/{lesson_id}", response_model=list[ResourceResponse])
async def list_lesson_resources(
    course_id: uuid.UUID,
    lesson_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student: get aggregated resources for a lesson (lesson + module + course level)."""
    resources = await ResourceService.list_for_lesson(db, course_id, lesson_id)
    return [ResourceResponse.model_validate(r) for r in resources]


@router.get("/{resource_id}/download")
async def download_resource(
    resource_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a resource file."""
    resource = await ResourceService.get_by_id(db, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource.resource_type != "file":
        raise HTTPException(status_code=400, detail="Only file resources can be downloaded")
    if not resource.is_downloadable:
        raise HTTPException(status_code=403, detail="This resource is not available for download")

    try:
        contents, content_type = ResourceService.get_file_contents(resource)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found in storage")

    return Response(
        content=contents,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{resource.file_name}"'},
    )


@router.get("/{resource_id}/preview")
async def preview_resource(
    resource_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a resource file for in-browser preview (PDF and images only)."""
    resource = await ResourceService.get_by_id(db, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource.resource_type != "file":
        raise HTTPException(status_code=400, detail="Only file resources can be previewed")

    mime = resource.mime_type or ""
    if not (mime.startswith("image/") or mime == "application/pdf"):
        raise HTTPException(status_code=400, detail="Preview only supported for PDF and image files")

    try:
        contents, content_type = ResourceService.get_file_contents(resource)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found in storage")

    return Response(
        content=contents,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{resource.file_name}"'},
    )
