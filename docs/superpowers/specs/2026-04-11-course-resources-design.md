# Course Resources Feature — Design Spec

## Overview

Add a dynamic **Resources** system to the LMS that allows admins to attach downloadable files and external links to courses at three levels (course, module, lesson). Students see aggregated resources in the learn page's Resources tab with download and in-browser preview support.

## Scope

**In scope:**
- Resource model with three-level attachment (course / module / lesson)
- File uploads (any type) and external links
- Download toggle (`is_downloadable`) with in-browser preview for PDF and images
- Admin CRUD in the course editor
- Student-facing Resources tab in the learn page
- Preview modal (PDF via iframe, images via img tag)
- Bilingual support (English + Bengali)

**Out of scope:**
- Notes tab (covered by existing lesson `content` field and `SMART_NOTE` lesson type)
- Student-created personal notes
- Preview for non-native formats (Word, Excel, PowerPoint)
- Resource analytics/tracking

## Data Model

### Resource Table

Single table with implicit level determined by which FK fields are populated.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default gen | Primary key |
| course_id | UUID | FK → Course, NOT NULL | Always set — the course this belongs to |
| module_id | UUID | FK → Module, nullable | Set for module-level and lesson-level resources |
| lesson_id | UUID | FK → Lesson, nullable | Set only for lesson-level resources |
| title | String(255) | NOT NULL | Display title (English) |
| title_bn | String(255) | nullable | Display title (Bengali) |
| resource_type | Enum(file, link) | NOT NULL | Whether this is an uploaded file or external link |
| file_key | String(500) | nullable | Storage path (Backblaze/local). Required when resource_type=file |
| file_name | String(255) | nullable | Original uploaded filename. Required when resource_type=file |
| file_size | BigInteger | nullable | File size in bytes |
| mime_type | String(100) | nullable | MIME type (e.g. application/pdf, image/png) |
| external_url | String(1000) | nullable | URL for external links. Required when resource_type=link |
| is_downloadable | Boolean | NOT NULL, default true | When false, PDF/images show preview only; other types show info only |
| sort_order | Integer | NOT NULL, default 0 | Display ordering within the same level |
| created_at | DateTime | NOT NULL, default now | Timestamp |
| updated_at | DateTime | NOT NULL, auto-update | Timestamp |

### Level Logic

| Level | course_id | module_id | lesson_id | Visible on |
|-------|-----------|-----------|-----------|------------|
| Course | set | null | null | All lessons in the course |
| Module | set | set | null | All lessons in that module |
| Lesson | set | set | set | Only that specific lesson |

### Relationships

- `Course.resources` — one-to-many, cascade delete
- `Module.resources` — one-to-many, cascade delete (nullable FK)
- `Lesson.resources` — one-to-many, cascade delete (nullable FK)

### File Storage

- Path pattern: `courses/{course_id}/resources/{uuid}_{filename}`
- Backblaze B2 in production, local filesystem in development
- Uses existing upload infrastructure in the platform

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Admin Endpoints (require COURSE_EDIT permission)

#### POST /courses/{course_id}/resources/upload
Upload a file resource.

**Request:** `multipart/form-data`
- `title` (string, required)
- `title_bn` (string, optional)
- `module_id` (UUID, optional)
- `lesson_id` (UUID, optional)
- `is_downloadable` (bool, default true)
- `sort_order` (int, default 0)
- `file` (UploadFile, required)

**Response:** 201, ResourceResponse

#### POST /courses/{course_id}/resources/link
Add an external link resource.

**Request:** JSON body
- `title` (string, required)
- `title_bn` (string, optional)
- `module_id` (UUID, optional)
- `lesson_id` (UUID, optional)
- `external_url` (string, required)
- `sort_order` (int, default 0)

**Response:** 201, ResourceResponse

#### GET /courses/{course_id}/resources
List all resources for a course (admin view, all levels).

**Query params:**
- `level` (optional): filter by "course", "module", or "lesson"

**Response:** 200, list of ResourceResponse

#### PATCH /courses/resources/{resource_id}
Update resource metadata (title, is_downloadable, sort_order, module_id, lesson_id).

**Response:** 200, ResourceResponse

#### DELETE /courses/resources/{resource_id}
Delete resource and remove file from storage.

**Response:** 204

### Student Endpoints (require enrollment)

#### GET /courses/{course_id}/resources/lesson/{lesson_id}
Get aggregated resources for a specific lesson. Returns resources where:
- `lesson_id` matches the given lesson, OR
- `module_id` matches the lesson's parent module AND `lesson_id` is null, OR
- only `course_id` matches AND both `module_id` and `lesson_id` are null

Sorted by `sort_order` within each level group.

