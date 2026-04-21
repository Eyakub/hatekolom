# Course Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dynamic Resources system allowing admins to attach files and links at course/module/lesson level, with student-facing download and in-browser preview.

**Architecture:** Single `Resource` SQLAlchemy model with polymorphic level (nullable `module_id`/`lesson_id` FKs). Dedicated API router at `/resources`. File storage reuses existing Backblaze B2 / local upload pattern from `uploads.py`. Frontend adds a Resources section to the admin course editor and replaces the placeholder Resources tab in the learn page.

**Tech Stack:** FastAPI, SQLAlchemy (async), PostgreSQL, Alembic, Pydantic v2, Next.js 13+, TypeScript, TailwindCSS

---

## File Structure

### Backend — New Files
- `backend/app/models/resource.py` — Resource SQLAlchemy model
- `backend/app/schemas/resource.py` — Pydantic request/response schemas
- `backend/app/services/resource_service.py` — Business logic (upload, query, delete)
- `backend/app/api/v1/resources.py` — API router (8 endpoints)
- `backend/alembic/versions/k1l2m3n4o5p6_add_resources.py` — Migration

### Backend — Modified Files
- `backend/app/models/__init__.py` — Re-export Resource model
- `backend/app/models/enums.py` — Add ResourceType enum
- `backend/app/main.py` — Register resources router

### Frontend — New Files
- `frontend/src/components/course/ResourceList.tsx` — Student resource list + preview modal
- `frontend/src/components/admin/ResourceManager.tsx` — Admin CRUD section

### Frontend — Modified Files
- `frontend/src/app/learn/[courseId]/page.tsx` — Wire up Resources tab
- `frontend/src/app/admin/courses/[id]/page.tsx` — Add ResourceManager section

---

## Task 1: Add ResourceType Enum

**Files:**
- Modify: `backend/app/models/enums.py:86-91`

- [ ] **Step 1: Add ResourceType enum**

Add this after the `SubmissionStatus` enum at the end of the file:

```python
class ResourceType(str, enum.Enum):
    FILE = "file"
    LINK = "link"
```

- [ ] **Step 2: Export from models/__init__.py**

In `backend/app/models/__init__.py`, update the enums import line (line 10-15) from:

```python
from app.models.enums import (  # noqa: F401
    RoleType, ProductType, CourseType, LessonType,
    OrderStatus, PaymentStatus, PaymentMethod,
    EntitlementType, ShipmentStatus, ShippingZone,
    SubmissionStatus,
)
```

to:

```python
from app.models.enums import (  # noqa: F401
    RoleType, ProductType, CourseType, LessonType,
    OrderStatus, PaymentStatus, PaymentMethod,
    EntitlementType, ShipmentStatus, ShippingZone,
    SubmissionStatus, ResourceType,
)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/enums.py backend/app/models/__init__.py
git commit -m "feat(resources): add ResourceType enum"
```

---

## Task 2: Create Resource Model

