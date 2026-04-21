# Dynamic Homepage Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage "Voices", "Success/Stats", "Gallery", and "Activities" sections fully dynamic — controlled by super admin via a new "Homepage" tab in the admin panel.

**Architecture:** Four new database tables (`homepage_testimonials`, `homepage_stats`, `homepage_gallery`, `homepage_activities`) with a single public API endpoint that returns all homepage content. Admin manages each section via sub-tabs. The frontend components fetch data from the API and fall back to empty states.

**Tech Stack:** FastAPI + SQLAlchemy (async) + PostgreSQL, Next.js 16 + Tailwind + Zustand, Alembic migrations, B2/local file upload for images/videos.

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/homepage.py` | 4 models: HomepageTestimonial, HomepageStat, HomepageGallery, HomepageActivity |
| `backend/app/schemas/homepage.py` | Pydantic schemas for CRUD on all 4 models |
| `backend/app/api/v1/homepage_content.py` | Public GET + Admin CRUD endpoints |
| `backend/alembic/versions/i9j0k1l2m3n4_add_homepage_content_tables.py` | Migration for all 4 tables |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Export 4 new models |
| `backend/app/schemas/__init__.py` | Export new schemas |
| `backend/app/main.py` | Register `homepage_content` router |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/components/home/SuccessAndJoyHub.tsx` | Fetch from API instead of hardcoded arrays |
| `frontend/src/components/home/PlatformAchievements.tsx` | Fetch stats + gallery images from API |
| `frontend/src/components/admin/AdminLayout.tsx` | Add "হোমপেজ" tab to sidebar |
| `frontend/src/app/admin/page.tsx` | Add "homepage" tab with 4 sub-tabs (Voices, Stats, Gallery, Activities) |

---

## Task 1: Backend Models

