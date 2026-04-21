# Drawing Canvas + Badge System — Plan 1: Badge Engine + Canvas + Free Drawing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the platform-wide badge engine, an interactive HTML5 drawing canvas component, and the free drawing flow (save, portfolio, parent approval) — so kids can draw, parents approve, and badges are earned.

**Architecture:** Badge engine is a standalone service with models + admin CRUD + child badge wall. Drawing canvas is a reusable React component using HTML5 Canvas 2D API with pointer events. Drawings are saved as PNG via existing upload endpoint. Parent approval gate controls visibility. Badge service is called on drawing approval to auto-award badges.

**Tech Stack:** Python/FastAPI, SQLAlchemy, Alembic, PostgreSQL, Next.js/React, Tailwind CSS, HTML5 Canvas API, Framer Motion

**Spec:** `docs/superpowers/specs/2026-04-17-drawing-canvas-badge-system-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/models/badge.py` | Create | Badge, ChildBadge models |
| `backend/app/models/drawing.py` | Create | Drawing, DrawingLike models |
| `backend/app/models/__init__.py` | Modify | Export new models |
| `backend/alembic/versions/n4o5p6q7r8s9_add_badge_drawing_tables.py` | Create | Migration |
| `backend/app/services/badge_service.py` | Create | Badge checking + awarding logic |
| `backend/app/api/v1/badges.py` | Create | Badge admin CRUD + child badge wall API |
| `backend/app/api/v1/drawings.py` | Create | Drawing CRUD + parent approval + like toggle |
| `backend/app/main.py` | Modify | Register badge + drawing routers |
| `frontend/src/components/drawing/DrawingCanvas.tsx` | Create | HTML5 Canvas with tools (brush, eraser, colors, undo) |
| `frontend/src/app/draw/page.tsx` | Create | Free drawing page (full screen canvas) |
| `frontend/src/app/drawings/page.tsx` | Create | My drawings portfolio |
| `frontend/src/app/gallery/page.tsx` | Create | Public gallery (approved drawings) |
| `frontend/src/app/gallery/[id]/page.tsx` | Create | Single drawing view with likes |
| `frontend/src/components/badges/BadgeWall.tsx` | Create | Reusable badge grid component |
| `frontend/src/app/admin/page.tsx` | Modify | Add Badges tab + Gallery moderation tab |

---

### Task 1: Badge + Drawing Models + Migration

**Files:**
- Create: `backend/app/models/badge.py`
- Create: `backend/app/models/drawing.py`
- Modify: `backend/app/models/__init__.py`
- Create: migration file

- [ ] **Step 1: Create badge models**

Create `backend/app/models/badge.py`:

```python
"""Badge models — platform-wide badge system."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Text,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class Badge(Base):
    __tablename__ = "badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(300), nullable=False)
    name_bn = Column(String(300), nullable=True)
    description = Column(String(1000), nullable=True)
    description_bn = Column(String(1000), nullable=True)
    icon_url = Column(String(1000), nullable=True)
    category = Column(String(30), default="general")  # art | games | exams | abacus | courses | general
    criteria = Column(JSONB, default=dict)  # { trigger, threshold, description }
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    child_badges = relationship("ChildBadge", back_populates="badge", lazy="noload")


class ChildBadge(Base):
    __tablename__ = "child_badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    badge_id = Column(UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    earned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    child = relationship("ChildProfile")
    badge = relationship("Badge", back_populates="child_badges")

    __table_args__ = (
        UniqueConstraint("child_profile_id", "badge_id", name="uq_child_badge"),
    )
```

- [ ] **Step 2: Create drawing models**

Create `backend/app/models/drawing.py`:

```python
"""Drawing models — canvas drawings and likes."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base


class Drawing(Base):
    __tablename__ = "drawings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(String(1000), nullable=False)
    title = Column(String(500), nullable=True)
    title_bn = Column(String(500), nullable=True)
    challenge_id = Column(UUID(as_uuid=True), nullable=True)  # FK added in Phase 2 when Challenge model exists
    status = Column(String(20), default="pending")  # pending | approved | rejected
    is_featured = Column(Boolean, default=False)
    like_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    child = relationship("ChildProfile")
    user = relationship("User")
    likes = relationship("DrawingLike", back_populates="drawing", lazy="noload")


class DrawingLike(Base):
    __tablename__ = "drawing_likes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drawing_id = Column(UUID(as_uuid=True), ForeignKey("drawings.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    drawing = relationship("Drawing", back_populates="likes")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("drawing_id", "user_id", name="uq_drawing_like"),
    )
```

- [ ] **Step 3: Export models + create migration + run**