**Files:**
- Create: `backend/app/models/resource.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the Resource model**

Create `backend/app/models/resource.py`:

```python
"""Course Resource model — files and links attached at course/module/lesson level."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Integer, BigInteger,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import ResourceType


class Resource(Base):
    __tablename__ = "resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=True)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=True)

    title = Column(String(255), nullable=False)
    title_bn = Column(String(255), nullable=True)
    resource_type = Column(String(30), nullable=False, default=ResourceType.FILE.value)

    # File fields (populated when resource_type = 'file')
    file_key = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)

    # Link field (populated when resource_type = 'link')
    external_url = Column(String(1000), nullable=True)

    is_downloadable = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    course = relationship("Course", lazy="noload")
    module = relationship("Module", lazy="noload")
    lesson = relationship("Lesson", lazy="noload")
```

- [ ] **Step 2: Export Resource from models/__init__.py**

In `backend/app/models/__init__.py`, add after the `Course` block (after line 33):

```python
# Resources
from app.models.resource import Resource  # noqa: F401
```

- [ ] **Step 3: Verify model loads**

```bash
cd backend && python -c "from app.models import Resource; print('Resource model OK:', Resource.__tablename__)"
```

Expected: `Resource model OK: resources`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/resource.py backend/app/models/__init__.py
git commit -m "feat(resources): add Resource SQLAlchemy model"
```

---

## Task 3: Create Alembic Migration

**Files:**
- Create: `backend/alembic/versions/k1l2m3n4o5p6_add_resources.py`

- [ ] **Step 1: Generate migration**

```bash
cd backend && alembic revision --autogenerate -m "add_resources"
```

- [ ] **Step 2: Verify the generated migration**

Read the generated file and confirm it creates a `resources` table with all columns:
- `id` (UUID, PK)
- `course_id` (UUID, FK → courses.id, NOT NULL)
- `module_id` (UUID, FK → modules.id, nullable)
- `lesson_id` (UUID, FK → lessons.id, nullable)
- `title`, `title_bn`, `resource_type`, `file_key`, `file_name`, `file_size`, `mime_type`, `external_url`
- `is_downloadable`, `sort_order`, `created_at`, `updated_at`

- [ ] **Step 3: Run the migration**

```bash
cd backend && alembic upgrade head
```

Expected: no errors, `resources` table created.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat(resources): add resources table migration"
```

---

## Task 4: Create Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/resource.py`

- [ ] **Step 1: Create the schemas file**

Create `backend/app/schemas/resource.py`:

```python
"""Pydantic schemas for Resource CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ResourceCreateLink(BaseModel):
    """JSON body for creating an external-link resource."""
    title: str = Field(..., min_length=1, max_length=255)
    title_bn: Optional[str] = Field(None, max_length=255)
    module_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    external_url: str = Field(..., min_length=1, max_length=1000)
    sort_order: int = 0