**Files:**
- Create: `backend/app/models/homepage.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the 4 homepage content models**

```python
# backend/app/models/homepage.py
"""Homepage dynamic content models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class HomepageTestimonial(Base):
    """Voices/testimonials section — parent reviews with photo + video."""
    __tablename__ = "homepage_testimonials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    photo_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True)          # uploaded file URL or external link
    video_type = Column(String(20), default="upload")        # "upload", "youtube", "vimeo"
    quote = Column(Text, nullable=False)
    quote_bn = Column(Text, nullable=True)
    author_name = Column(String(255), nullable=False)
    author_role = Column(String(255), nullable=True)         # e.g. "অভিভাবক"
    author_role_bn = Column(String(255), nullable=True)
    gradient_color = Column(String(50), default="from-primary-700")  # tailwind gradient class
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class HomepageStat(Base):
    """Achievement stats section — numbers with auto/manual toggle."""
    __tablename__ = "homepage_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label = Column(String(100), nullable=False)              # e.g. "Courses"
    label_bn = Column(String(100), nullable=True)            # e.g. "কোর্সসমূহ"
    value = Column(String(50), nullable=False)               # e.g. "৩০+"
    value_en = Column(String(50), nullable=True)             # e.g. "30+"
    auto_calculate = Column(Boolean, default=False)          # if True, override with real DB count
    auto_source = Column(String(50), nullable=True)          # "courses", "users", "enrollments", "instructors"
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class HomepageGallery(Base):
    """Success gallery — student work / success photos."""
    __tablename__ = "homepage_gallery"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_url = Column(String(500), nullable=False)
    title = Column(String(255), nullable=True)
    title_bn = Column(String(255), nullable=True)
    label = Column(String(255), nullable=True)               # e.g. "Art Class · Level 8"
    label_bn = Column(String(255), nullable=True)
    column_group = Column(Integer, default=1)                # 1 or 2, for the two scrolling columns in PlatformAchievements
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class HomepageActivity(Base):
    """Activities section — promotional cards."""
    __tablename__ = "homepage_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    title_bn = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    description_bn = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    icon_name = Column(String(50), default="Palette")        # lucide icon name
    border_color = Column(String(50), default="border-primary-500")
    time_label = Column(String(50), nullable=True)           # e.g. "15-20 Min"
    xp_label = Column(String(50), nullable=True)             # e.g. "500 XP"
    cta_text = Column(String(100), nullable=True)            # e.g. "Start Painting"
    cta_text_bn = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Register models in `__init__.py`**

Add after the existing `SiteSettings` import (line 68) in `backend/app/models/__init__.py`:

```python
# Homepage Content
from app.models.homepage import (  # noqa: F401
    HomepageTestimonial, HomepageStat, HomepageGallery, HomepageActivity,
)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/homepage.py backend/app/models/__init__.py
git commit -m "feat: add 4 homepage content models (testimonials, stats, gallery, activities)"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/i9j0k1l2m3n4_add_homepage_content_tables.py`

- [ ] **Step 1: Create migration file**

```python
# backend/alembic/versions/i9j0k1l2m3n4_add_homepage_content_tables.py
"""add homepage content tables

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-04-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'homepage_testimonials',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('photo_url', sa.String(500), nullable=True),
        sa.Column('video_url', sa.String(500), nullable=True),
        sa.Column('video_type', sa.String(20), server_default='upload'),
        sa.Column('quote', sa.Text(), nullable=False),
        sa.Column('quote_bn', sa.Text(), nullable=True),
        sa.Column('author_name', sa.String(255), nullable=False),
        sa.Column('author_role', sa.String(255), nullable=True),
        sa.Column('author_role_bn', sa.String(255), nullable=True),
        sa.Column('gradient_color', sa.String(50), server_default='from-primary-700'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'homepage_stats',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('label_bn', sa.String(100), nullable=True),
        sa.Column('value', sa.String(50), nullable=False),
        sa.Column('value_en', sa.String(50), nullable=True),
        sa.Column('auto_calculate', sa.Boolean(), server_default='false'),
        sa.Column('auto_source', sa.String(50), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'homepage_gallery',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('image_url', sa.String(500), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('title_bn', sa.String(255), nullable=True),
        sa.Column('label', sa.String(255), nullable=True),
        sa.Column('label_bn', sa.String(255), nullable=True),
        sa.Column('column_group', sa.Integer(), server_default='1'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'homepage_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('title_bn', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('description_bn', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('icon_name', sa.String(50), server_default='Palette'),
        sa.Column('border_color', sa.String(50), server_default='border-primary-500'),
        sa.Column('time_label', sa.String(50), nullable=True),
        sa.Column('xp_label', sa.String(50), nullable=True),
        sa.Column('cta_text', sa.String(100), nullable=True),
        sa.Column('cta_text_bn', sa.String(100), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('homepage_activities')
    op.drop_table('homepage_gallery')
    op.drop_table('homepage_stats')
    op.drop_table('homepage_testimonials')
```

- [ ] **Step 2: Run migration**

```bash
alembic upgrade head
```

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/i9j0k1l2m3n4_add_homepage_content_tables.py
git commit -m "feat: migration for homepage content tables"
```

---

## Task 3: Backend Schemas

**Files:**
- Create: `backend/app/schemas/homepage.py`
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Create schemas**

Full Pydantic v2 schemas for all 4 models — create/update requests + responses. Each needs `model_config = {"from_attributes": True}` on responses.

Key schemas:
- `TestimonialCreateRequest`: quote, quote_bn, author_name, author_role/bn, photo_url, video_url, video_type, gradient_color, sort_order
- `TestimonialResponse`: all fields + id, is_active, created_at
- `StatCreateRequest`: label, label_bn, value, value_en, auto_calculate, auto_source, sort_order
- `StatResponse`: all fields + id + `computed_value` (filled by API when auto_calculate=True)
- `GalleryCreateRequest`: image_url, title/bn, label/bn, column_group, sort_order
- `GalleryResponse`: all fields + id
- `ActivityCreateRequest`: title/bn, description/bn, image_url, icon_name, border_color, time_label, xp_label, cta_text/bn, sort_order
- `ActivityResponse`: all fields + id
- `HomepageContentResponse`: aggregated response with `testimonials`, `stats`, `gallery`, `activities` lists

- [ ] **Step 2: Register in `__init__.py`**

- [ ] **Step 3: Commit**

---

## Task 4: Backend API Router

**Files:**
- Create: `backend/app/api/v1/homepage_content.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the router**

Key endpoints:

**Public:**
- `GET /homepage-content/` — Returns all active content (testimonials, stats, gallery, activities) sorted by sort_order. For stats with `auto_calculate=True`, compute from DB:
  - `auto_source="courses"` → count active Products with type COURSE
  - `auto_source="users"` → count active Users
  - `auto_source="enrollments"` → count Enrollments
  - `auto_source="instructors"` → count Instructors

**Admin (requires super_admin role):**
- `POST /homepage-content/testimonials/` — Create testimonial
- `PATCH /homepage-content/testimonials/{id}` — Update testimonial
- `DELETE /homepage-content/testimonials/{id}` — Delete testimonial
- Same CRUD pattern for `/stats/`, `/gallery/`, `/activities/`

**Auth:** Use `require_roles("super_admin", "admin")` for all admin endpoints.

- [ ] **Step 2: Register router in `main.py`**

Add after the physical_items_router:
```python
from app.api.v1.homepage_content import router as homepage_content_router
app.include_router(homepage_content_router, prefix=settings.API_V1_PREFIX)
```

- [ ] **Step 3: Commit**

---

## Task 5: Admin Dashboard — Homepage Tab

**Files:**
- Modify: `frontend/src/components/admin/AdminLayout.tsx` — Add "হোমপেজ" to sidebar tabs
- Modify: `frontend/src/app/admin/page.tsx` — Add "homepage" tab with 4 sub-tabs

- [ ] **Step 1: Add to AdminLayout sidebar**

In `AdminLayout.tsx`, add to the `tabs` array:
```typescript
{ id: "homepage", label: "হোমপেজ", icon: LayoutDashboard },
```

- [ ] **Step 2: Add tab type and data loading in admin page**

Update `Tab` type to include `"homepage"`. Add state for:
- `homepageSubTab: "voices" | "stats" | "gallery" | "activities"`
- `homepageData: { testimonials, stats, gallery, activities }`
- Form states for each sub-section

Load data via `GET /homepage-content/` when `activeTab === "homepage"`.

- [ ] **Step 3: Build the 4 sub-tab UIs**

**Voices sub-tab:**
- Table/card list of testimonials with photo thumbnail, author, quote preview
- Add/Edit modal: photo upload, video upload OR URL input (toggle between upload/youtube/vimeo), quote (bn+en), author name + role, gradient color picker, sort order
- Delete with confirmation
- Toggle is_active

**Stats sub-tab:**
- Card list of stats (value + label)
- Edit modal: label (bn+en), value (bn+en), checkbox for auto_calculate, dropdown for auto_source (courses/users/enrollments/instructors)
- Live preview showing "Auto: X" when auto_calculate is checked

**Gallery sub-tab:**
- Grid of uploaded images with title overlay
- Add modal: image upload, title (bn+en), label (bn+en), column group (1 or 2), sort order
- Delete button on each image
- Drag to reorder (or sort_order input)

**Activities sub-tab:**
- Card list showing title, time, XP
- Add/Edit modal: title (bn+en), description (bn+en), image upload, icon name (dropdown of lucide icon names), border color, time label, xp label, CTA text (bn+en)

- [ ] **Step 4: Commit**

---

## Task 6: Frontend — Dynamic SuccessAndJoyHub Component

**Files:**
- Modify: `frontend/src/components/home/SuccessAndJoyHub.tsx`

- [ ] **Step 1: Fetch data from API**

Replace hardcoded `reviews`, `gallery` arrays with API data:

```typescript
const [data, setData] = useState<any>(null);

useEffect(() => {
  const load = async () => {
    try {
      const res: any = await api.get("/homepage-content/");
      setData(res);
    } catch {}
  };
  load();
}, []);

const reviews = data?.testimonials || [];
const gallery = data?.gallery || [];
const activities = data?.activities || [];
```

- [ ] **Step 2: Update Voices section for video support**

For each testimonial card, check `video_url`:
- If `video_type === "youtube"`: extract video ID, render `<iframe>` with YouTube embed on hover/click
- If `video_type === "vimeo"`: render Vimeo embed
- If `video_type === "upload"`: render `<video>` tag with the uploaded URL
- The Play button overlay becomes functional — clicking it plays the inline video
- Photo remains the poster/thumbnail when video isn't playing

- [ ] **Step 3: Update Gallery section**

Map `gallery` items from API. Handle empty state gracefully (hide section if no items).

- [ ] **Step 4: Update Activities section**

Map `activities` items from API. Use `icon_name` to dynamically render the lucide icon. Handle empty state.

- [ ] **Step 5: Commit**

---

## Task 7: Frontend — Dynamic PlatformAchievements Component

**Files:**
- Modify: `frontend/src/components/home/PlatformAchievements.tsx`

- [ ] **Step 1: Fetch stats and gallery from API**

```typescript
const [data, setData] = useState<any>(null);

useEffect(() => {
  const load = async () => {
    try {
      const res: any = await api.get("/homepage-content/");
      setData(res);
    } catch {}
  };
  load();
}, []);

const stats = data?.stats || [];
const column1Images = (data?.gallery || []).filter((g: any) => g.column_group === 1).map((g: any) => g.image_url);
const column2Images = (data?.gallery || []).filter((g: any) => g.column_group === 2).map((g: any) => g.image_url);
```

- [ ] **Step 2: Render stats dynamically**

Replace the hardcoded 4-stat grid with a loop over `stats`:
```tsx
{stats.map((stat: any) => (
  <div key={stat.id} className="hover:-translate-y-1 transition-transform">
    <p className="text-4xl md:text-5xl font-black mb-1 drop-shadow-sm font-bn">
      {t(stat.computed_value || stat.value, stat.value_en || stat.value)}
    </p>
    <p className="text-primary-200 text-xs md:text-sm font-bold uppercase tracking-widest opacity-80">
      {t(stat.label_bn || stat.label, stat.label)}
    </p>
  </div>
))}
```

- [ ] **Step 3: Handle empty states**

If no gallery images, show a gradient placeholder. If no stats, hide the stats grid.

- [ ] **Step 4: Commit**

---

## Verification Checklist

1. **Admin → Homepage → Voices:** Create a testimonial with photo + YouTube video URL. Verify it appears on homepage with inline video player.
2. **Admin → Homepage → Stats:** Create a stat with auto_calculate=True, source="courses". Verify it shows real count on homepage.
3. **Admin → Homepage → Stats:** Create a manual stat. Toggle auto_calculate off. Verify manual value shows.
4. **Admin → Homepage → Gallery:** Upload 4 images (2 in column 1, 2 in column 2). Verify they appear in the scrolling gallery on PlatformAchievements.
5. **Admin → Homepage → Activities:** Create 3 activity cards. Verify they render in the Activities section.
6. **Empty state:** Delete all items. Verify homepage doesn't break — sections hide gracefully.
7. **Sort order:** Change sort_order values. Verify items reorder correctly.
8. **is_active toggle:** Deactivate an item. Verify it disappears from homepage but remains in admin list.