**Response:** 200, list of ResourceResponse (without file_key, for security)

#### GET /courses/resources/{resource_id}/download
Download a resource file. Checks:
1. User is enrolled in the course
2. `is_downloadable` is true
3. `resource_type` is file

**Response:** Streamed file with `Content-Disposition: attachment`

#### GET /courses/resources/{resource_id}/preview
Stream a resource file for in-browser preview. Checks:
1. User is enrolled in the course
2. `resource_type` is file
3. `mime_type` is PDF or image

**Response:** Streamed file with `Content-Type` matching the file's MIME type (inline disposition)

## Pydantic Schemas

### ResourceCreateFile (multipart form)
- title: str
- title_bn: str | None
- module_id: UUID | None
- lesson_id: UUID | None
- is_downloadable: bool = True
- sort_order: int = 0

### ResourceCreateLink (JSON)
- title: str
- title_bn: str | None
- module_id: UUID | None
- lesson_id: UUID | None
- external_url: HttpUrl
- sort_order: int = 0

### ResourceUpdate
- title: str | None
- title_bn: str | None
- module_id: UUID | None
- lesson_id: UUID | None
- is_downloadable: bool | None
- sort_order: int | None

### ResourceResponse
- id: UUID
- course_id: UUID
- module_id: UUID | None
- lesson_id: UUID | None
- title: str
- title_bn: str | None
- resource_type: str (file | link)
- file_name: str | None
- file_size: int | None
- mime_type: str | None
- external_url: str | None
- is_downloadable: bool
- sort_order: int
- created_at: datetime
- updated_at: datetime

Note: `file_key` is never exposed in the response — files are accessed only through the download/preview endpoints.

## Frontend

### Admin: Course Editor — Resources Section

Added as a new section in the existing course editor page (`/admin/courses/[id]/page.tsx`).

**Layout:**
- Header with "Resources" title and two action buttons: "Upload File" and "Add Link"
- Filter tabs: All | Course Level | Module Level | Lesson Level
- Resource list with color-coded level badges (blue=course, purple=module, amber=lesson)
- Each item shows: file type icon, title, level badge, size/type info, download status, Edit/Delete buttons

**Upload File Modal:**
- Title (en) and Title (bn) inputs
- "Attach To" cascading dropdowns: first select module (or "Course Level"), then optionally select a lesson
- File drop zone (any file type)
- "Allow download" checkbox (default checked)
- Submit button

**Add Link Modal:**
- Title (en) and Title (bn) inputs
- "Attach To" cascading dropdowns (same as file)
- URL input
- Info note: "External links always open in a new tab"
- Submit button

### Student: Learn Page — Resources Tab

Replaces the current placeholder tab in `/learn/[courseId]/page.tsx`.

**Layout:**
- List of resources with file-type icons (color-coded: red=PDF, blue=IMG, amber=ZIP, purple=link)
- Each item shows: icon, title, type/size info, action button
- Action button depends on resource type:
  - **Downloadable file** → blue "Download" button, triggers direct download
  - **Preview-only file (PDF/image)** → outlined "Preview" button, opens preview modal
  - **Preview-only file (other types)** → no action button, info display only
  - **External link** → purple "Open" button, opens new tab
- Empty state message when no resources exist for the current lesson

**Preview Modal:**
- Full-screen overlay with dark backdrop
- Header: file name + close button
- Body:
  - PDF: `<iframe>` pointing to the `/preview` endpoint, browser's native PDF viewer
  - Image: `<img>` tag pointing to the `/preview` endpoint, centered on dark background
- Footer: file metadata (page count for PDF, dimensions for images)

### Interaction Rules

| Resource State | Action Button | Click Behavior |
|---------------|--------------|----------------|
| File, downloadable, PDF/image | "Download" | Direct download. Also show small preview icon |
| File, downloadable, other type | "Download" | Direct download |
| File, preview-only, PDF/image | "Preview" | Open preview modal |
| File, preview-only, other type | (none) | Display info only |
| External link | "Open" | Open URL in new tab |

## Error Handling

- **Upload fails:** Show toast error, no partial resource created
- **File too large:** Backend validates max file size (configurable, suggest 50MB default)
- **Invalid level:** If lesson_id is provided, module_id must also be provided and must be the lesson's actual parent module — backend validates this
- **Preview unsupported type:** Return 400 if mime_type is not PDF or image
- **Not enrolled:** Return 403 for student endpoints
- **Resource not found:** Return 404

## Testing

- Backend: Unit tests for resource CRUD service, API endpoint tests for all 7 routes, permission/enrollment checks
- Frontend: Manual testing of upload flow, resource list, download, preview modal, empty states