Add to `backend/app/models/__init__.py`:
```python
# Badges
from app.models.badge import Badge, ChildBadge  # noqa: F401

# Drawings
from app.models.drawing import Drawing, DrawingLike  # noqa: F401
```

Find current alembic head, create migration for all 4 tables (`badges`, `child_badges`, `drawings`, `drawing_likes`), run it.

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat(badges+drawings): add models and migration for badges, child_badges, drawings, drawing_likes"
```

---

### Task 2: Badge Service

**Files:**
- Create: `backend/app/services/badge_service.py`

- [ ] **Step 1: Create the badge checking service**

```python
"""Badge Service — checks and awards badges to children."""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.badge import Badge, ChildBadge
from app.models.drawing import Drawing

logger = logging.getLogger(__name__)


class BadgeService:

    @staticmethod
    async def check_and_award(
        child_profile_id: UUID,
        trigger: str,
        db: AsyncSession,
    ) -> list[Badge]:
        """
        Check all active badges matching the trigger.
        Award any the child newly qualifies for.
        Returns list of newly awarded badges.
        """
        awarded = []

        # Get all active badges with this trigger
        result = await db.execute(
            select(Badge).where(
                Badge.is_active == True,
            )
        )
        badges = result.scalars().all()

        for badge in badges:
            criteria = badge.criteria or {}
            if criteria.get("trigger") != trigger:
                continue

            threshold = criteria.get("threshold", 1)

            # Check if already earned
            existing = await db.execute(
                select(ChildBadge).where(
                    ChildBadge.child_profile_id == child_profile_id,
                    ChildBadge.badge_id == badge.id,
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Count the child's stat for this trigger
            count = await BadgeService._get_count(child_profile_id, trigger, db)

            if count >= threshold:
                child_badge = ChildBadge(
                    child_profile_id=child_profile_id,
                    badge_id=badge.id,
                )
                db.add(child_badge)
                awarded.append(badge)
                logger.info(f"Awarded badge '{badge.name}' to child {child_profile_id}")

        if awarded:
            await db.commit()

        return awarded

    @staticmethod
    async def _get_count(
        child_profile_id: UUID,
        trigger: str,
        db: AsyncSession,
    ) -> int:
        """Get the count for a specific trigger type."""
        if trigger == "drawing_count":
            result = await db.execute(
                select(func.count()).select_from(Drawing).where(
                    Drawing.child_profile_id == child_profile_id,
                    Drawing.status == "approved",
                )
            )
            return result.scalar() or 0

        if trigger == "featured_count":
            result = await db.execute(
                select(func.count()).select_from(Drawing).where(
                    Drawing.child_profile_id == child_profile_id,
                    Drawing.is_featured == True,
                )
            )
            return result.scalar() or 0

        if trigger == "like_count":
            result = await db.execute(
                select(func.coalesce(func.sum(Drawing.like_count), 0)).where(
                    Drawing.child_profile_id == child_profile_id,
                    Drawing.status == "approved",
                )
            )
            return result.scalar() or 0

        # Future triggers (game_completed, exam_passed, etc.) return 0 for now
        return 0

    @staticmethod
    async def get_child_badges(
        child_profile_id: UUID,
        db: AsyncSession,
    ) -> list[dict]:
        """Get all earned badges for a child."""
        result = await db.execute(
            select(ChildBadge)
            .options()
            .where(ChildBadge.child_profile_id == child_profile_id)
            .order_by(ChildBadge.earned_at.desc())
        )
        child_badges = result.scalars().all()

        badge_ids = [cb.badge_id for cb in child_badges]
        if not badge_ids:
            return []

        badges_result = await db.execute(
            select(Badge).where(Badge.id.in_(badge_ids))
        )
        badges_map = {b.id: b for b in badges_result.scalars().all()}

        return [
            {
                "badge_id": str(cb.badge_id),
                "name": badges_map[cb.badge_id].name if cb.badge_id in badges_map else "",
                "name_bn": badges_map[cb.badge_id].name_bn if cb.badge_id in badges_map else None,
                "icon_url": badges_map[cb.badge_id].icon_url if cb.badge_id in badges_map else None,
                "category": badges_map[cb.badge_id].category if cb.badge_id in badges_map else "general",
                "earned_at": str(cb.earned_at),
            }
            for cb in child_badges
            if cb.badge_id in badges_map
        ]

    @staticmethod
    async def get_badge_wall(
        child_profile_id: UUID,
        db: AsyncSession,
    ) -> list[dict]:
        """Get all badges (earned + locked) for the badge wall UI."""
        # All active badges
        all_badges_result = await db.execute(
            select(Badge).where(Badge.is_active == True).order_by(Badge.sort_order)
        )
        all_badges = all_badges_result.scalars().all()

        # Child's earned badge IDs
        earned_result = await db.execute(
            select(ChildBadge.badge_id, ChildBadge.earned_at).where(
                ChildBadge.child_profile_id == child_profile_id,
            )
        )
        earned_map = {row[0]: row[1] for row in earned_result.all()}

        wall = []
        for badge in all_badges:
            criteria = badge.criteria or {}
            trigger = criteria.get("trigger", "")
            threshold = criteria.get("threshold", 1)
            earned = badge.id in earned_map

            # Get current progress if not earned
            progress = 0
            if not earned and trigger:
                progress = await BadgeService._get_count(child_profile_id, trigger, db)

            wall.append({
                "badge_id": str(badge.id),
                "name": badge.name,
                "name_bn": badge.name_bn,
                "description": badge.description,
                "description_bn": badge.description_bn,
                "icon_url": badge.icon_url,
                "category": badge.category,
                "earned": earned,
                "earned_at": str(earned_map[badge.id]) if earned else None,
                "progress": min(progress, threshold),
                "threshold": threshold,
            })

        return wall
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/badge_service.py
git commit -m "feat(badges): add BadgeService — check, award, badge wall with progress"
```

---

### Task 3: Badge + Drawing APIs

**Files:**
- Create: `backend/app/api/v1/badges.py`
- Create: `backend/app/api/v1/drawings.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create badges API**

Create `backend/app/api/v1/badges.py`. Follow the games API pattern.

**Admin endpoints:**
- `POST /badges/` — create badge (name, name_bn, description, icon_url, category, criteria, sort_order)
- `PUT /badges/{badge_id}` — update badge
- `GET /badges/` — list all badges (admin)
- `DELETE /badges/{badge_id}` — delete badge

**Student endpoints:**
- `GET /badges/wall?child_profile_id=...` — badge wall (all badges with earned/locked state + progress)
- `GET /badges/earned?child_profile_id=...` — only earned badges

- [ ] **Step 2: Create drawings API**

Create `backend/app/api/v1/drawings.py`. Follow existing API patterns.

**Student endpoints:**
- `POST /drawings/` — save drawing (child_profile_id, image_url, title, title_bn, challenge_id). Status = pending.
- `GET /drawings/my?child_profile_id=...` — child's drawings (all statuses)
- `DELETE /drawings/{id}` — delete own drawing

**Parent endpoints:**
- `GET /drawings/pending?child_profile_id=...` — pending drawings for parent approval
- `PUT /drawings/{id}/approve` — approve (status → approved). Call `BadgeService.check_and_award(child_id, "drawing_count", db)` after approval.
- `PUT /drawings/{id}/reject` — reject (status → rejected)

**Public endpoints:**
- `GET /drawings/gallery?page=1&page_size=20&sort=recent` — approved drawings (sort: recent | popular | featured)
- `GET /drawings/{id}` — single drawing detail
- `POST /drawings/{id}/like` — toggle like (auth required). Updates denormalized like_count. Calls `BadgeService.check_and_award(drawing.child_profile_id, "like_count", db)`.

**Admin endpoints:**
- `GET /drawings/admin?status=pending&page=1&page_size=50` — all drawings with status filter
- `PUT /drawings/{id}/feature` — toggle is_featured. Calls badge check for "featured_count".
- `DELETE /drawings/{id}/admin` — admin delete

- [ ] **Step 3: Register routers in main.py**

Add imports + include_router for both badges and drawings.

- [ ] **Step 4: Verify and commit**

```bash
cd backend && python -c "from app.main import create_app; print('OK')"
git add backend/
git commit -m "feat(badges+drawings): add badge admin CRUD, drawing save/approve/like/gallery APIs"
```

---

### Task 4: Drawing Canvas Component

**Files:**
- Create: `frontend/src/components/drawing/DrawingCanvas.tsx`

- [ ] **Step 1: Create the HTML5 canvas drawing component**

This is the core creative tool. Must work on both mouse and touch.

**Props:**
```typescript
interface DrawingCanvasProps {
  onSave: (imageBlob: Blob) => void;
  challengePrompt?: string;
  readOnly?: boolean;
  initialImage?: string;
  width?: number;   // default 800
  height?: number;  // default 600
}
```

**Tool bar (horizontal, above canvas):**
- Brush button (active by default)
- Eraser button
- Color swatches: 16 preset kid-friendly colors in a grid (2 rows × 8). Colors: red, orange, yellow, green, teal, blue, purple, pink, brown, black, gray, white + 4 more bright variants.
- Brush size: 4 preset circles (small=3px, medium=6px, large=12px, extra=20px)
- Undo button (↩)
- Redo button (↪)
- Clear button (🗑️) — with custom confirmation modal (NOT window.confirm)
- Save button (💾)

**Canvas implementation:**
- `<canvas>` element with `ref`
- Drawing state: `tool` (brush | eraser), `color`, `brushSize`
- Stroke history: array of `{ tool, color, size, points: [{x,y}] }` for undo/redo
- `undoneStrokes` array for redo
- On pointer down: start new stroke, add to history
- On pointer move (while down): add point, draw line segment on canvas
- On pointer up: finalize stroke
- Undo: pop last stroke from history → push to undoneStrokes → redraw entire canvas from remaining history
- Redo: pop from undoneStrokes → push to history → draw the stroke
- Clear: clear history + canvas (with modal confirmation)
- Eraser: draw with `destination-out` composite operation, or draw with white

**Drawing on canvas:**
- Use `ctx.beginPath()`, `ctx.moveTo()`, `ctx.lineTo()`, `ctx.stroke()`
- `ctx.lineCap = "round"`, `ctx.lineJoin = "round"` for smooth lines
- Set `ctx.strokeStyle` = color, `ctx.lineWidth` = size

**Save:**
- `canvasRef.current.toBlob(blob => onSave(blob), "image/png")`

**Touch support:**
- Use `onPointerDown/Move/Up` (unified pointer events)
- Set `style={{ touchAction: "none" }}` on canvas to prevent scroll
- Get coordinates via `e.nativeEvent.offsetX/Y` or calculate from `getBoundingClientRect()`

**Responsive:**
- Canvas container scales to fit screen width
- Use CSS `max-w-[800px] w-full` with aspect ratio maintained
- Canvas internal resolution stays 800×600, CSS scales it

**Clear confirmation:** custom modal (state-based, not window.confirm)

Export as `export default function DrawingCanvas(props: DrawingCanvasProps)`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/drawing/
git commit -m "feat(drawing): add HTML5 DrawingCanvas component with brush, eraser, colors, undo/redo"
```

---

### Task 5: Free Drawing Page

**Files:**
- Create: `frontend/src/app/draw/page.tsx`

- [ ] **Step 1: Create the free drawing page**

Full-screen drawing experience at `/draw`.

**Structure:**
- Top bar: "Free Drawing 🎨" title, child selector dropdown, close (X) button → go to `/drawings`
- Main: `<DrawingCanvas onSave={handleSave} />`
- Title input modal: after save, prompt for optional title before submitting
- On save: upload blob via `api.postFormData("/uploads/image", fd)` with `folder=drawings`, then `POST /drawings/` with image_url + child_profile_id + title
- Success toast: "Drawing saved! Waiting for parent approval."

**Auth required.** Redirect to login if not authenticated.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/draw/
git commit -m "feat(drawing): add free drawing page with canvas and save flow"
```

---

### Task 6: My Drawings Portfolio Page

**Files:**
- Create: `frontend/src/app/drawings/page.tsx`

- [ ] **Step 1: Create the portfolio page**

Child's drawing portfolio at `/drawings`.

**Structure:**
- Navbar + Footer
- Child selector (if multiple children)
- Grid of drawing thumbnails (3 cols desktop, 2 tablet, 1 mobile)
- Each card: thumbnail image, title, status badge (pending=yellow, approved=green, rejected=red), date, like count (if approved)
- Click → view full drawing (link to `/gallery/{id}` if approved, or inline modal if pending/rejected)
- "Start Drawing" button linking to `/draw`
- **Parent section** (if user is parent): pending drawings with approve/reject buttons inline

**API:**
- `GET /drawings/my?child_profile_id={childId}` — all child's drawings
- `PUT /drawings/{id}/approve` — approve
- `PUT /drawings/{id}/reject` — reject

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/drawings/
git commit -m "feat(drawing): add My Drawings portfolio page with parent approval"
```

---

### Task 7: Public Gallery Page

**Files:**
- Create: `frontend/src/app/gallery/page.tsx`
- Create: `frontend/src/app/gallery/[id]/page.tsx`

- [ ] **Step 1: Create the gallery listing page**

Community gallery at `/gallery`.

**Structure:**
- Kid-friendly header: "Art Gallery 🎨" with warm gradient
- Sort tabs: "Recent" | "Popular" | "Featured"
- Grid of approved drawings (3 cols desktop, 2 tablet, 1 mobile)
- Each card: drawing image (aspect-square, object-cover, rounded-xl), child's first name, heart count with heart icon, featured badge (gold border if featured)
- Click → `/gallery/{id}`
- Pagination: "Load More" button
- Heart button on each card (requires login, toggles like)

**API:** `GET /drawings/gallery?page=1&page_size=20&sort=recent`

- [ ] **Step 2: Create single drawing view page**

Full view at `/gallery/[id]`.

**Structure:**
- Large drawing image (max-w-2xl, centered)
- Title (if any)
- Child's first name + date
- Heart button (large, animated) + like count
- "Featured" badge if featured
- Back to gallery link

**API:**
- `GET /drawings/{id}` — drawing detail
- `POST /drawings/{id}/like` — toggle like

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/gallery/
git commit -m "feat(drawing): add public gallery page and single drawing view with likes"
```

---

### Task 8: Badge Wall Component + Dashboard Integration

**Files:**
- Create: `frontend/src/components/badges/BadgeWall.tsx`

- [ ] **Step 1: Create the badge wall component**

Reusable component that shows all badges (earned + locked) for a child.

**Props:**
```typescript
interface BadgeWallProps {
  childProfileId: string;
}
```

**Structure:**
- Fetches `GET /badges/wall?child_profile_id={id}` on mount
- Grid of badge cards (4 cols desktop, 3 tablet, 2 mobile)
- Each badge card:
  - Earned: full color icon, name, earned date, golden border glow
  - Locked: grayscale icon, name, progress bar (e.g., "3/5"), dimmed
- Category filter tabs: All | Art | Games | General
- Animation: earned badges have subtle shine effect

Export as `export default function BadgeWall({ childProfileId }: BadgeWallProps)`.

This component can be embedded in the child's dashboard, profile page, or any page that shows child progress.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/badges/
git commit -m "feat(badges): add BadgeWall component with earned/locked state and progress"
```

---

### Task 9: Admin — Badges Tab + Gallery Moderation Tab

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`
- Modify: `frontend/src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: Add Badges tab to admin dashboard**

Add "Badges" tab with `Award` icon from lucide-react.

**Tab content:**
- Table: Name, Category badge, Icon preview, Trigger, Threshold, Active, Edit/Delete
- "Create Badge" button → modal: name, name_bn, description, category dropdown, icon upload, criteria (trigger dropdown + threshold number), sort_order
- Trigger dropdown options: drawing_count, featured_count, like_count, challenge_streak (+ future: game_completed, exam_passed, abacus_level, course_completed)
- Edit inline or modal
- Delete with custom confirmation modal

**API:** `GET/POST/PUT/DELETE /badges/`

- [ ] **Step 2: Add Gallery tab to admin dashboard**

Add "Gallery" tab with `Image` icon.

**Tab content:**
- Table: Thumbnail (small), Title, Child Name, Status badge (pending/approved/rejected), Featured toggle, Likes count, Date, Actions (Approve/Reject/Feature/Delete)
- Status filter dropdown: All, Pending, Approved, Rejected
- Bulk approve button (optional — can skip for now)

**API:** `GET /drawings/admin?status=...`, `PUT /drawings/{id}/approve`, `PUT /drawings/{id}/reject`, `PUT /drawings/{id}/feature`, `DELETE /drawings/{id}/admin`

- [ ] **Step 3: Add sidebar entries in AdminLayout**

Add entries for badges and gallery paths.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
git add frontend/src/app/admin/ frontend/src/components/admin/
git commit -m "feat(admin): add Badges management tab and Gallery moderation tab"
```

---

### Task 10: End-to-End Verification

- [ ] **Step 1: Backend check**

```bash
cd backend && alembic upgrade head
python -c "from app.main import create_app; print('OK')"
```

- [ ] **Step 2: Test badge admin flow**

1. Go to `/admin?tab=badges`
2. Create badge: "First Drawing" with trigger=drawing_count, threshold=1
3. Create badge: "Art Star" with trigger=drawing_count, threshold=5
4. Verify badges appear in table

- [ ] **Step 3: Test drawing flow**

1. Go to `/draw` — canvas loads
2. Draw something, click save, enter title
3. Verify drawing appears in `/drawings` with "pending" status
4. As parent: approve the drawing
5. Verify status changes to "approved"
6. Verify badge "First Drawing" was auto-awarded (check badge wall)

- [ ] **Step 4: Test gallery**

1. Go to `/gallery` — approved drawing appears
2. Click heart — like count increments
3. Click drawing — full view loads
4. Admin: feature the drawing from gallery tab

- [ ] **Step 5: Test badge wall**

1. Check badge wall shows "First Drawing" earned + "Art Star" locked with progress 1/5
