"""Business logic for course resources."""

import os
import uuid
import logging

import boto3
from botocore.config import Config
from fastapi import UploadFile
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.resource import Resource
from app.models.course import Lesson

logger = logging.getLogger(__name__)

MAX_RESOURCE_SIZE = 50 * 1024 * 1024  # 50 MB


def _get_s3_client():
    if settings.B2_KEY_ID and settings.B2_KEY_ID != "mock":
        return boto3.client(
            "s3",
            endpoint_url=settings.B2_ENDPOINT,
            aws_access_key_id=settings.B2_KEY_ID,
            aws_secret_access_key=settings.B2_APP_KEY,
            region_name=settings.B2_REGION,
            config=Config(signature_version="s3v4"),
        )
    return None


class ResourceService:

    @staticmethod
    async def upload_file(
        db: AsyncSession,
        course_id: uuid.UUID,
        file: UploadFile,
        title: str,
        title_bn: str | None = None,
        module_id: uuid.UUID | None = None,
        lesson_id: uuid.UUID | None = None,
        is_downloadable: bool = True,
        sort_order: int = 0,
    ) -> Resource:
        contents = await file.read()
        if len(contents) > MAX_RESOURCE_SIZE:
            raise ValueError("File too large (max 50 MB)")

        ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
        file_id = uuid.uuid4().hex
        key = f"courses/{course_id}/resources/{file_id}.{ext}"

        s3 = _get_s3_client()
        if s3:
            s3.put_object(
                Bucket=settings.B2_BUCKET_NAME,
                Key=key,
                Body=contents,
                ContentType=file.content_type or "application/octet-stream",
            )
        else:
            static_dir = os.getenv("STATIC_DIR", "static")
            local_dir = f"{static_dir}/uploads/courses/{course_id}/resources"
            os.makedirs(local_dir, exist_ok=True)
            with open(f"{local_dir}/{file_id}.{ext}", "wb") as f:
                f.write(contents)

        resource = Resource(
            course_id=course_id,
            module_id=module_id,
            lesson_id=lesson_id,
            title=title,
            title_bn=title_bn,
            resource_type="file",
            file_key=key,
            file_name=file.filename,
            file_size=len(contents),
            mime_type=file.content_type,
            is_downloadable=is_downloadable,
            sort_order=sort_order,
        )
        db.add(resource)
        await db.flush()
        return resource

    @staticmethod
    async def create_link(
        db: AsyncSession,
        course_id: uuid.UUID,
        title: str,
        external_url: str,
        title_bn: str | None = None,
        module_id: uuid.UUID | None = None,
        lesson_id: uuid.UUID | None = None,
        sort_order: int = 0,
    ) -> Resource:
        resource = Resource(
            course_id=course_id,
            module_id=module_id,
            lesson_id=lesson_id,
            title=title,
            title_bn=title_bn,
            resource_type="link",
            external_url=external_url,
            is_downloadable=False,
            sort_order=sort_order,
        )
        db.add(resource)
        await db.flush()
        return resource

    @staticmethod
    async def list_for_course(
        db: AsyncSession,
        course_id: uuid.UUID,
        level: str | None = None,
    ) -> list[Resource]:
        stmt = select(Resource).where(Resource.course_id == course_id)
        if level == "course":
            stmt = stmt.where(Resource.module_id.is_(None), Resource.lesson_id.is_(None))
        elif level == "module":
            stmt = stmt.where(Resource.module_id.isnot(None), Resource.lesson_id.is_(None))
        elif level == "lesson":
            stmt = stmt.where(Resource.lesson_id.isnot(None))
        stmt = stmt.order_by(Resource.sort_order)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def list_for_lesson(
        db: AsyncSession,
        course_id: uuid.UUID,
        lesson_id: uuid.UUID,
    ) -> list[Resource]:
        """Get aggregated resources: lesson-level + module-level + course-level."""
        # First get the lesson's module_id
        lesson_result = await db.execute(
            select(Lesson.module_id).where(Lesson.id == lesson_id)
        )
        module_id = lesson_result.scalar_one_or_none()

        conditions = [
            # Course-level: only course_id set
            and_(Resource.course_id == course_id, Resource.module_id.is_(None), Resource.lesson_id.is_(None)),
            # Lesson-level: exact lesson
            and_(Resource.course_id == course_id, Resource.lesson_id == lesson_id),
        ]
        if module_id:
            # Module-level: module matches, no lesson
            conditions.append(
                and_(Resource.course_id == course_id, Resource.module_id == module_id, Resource.lesson_id.is_(None))
            )

        stmt = select(Resource).where(or_(*conditions)).order_by(Resource.sort_order)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, resource_id: uuid.UUID) -> Resource | None:
        result = await db.execute(select(Resource).where(Resource.id == resource_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def update(db: AsyncSession, resource: Resource, data: dict) -> Resource:
        for key, value in data.items():
            if value is not None:
                setattr(resource, key, value)
        await db.flush()
        return resource

    @staticmethod
    async def delete(db: AsyncSession, resource: Resource) -> None:
        # Delete file from storage if it's a file resource
        if resource.resource_type == "file" and resource.file_key:
            try:
                s3 = _get_s3_client()
                if s3:
                    s3.delete_object(Bucket=settings.B2_BUCKET_NAME, Key=resource.file_key)
                else:
                    static_dir = os.getenv("STATIC_DIR", "static")
                    local_path = f"{static_dir}/uploads/{resource.file_key}"
                    if os.path.exists(local_path):
                        os.remove(local_path)
            except Exception as e:
                logger.warning(f"Failed to delete resource file {resource.file_key}: {e}")
        await db.delete(resource)
        await db.flush()

    @staticmethod
    def get_file_contents(resource: Resource) -> tuple[bytes, str]:
        """Read file bytes and content type. Raises ValueError if not found."""
        s3 = _get_s3_client()
        if s3:
            response = s3.get_object(Bucket=settings.B2_BUCKET_NAME, Key=resource.file_key)
            return response["Body"].read(), response["ContentType"]
        else:
            static_dir = os.getenv("STATIC_DIR", "static")
            local_path = f"{static_dir}/uploads/{resource.file_key}"
            if not os.path.exists(local_path):
                raise ValueError("File not found")
            with open(local_path, "rb") as f:
                return f.read(), resource.mime_type or "application/octet-stream"