class ResourceUpdate(BaseModel):
    """PATCH body — all fields optional."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    title_bn: Optional[str] = Field(None, max_length=255)
    module_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    is_downloadable: Optional[bool] = None
    sort_order: Optional[int] = None


class ResourceResponse(BaseModel):
    """Public response — never exposes file_key."""
    id: uuid.UUID
    course_id: uuid.UUID
    module_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    title: str
    title_bn: Optional[str] = None
    resource_type: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    external_url: Optional[str] = None
    is_downloadable: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Verify schemas load**

```bash
cd backend && python -c "from app.schemas.resource import ResourceResponse, ResourceCreateLink, ResourceUpdate; print('Schemas OK')"
```

Expected: `Schemas OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/resource.py
git commit -m "feat(resources): add Pydantic request/response schemas"
```

---

## Task 5: Create Resource Service

**Files:**
- Create: `backend/app/services/resource_service.py`

- [ ] **Step 1: Create the service**

Create `backend/app/services/resource_service.py`:

```python
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
```

- [ ] **Step 2: Verify service loads**

```bash
cd backend && python -c "from app.services.resource_service import ResourceService; print('Service OK')"
```

Expected: `Service OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/resource_service.py
git commit -m "feat(resources): add ResourceService with upload, CRUD, and file streaming"
```

---

## Task 6: Create API Router

**Files:**
- Create: `backend/app/api/v1/resources.py`
- Modify: `backend/app/main.py:162-187`

- [ ] **Step 1: Create the router**

Create `backend/app/api/v1/resources.py`:

```python
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
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add the import after line 163 (the `homepage_content_router` import):

```python
    from app.api.v1.resources import router as resources_router
```

And add the include after line 187 (the `homepage_content_router` include):

```python
    app.include_router(resources_router, prefix=settings.API_V1_PREFIX)
```

- [ ] **Step 3: Verify server starts**

```bash
cd backend && python -c "from app.main import app; print('App OK, routes:', len(app.routes))"
```

Expected: no import errors, route count printed.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/resources.py backend/app/main.py
git commit -m "feat(resources): add API router with 8 endpoints and register in app"
```

---

## Task 7: Frontend — ResourceList Component (Student)

**Files:**
- Create: `frontend/src/components/course/ResourceList.tsx`

- [ ] **Step 1: Create the ResourceList component**

Create `frontend/src/components/course/ResourceList.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Download, Eye, ExternalLink, FileText, Image, Archive, Link2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface Resource {
  id: string;
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  title_bn: string | null;
  resource_type: "file" | "link";
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_url: string | null;
  is_downloadable: boolean;
  sort_order: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string | null, resourceType: string) {
  if (resourceType === "link") return <Link2 className="w-5 h-5 text-purple-600" />;
  if (!mime) return <FileText className="w-5 h-5 text-gray-500" />;
  if (mime === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (mime.startsWith("image/")) return <Image className="w-5 h-5 text-blue-500" />;
  if (mime.includes("zip") || mime.includes("archive")) return <Archive className="w-5 h-5 text-amber-500" />;
  return <FileText className="w-5 h-5 text-gray-500" />;
}

function getFileLabel(mime: string | null, resourceType: string, fileSize: number | null): string {
  if (resourceType === "link") return "External Link";
  const size = fileSize ? ` • ${formatFileSize(fileSize)}` : "";
  if (!mime) return `File${size}`;
  if (mime === "application/pdf") return `PDF${size}`;
  if (mime.startsWith("image/")) return `Image${size}`;
  if (mime.includes("zip")) return `Archive${size}`;
  return `File${size}`;
}

function isPreviewable(mime: string | null): boolean {
  if (!mime) return false;
  return mime === "application/pdf" || mime.startsWith("image/");
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export function ResourceList({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { accessToken } = useAuthStore();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);

  useEffect(() => {
    if (!accessToken || !lessonId) return;
    setLoading(true);
    api.get<Resource[]>(`/resources/courses/${courseId}/lesson/${lessonId}`, accessToken)
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, [courseId, lessonId, accessToken]);

  const handleDownload = (resource: Resource) => {
    if (!accessToken) return;
    const url = `${API_BASE}/resources/${resource.id}/download`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", resource.file_name || "download");
    // Add auth header via fetch and blob
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      });
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400 text-sm font-bn">লোড হচ্ছে...</div>;
  }

  if (resources.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm font-bn">এই লেসনে কোনো রিসোর্স নেই</div>;
  }

  return (
    <>
      <div className="space-y-3">
        {resources.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
          >
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0">
              {getFileIcon(r.mime_type, r.resource_type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-800 truncate">
                {r.title_bn || r.title}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {getFileLabel(r.mime_type, r.resource_type, r.file_size)}
              </div>
            </div>
            <div className="flex-shrink-0">
              {r.resource_type === "link" && r.external_url && (
                <a
                  href={r.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition font-bn"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> ওপেন
                </a>
              )}
              {r.resource_type === "file" && r.is_downloadable && (
                <button
                  onClick={() => handleDownload(r)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition font-bn"
                >
                  <Download className="w-3.5 h-3.5" /> ডাউনলোড
                </button>
              )}
              {r.resource_type === "file" && !r.is_downloadable && isPreviewable(r.mime_type) && (
                <button
                  onClick={() => setPreviewResource(r)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition font-bn"
                >
                  <Eye className="w-3.5 h-3.5" /> প্রিভিউ
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewResource && (
        <PreviewModal
          resource={previewResource}
          accessToken={accessToken}
          onClose={() => setPreviewResource(null)}
        />
      )}
    </>
  );
}
```

After the `ResourceList` function closing brace, add the `PreviewModal` component in the same file:

```tsx
function PreviewModal({
  resource, accessToken, onClose,
}: {
  resource: Resource; accessToken: string | null; onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_BASE}/resources/${resource.id}/preview`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => res.blob())
      .then((blob) => setBlobUrl(URL.createObjectURL(blob)));

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [resource.id, accessToken]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="font-bold text-sm text-gray-800 truncate">
            {resource.file_name}
          </span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-900 flex items-center justify-center">
          {!blobUrl ? (
            <div className="text-gray-400 text-sm font-bn">লোড হচ্ছে...</div>
          ) : resource.mime_type === "application/pdf" ? (
            <iframe
              src={`${blobUrl}#toolbar=0`}
              className="w-full h-full min-h-[70vh]"
              title={resource.file_name || "PDF Preview"}
            />
          ) : (
            <img
              src={blobUrl}
              alt={resource.title}
              className="max-w-full max-h-[80vh] object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/course/ResourceList.tsx
git commit -m "feat(resources): add student ResourceList component with preview modal"
```

---

## Task 8: Frontend — Wire Resources Tab in Learn Page

**Files:**
- Modify: `frontend/src/app/learn/[courseId]/page.tsx:525-538`

- [ ] **Step 1: Add import**

At the top of the file (after the existing component imports around line 12), add:

```tsx
import { ResourceList } from "@/components/course/ResourceList";
```

- [ ] **Step 2: Add tab state**

Inside the `LearnContent` component, after the existing state declarations (around line 63), add:

```tsx
const [activeTab, setActiveTab] = useState<"overview" | "resources">("overview");
```

- [ ] **Step 3: Replace the placeholder tabs**

Replace the tab buttons (lines 528-538, the `<div className="flex gap-6">` block) with:

```tsx
                    <div className="flex gap-6">
                      <button
                        onClick={() => setActiveTab("overview")}
                        className={`font-bold font-bn pb-4 -mb-[17px] ${activeTab === "overview" ? "text-primary-700 border-b-2 border-primary-700" : "text-gray-400 hover:text-gray-700"}`}
                      >
                        লেসন ওভারভিউ
                      </button>
                      <button
                        onClick={() => setActiveTab("resources")}
                        className={`font-bold font-bn pb-4 -mb-[17px] ${activeTab === "resources" ? "text-primary-700 border-b-2 border-primary-700" : "text-gray-400 hover:text-gray-700"}`}
                      >
                        রিসোর্স
                      </button>
                    </div>
```

- [ ] **Step 4: Wrap existing content and add resources tab content**

Find the lesson content area that comes after the tabs bar closing `</div>` (the content that starts with the rich text / assignment section). Wrap that existing content in a conditional and add the resources tab. The existing content block (starting roughly after the tab bar and before the sidebar) should become:

```tsx
                  {activeTab === "overview" && (
                    <>
                      {/* existing lesson overview content — keep exactly as-is */}
                    </>
                  )}

                  {activeTab === "resources" && activeLesson && (
                    <div className="mt-4">
                      <ResourceList courseId={courseId} lessonId={activeLesson.id} />
                    </div>
                  )}
```

- [ ] **Step 5: Reset tab when lesson changes**

In the lesson selection handler (where `setActiveLesson` is called), add `setActiveTab("overview")` right after to reset to overview when switching lessons.

- [ ] **Step 6: Verify the learn page loads**

Start the frontend dev server and navigate to a learn page. Verify:
- Two tabs appear: "লেসন ওভারভিউ" and "রিসোর্স"
- Clicking "রিসোর্স" shows the empty state message
- Clicking back to "লেসন ওভারভিউ" shows the original lesson content
- Tab active state styling works correctly

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/learn/[courseId]/page.tsx
git commit -m "feat(resources): wire up Resources tab in learn page"
```

---

## Task 9: Frontend — ResourceManager Component (Admin)

**Files:**
- Create: `frontend/src/components/admin/ResourceManager.tsx`

- [ ] **Step 1: Create the ResourceManager component**

Create `frontend/src/components/admin/ResourceManager.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Upload, Link2, Trash2, Edit3, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface Resource {
  id: string;
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  title_bn: string | null;
  resource_type: "file" | "link";
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_url: string | null;
  is_downloadable: boolean;
  sort_order: number;
}

interface ModuleItem {
  id: string;
  title: string;
  title_bn: string | null;
  lessons: { id: string; title: string; title_bn: string | null }[];
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getLevelLabel(r: Resource, modules: ModuleItem[]): { text: string; color: string } {
  if (r.lesson_id) {
    for (const m of modules) {
      const lesson = m.lessons.find((l) => l.id === r.lesson_id);
      if (lesson) return { text: `Lesson: ${lesson.title_bn || lesson.title}`, color: "bg-amber-100 text-amber-700" };
    }
    return { text: "Lesson", color: "bg-amber-100 text-amber-700" };
  }
  if (r.module_id) {
    const mod = modules.find((m) => m.id === r.module_id);
    return { text: `Module: ${mod?.title_bn || mod?.title || ""}`, color: "bg-purple-100 text-purple-700" };
  }
  return { text: "Course Level", color: "bg-blue-100 text-blue-700" };
}

interface Props {
  courseId: string;
  modules: ModuleItem[];
}

export function ResourceManager({ courseId, modules }: Props) {
  const { accessToken } = useAuthStore();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const loadResources = () => {
    if (!accessToken) return;
    const levelParam = filter !== "all" ? `?level=${filter}` : "";
    api.get<Resource[]>(`/resources/courses/${courseId}${levelParam}`, accessToken)
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadResources();
  }, [courseId, accessToken, filter]);

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm("Delete this resource?")) return;
    await api.delete(`/resources/${id}`, accessToken);
    loadResources();
  };

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="font-bold text-gray-800">Resources</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition"
          >
            <Upload className="w-3.5 h-3.5" /> Upload File
          </button>
          <button
            onClick={() => setShowLinkModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition"
          >
            <Link2 className="w-3.5 h-3.5" /> Add Link
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: "all", label: "All" },
          { key: "course", label: "Course" },
          { key: "module", label: "Module" },
          { key: "lesson", label: "Lesson" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2.5 text-xs font-semibold transition ${
              filter === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Resource list */}
      <div className="p-4 space-y-2">
        {loading && <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>}
        {!loading && resources.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">No resources yet</div>
        )}
        {resources.map((r) => {
          const level = getLevelLabel(r, modules);
          return (
            <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-800">{r.title}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${level.color}`}>
                    {level.text}
                  </span>
                  {r.resource_type === "file" && (
                    <>
                      <span className="text-[10px] text-gray-400">{formatSize(r.file_size)}</span>
                      <span className={`text-[10px] font-bold ${r.is_downloadable ? "text-green-500" : "text-red-400"}`}>
                        {r.is_downloadable ? "✓ Downloadable" : "🔒 Preview Only"}
                      </span>
                    </>
                  )}
                  {r.resource_type === "link" && (
                    <span className="text-[10px] text-blue-400">External Link</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(r.id)}
                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Upload File Modal */}
      {showUploadModal && (
        <UploadModal
          courseId={courseId}
          modules={modules}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => { setShowUploadModal(false); loadResources(); }}
        />
      )}

      {/* Add Link Modal */}
      {showLinkModal && (
        <LinkModal
          courseId={courseId}
          modules={modules}
          onClose={() => setShowLinkModal(false)}
          onSuccess={() => { setShowLinkModal(false); loadResources(); }}
        />
      )}
    </div>
  );
}


function UploadModal({
  courseId, modules, onClose, onSuccess,
}: {
  courseId: string; modules: ModuleItem[]; onClose: () => void; onSuccess: () => void;
}) {
  const { accessToken } = useAuthStore();
  const [title, setTitle] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDownloadable, setIsDownloadable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedModule = modules.find((m) => m.id === moduleId);

  const handleSubmit = async () => {
    if (!accessToken || !file || !title) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append("title", title);
    if (titleBn) formData.append("title_bn", titleBn);
    if (moduleId) formData.append("module_id", moduleId);
    if (lessonId) formData.append("lesson_id", lessonId);
    formData.append("is_downloadable", String(isDownloadable));
    formData.append("sort_order", "0");
    formData.append("file", file);

    try {
      await api.postFormData(`/resources/courses/${courseId}/upload`, formData, accessToken);
      onSuccess();
    } catch {
      alert("Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Upload File</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Title (English)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Course Syllabus" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Title (Bengali)</label>
            <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-bn" placeholder="e.g. কোর্স সিলেবাস" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Attach To</label>
            <div className="flex gap-2 mt-1">
              <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">Course Level</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title_bn || m.title}</option>)}
              </select>
              {moduleId && selectedModule && (
                <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="">— No lesson —</option>
                  {selectedModule.lessons.map((l) => <option key={l.id} value={l.id}>{l.title_bn || l.title}</option>)}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">File</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full mt-1 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDownloadable} onChange={(e) => setIsDownloadable(e.target.checked)} />
            Allow download
          </label>
          <button
            onClick={handleSubmit}
            disabled={!title || !file || submitting}
            className="w-full py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition disabled:opacity-50 text-sm"
          >
            {submitting ? "Uploading..." : "Upload Resource"}
          </button>
        </div>
      </div>
    </div>
  );
}


function LinkModal({
  courseId, modules, onClose, onSuccess,
}: {
  courseId: string; modules: ModuleItem[]; onClose: () => void; onSuccess: () => void;
}) {
  const { accessToken } = useAuthStore();
  const [title, setTitle] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedModule = modules.find((m) => m.id === moduleId);

  const handleSubmit = async () => {
    if (!accessToken || !title || !url) return;
    setSubmitting(true);
    try {
      await api.post(`/resources/courses/${courseId}/link`, {
        title, title_bn: titleBn || null,
        module_id: moduleId || null, lesson_id: lessonId || null,
        external_url: url, sort_order: 0,
      }, accessToken);
      onSuccess();
    } catch {
      alert("Failed to add link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Add External Link</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Title (English)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Official Docs" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Title (Bengali)</label>
            <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-bn" placeholder="e.g. অফিসিয়াল ডকুমেন্টেশন" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Attach To</label>
            <div className="flex gap-2 mt-1">
              <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">Course Level</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title_bn || m.title}</option>)}
              </select>
              {moduleId && selectedModule && (
                <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="">— No lesson —</option>
                  {selectedModule.lessons.map((l) => <option key={l.id} value={l.id}>{l.title_bn || l.title}</option>)}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="https://..." />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            External links always open in a new tab.
          </div>
          <button
            onClick={handleSubmit}
            disabled={!title || !url || submitting}
            className="w-full py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition disabled:opacity-50 text-sm"
          >
            {submitting ? "Adding..." : "Add Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/admin/ResourceManager.tsx
git commit -m "feat(resources): add admin ResourceManager component with upload and link modals"
```

---

## Task 10: Frontend — Add ResourceManager to Admin Course Editor

**Files:**
- Modify: `frontend/src/app/admin/courses/[id]/page.tsx`

- [ ] **Step 1: Add import**

At the top of the file, add the import:

```tsx
import { ResourceManager } from "@/components/admin/ResourceManager";
```

- [ ] **Step 2: Add ResourceManager section**

Find the end of the modules/lessons section in the admin page (after the last module's closing `</div>` and before any existing modals). Add the ResourceManager component:

```tsx
{/* Resources Section */}
{course && (
  <div className="mt-8">
    <ResourceManager
      courseId={courseId as string}
      modules={(course.modules || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        title_bn: m.title_bn,
        lessons: (m.lessons || []).map((l: any) => ({
          id: l.id,
          title: l.title,
          title_bn: l.title_bn,
        })),
      }))}
    />
  </div>
)}
```

- [ ] **Step 3: Verify admin page loads**

Start the frontend dev server and navigate to an admin course editor page. Verify:
- The Resources section appears below the modules
- "Upload File" and "Add Link" buttons are visible
- Empty state shows "No resources yet"
- Upload modal opens with cascading dropdowns
- Link modal opens with URL field

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/courses/[id]/page.tsx
git commit -m "feat(resources): add ResourceManager section to admin course editor"
```

---

## Task 11: End-to-End Verification

- [ ] **Step 1: Start backend**

```bash
cd backend && uvicorn app.main:app --reload --port 8001
```

Verify no startup errors. Check `http://localhost:8001/docs` — confirm all 8 resource endpoints appear under the "Resources" tag.

- [ ] **Step 2: Test admin upload flow**

1. Navigate to admin course editor for an existing course
2. Click "Upload File" → fill title, select "Course Level", choose a PDF file, keep download checked
3. Submit — resource appears in the list with "Course Level" badge
4. Click "Add Link" → fill title, paste a URL, select a module
5. Submit — link resource appears with "Module: ..." badge

- [ ] **Step 3: Test student view**

1. Navigate to a learn page for an enrolled student
2. Click the "রিসোর্স" tab
3. Verify resources appear (course-level ones should show on any lesson)
4. Click "ডাউনলোড" on the PDF — file downloads
5. Upload a preview-only image resource via admin, verify "প্রিভিউ" button appears
6. Click preview — modal opens showing the image

- [ ] **Step 4: Test delete**

1. In admin, delete a resource
2. Verify it disappears from admin list
3. Verify it disappears from student view

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(resources): address issues found during end-to-end testing"
```
