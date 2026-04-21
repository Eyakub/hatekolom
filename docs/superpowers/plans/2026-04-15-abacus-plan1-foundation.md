# Abacus Module — Plan 1: Backend Foundation + Admin + Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete backend for the abacus module (models, API, entitlements, default curriculum), the admin course/level editor, and the public-facing pages — so that abacus courses can be created, priced, and browsed. The interactive abacus bead component and game engines are in Plan 2.

**Architecture:** Follows the exam/game pattern — `AbacusCourse` with 1:1 Product FK, `AbacusLevel` for ordered levels, `AbacusAttempt` for tracking, `ProductAbacus` for attachment. Admin configures levels with exercise rules (JSONB config). Frontend level map shows progression with unlock gates.

**Tech Stack:** Python/FastAPI, SQLAlchemy, Alembic, PostgreSQL, Next.js/React, Tailwind CSS, Framer Motion

**Spec:** `docs/superpowers/specs/2026-04-15-abacus-module-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/models/enums.py` | Modify | Add `ABACUS`, `ABACUS_ACCESS` |
| `backend/app/models/abacus.py` | Create | AbacusCourse, AbacusLevel, AbacusAttempt, ProductAbacus models |
| `backend/app/models/__init__.py` | Modify | Export abacus models |
| `backend/app/models/product.py` | Modify | Add `abacus_course` relationship |
| `backend/app/services/entitlement_service.py` | Modify | Add ABACUS case |
| `backend/alembic/versions/m3n4o5p6q7r8_add_abacus_tables.py` | Create | Migration |
| `backend/app/api/v1/abacus.py` | Create | Full abacus API |
| `backend/app/main.py` | Modify | Register abacus router |
| `frontend/src/app/admin/abacus/[id]/page.tsx` | Create | Admin course/level editor |
| `frontend/src/app/admin/page.tsx` | Modify | Add Abacus tab |
| `frontend/src/app/abacus/page.tsx` | Create | Public course listing |
| `frontend/src/app/abacus/[slug]/page.tsx` | Create | Course detail with level map |
| `frontend/src/app/abacus/[slug]/level/[levelId]/page.tsx` | Create | Level play page shell |

---

### Task 1: Enums + Models + Migration + Entitlement

**Files:**
- Modify: `backend/app/models/enums.py`
- Create: `backend/app/models/abacus.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/product.py`
- Modify: `backend/app/services/entitlement_service.py`
- Create: `backend/alembic/versions/m3n4o5p6q7r8_add_abacus_tables.py`

- [ ] **Step 1: Add enums**

In `backend/app/models/enums.py`:
- Add `ABACUS = "abacus"` to `ProductType` (after GAME)
- Add `ABACUS_ACCESS = "abacus_access"` to `EntitlementType` (after GAME_ACCESS)

- [ ] **Step 2: Create abacus models**

Create `backend/app/models/abacus.py`:

```python
"""Abacus models — courses, levels, attempts, and product-abacus links."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Text,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class AbacusCourse(Base):
    __tablename__ = "abacus_courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    total_levels = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="abacus_course")
    levels = relationship("AbacusLevel", back_populates="course", cascade="all, delete-orphan",
                          order_by="AbacusLevel.sort_order")


class AbacusLevel(Base):
    __tablename__ = "abacus_levels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    abacus_course_id = Column(UUID(as_uuid=True), ForeignKey("abacus_courses.id", ondelete="CASCADE"), nullable=False)
    sort_order = Column(Integer, default=0)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    description_bn = Column(Text, nullable=True)
    level_type = Column(String(20), default="test")      # tutorial | practice | test
    exercise_type = Column(String(20), default="bead_slide")  # bead_slide | mental_math | mixed
    config = Column(JSONB, default=dict)
    content = Column(JSONB, default=dict)  # tutorial steps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    course = relationship("AbacusCourse", back_populates="levels")
    attempts = relationship("AbacusAttempt", back_populates="level", lazy="noload")


class AbacusAttempt(Base):
    __tablename__ = "abacus_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level_id = Column(UUID(as_uuid=True), ForeignKey("abacus_levels.id", ondelete="CASCADE"), nullable=False)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Integer, default=0)
    total_points = Column(Integer, default=0)
    time_seconds = Column(Integer, default=0)
    passed = Column(Boolean, default=False)
    stars = Column(Integer, default=0)
    attempt_data = Column(JSONB, default=dict)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    level = relationship("AbacusLevel", back_populates="attempts")
    user = relationship("User")
    child = relationship("ChildProfile")


class ProductAbacus(Base):
    __tablename__ = "product_abacus"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    abacus_course_id = Column(UUID(as_uuid=True), ForeignKey("abacus_courses.id", ondelete="CASCADE"), nullable=False)
```

- [ ] **Step 3: Update Product model**

In `backend/app/models/product.py`, add after the `game` relationship:

```python
    abacus_course = relationship("AbacusCourse", back_populates="product", uselist=False, lazy="noload")
```

- [ ] **Step 4: Export models**

In `backend/app/models/__init__.py`, add at the end:

```python
# Abacus
from app.models.abacus import AbacusCourse, AbacusLevel, AbacusAttempt, ProductAbacus  # noqa: F401
```

- [ ] **Step 5: Update entitlement service**

In `backend/app/services/entitlement_service.py`:
- Add `ProductType.ABACUS` to the physical_only skip tuple (same line as GAME)
- Add after the GAME case block:

```python
        elif product.product_type == ProductType.ABACUS:
            if not await _exists(EntitlementType.ABACUS_ACCESS):
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.ABACUS_ACCESS.value,
                )
                db.add(ent)
                created.append(ent)
```

- [ ] **Step 6: Create migration**

Find current alembic head: `cd backend && alembic heads`

Create `backend/alembic/versions/m3n4o5p6q7r8_add_abacus_tables.py` with the correct `down_revision`. Tables: `abacus_courses`, `abacus_levels`, `abacus_attempts`, `product_abacus`. Same pattern as the games migration.

- [ ] **Step 7: Run migration and verify**

```bash
cd backend && alembic upgrade head
python -c "from app.models.abacus import AbacusCourse, AbacusLevel, AbacusAttempt, ProductAbacus; print('OK')"
```

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(abacus): add models, migration, enums, entitlement service"
```

---

### Task 2: Abacus API

**Files:**
- Create: `backend/app/api/v1/abacus.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the abacus API**

Create `backend/app/api/v1/abacus.py`. Follow the exact patterns from `backend/app/api/v1/games.py` — same imports, same permission checks, same pagination.

**Schemas:**
- `AbacusCourseCreateRequest`: title, title_bn, slug, description, description_bn, thumbnail_url, price, compare_price, is_free, load_defaults (bool, default false)
- `AbacusCourseUpdateRequest`: all fields optional
- `LevelCreateRequest`: title, title_bn, description, description_bn, level_type, exercise_type, config (dict), content (dict), sort_order
- `LevelUpdateRequest`: all fields optional
- `LevelSubmitRequest`: child_profile_id, score, total_points, time_seconds, passed, stars, attempt_data (dict)
- `ReorderRequest`: level_ids (list of str UUIDs in new order)

**Default curriculum constant:**

```python
DEFAULT_CURRICULUM = [
    {"sort_order": 0, "title": "Counting 1-4", "title_bn": "১-৪ গণনা", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": [], "number_range": [1, 4], "num_rods": 1, "question_count": 4, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Push 1 earth bead up", "instruction_bn": "১টি গুটি উপরে তোলো", "target_value": 1, "highlight_rods": [0]},
         {"instruction": "Push 2 earth beads up", "instruction_bn": "২টি গুটি উপরে তোলো", "target_value": 2, "highlight_rods": [0]},
         {"instruction": "Push 3 earth beads up", "instruction_bn": "৩টি গুটি উপরে তোলো", "target_value": 3, "highlight_rods": [0]},
         {"instruction": "Push all 4 earth beads up", "instruction_bn": "৪টি গুটি উপরে তোলো", "target_value": 4, "highlight_rods": [0]},
     ]}},
    {"sort_order": 1, "title": "Counting 1-4 Test", "title_bn": "১-৪ গণনা পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": [], "number_range": [1, 4], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {}},
    {"sort_order": 2, "title": "Friends of 5 (5-9)", "title_bn": "৫ এর বন্ধু (৫-৯)", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": [], "number_range": [5, 9], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Push the heaven bead down for 5", "instruction_bn": "স্বর্গ গুটি নামাও ৫ এর জন্য", "target_value": 5, "highlight_rods": [0]},
         {"instruction": "Heaven bead + 1 earth bead = 6", "instruction_bn": "স্বর্গ গুটি + ১ = ৬", "target_value": 6, "highlight_rods": [0]},
         {"instruction": "Heaven bead + 2 earth beads = 7", "instruction_bn": "স্বর্গ গুটি + ২ = ৭", "target_value": 7, "highlight_rods": [0]},
         {"instruction": "Heaven bead + 3 earth beads = 8", "instruction_bn": "স্বর্গ গুটি + ৩ = ৮", "target_value": 8, "highlight_rods": [0]},
         {"instruction": "Heaven bead + 4 earth beads = 9", "instruction_bn": "স্বর্গ গুটি + ৪ = ৯", "target_value": 9, "highlight_rods": [0]},
     ]}},
    {"sort_order": 3, "title": "Counting 5-9 Test", "title_bn": "৫-৯ গণনা পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": [], "number_range": [5, 9], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {}},
    {"sort_order": 4, "title": "Simple Addition", "title_bn": "সাধারণ যোগ", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": ["+"], "number_range": [1, 9], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Show 3 on the abacus", "instruction_bn": "৩ দেখাও", "target_value": 3, "highlight_rods": [0]},
         {"instruction": "Now add 2 more (total 5)", "instruction_bn": "আরো ২ যোগ করো (মোট ৫)", "target_value": 5, "highlight_rods": [0]},
         {"instruction": "Reset. Show 4", "instruction_bn": "রিসেট করো। ৪ দেখাও", "target_value": 4, "highlight_rods": [0]},
         {"instruction": "Add 3 more (use heaven bead!)", "instruction_bn": "আরো ৩ যোগ করো (স্বর্গ গুটি ব্যবহার করো!)", "target_value": 7, "highlight_rods": [0]},
     ]}},
    {"sort_order": 5, "title": "Addition Test", "title_bn": "যোগ পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": ["+"], "number_range": [1, 9], "num_rods": 1, "question_count": 10, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {}},
    {"sort_order": 6, "title": "Simple Subtraction", "title_bn": "সাধারণ বিয়োগ", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": ["-"], "number_range": [1, 9], "num_rods": 1, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Show 7 on the abacus", "instruction_bn": "৭ দেখাও", "target_value": 7, "highlight_rods": [0]},
         {"instruction": "Remove 2 (total 5)", "instruction_bn": "২ সরাও (মোট ৫)", "target_value": 5, "highlight_rods": [0]},
         {"instruction": "Reset. Show 9", "instruction_bn": "রিসেট করো। ৯ দেখাও", "target_value": 9, "highlight_rods": [0]},
         {"instruction": "Remove 4 (total 5)", "instruction_bn": "৪ সরাও (মোট ৫)", "target_value": 5, "highlight_rods": [0]},
     ]}},
    {"sort_order": 7, "title": "Subtraction Test", "title_bn": "বিয়োগ পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": ["-"], "number_range": [1, 9], "num_rods": 1, "question_count": 10, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {}},
    {"sort_order": 8, "title": "Two-Digit Numbers", "title_bn": "দুই অঙ্কের সংখ্যা", "level_type": "tutorial", "exercise_type": "bead_slide",
     "config": {"operations": ["+", "-"], "number_range": [10, 99], "num_rods": 2, "question_count": 5, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Show 10 — push 1 earth bead on tens rod", "instruction_bn": "১০ দেখাও — দশক রডে ১টি গুটি তোলো", "target_value": 10, "highlight_rods": [1]},
         {"instruction": "Show 15 — tens rod: 1, ones rod: heaven bead", "instruction_bn": "১৫ দেখাও", "target_value": 15, "highlight_rods": [0, 1]},
         {"instruction": "Show 23", "instruction_bn": "২৩ দেখাও", "target_value": 23, "highlight_rods": [0, 1]},
         {"instruction": "Show 47", "instruction_bn": "৪৭ দেখাও", "target_value": 47, "highlight_rods": [0, 1]},
     ]}},
    {"sort_order": 9, "title": "Two-Digit Test", "title_bn": "দুই অঙ্কের পরীক্ষা", "level_type": "test", "exercise_type": "bead_slide",
     "config": {"operations": ["+", "-"], "number_range": [10, 99], "num_rods": 2, "question_count": 10, "time_limit_seconds": 120, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {}},
    {"sort_order": 10, "title": "Mental Math Introduction", "title_bn": "মানসিক গণিত পরিচিতি", "level_type": "tutorial", "exercise_type": "mixed",
     "config": {"operations": ["+", "-"], "number_range": [1, 20], "num_rods": 2, "question_count": 6, "time_limit_seconds": None, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {"steps": [
         {"instruction": "Solve with abacus: 8 + 5", "instruction_bn": "অ্যাবাকাসে সমাধান করো: ৮ + ৫", "target_value": 13, "highlight_rods": [0, 1]},
         {"instruction": "Now close your eyes and visualize: 6 + 7", "instruction_bn": "এবার চোখ বন্ধ করে কল্পনা করো: ৬ + ৭", "target_value": 13, "highlight_rods": []},
         {"instruction": "Solve with abacus: 15 - 8", "instruction_bn": "অ্যাবাকাসে: ১৫ - ৮", "target_value": 7, "highlight_rods": [0, 1]},
     ]}},
    {"sort_order": 11, "title": "Mental Math Test", "title_bn": "মানসিক গণিত পরীক্ষা", "level_type": "test", "exercise_type": "mental_math",
     "config": {"operations": ["+", "-"], "number_range": [1, 50], "num_rods": 0, "question_count": 10, "time_limit_seconds": 120, "flash_duration_ms": 3000, "pass_percentage": 80},
     "content": {}},
]
```

**Helper — `_get_course_response(course_id, db, admin=False)`:**
Serializes course with product fields + levels list. If admin, include full config/content per level. If public, include level metadata only (id, title, sort_order, level_type, exercise_type — no config/content).

**Helper — `_get_level_progress(course_id, child_profile_id, db)`:**
Returns list of levels with unlock state. For each level: check if previous level (by sort_order) has a passing AbacusAttempt for this child. First level is always unlocked. Returns: `[{level_id, title, sort_order, level_type, locked, completed, stars, best_score}]`.

**Admin endpoints:**
- `POST /abacus/` — Create course (product + abacus_course). If `load_defaults=true`, insert all DEFAULT_CURRICULUM levels.
- `PUT /abacus/{course_id}` — Update course + product fields.
- `GET /abacus/{course_id}/admin` — Full course with levels and configs.
- `POST /abacus/{course_id}/levels` — Add a level.
- `PUT /abacus/levels/{level_id}` — Update a level.
- `DELETE /abacus/levels/{level_id}` — Delete a level (update course.total_levels).
- `PUT /abacus/{course_id}/reorder` — Reorder levels (accepts `{level_ids: [...]}`).
- `POST /abacus/{course_id}/attach/{product_id}` — Attach.
- `DELETE /abacus/{course_id}/attach/{product_id}` — Detach.
- `GET /abacus/{course_id}/attempts` — List all attempts.

**Public endpoints:**
- `GET /abacus/` — List active courses (paginated, searchable).
- `GET /abacus/slug/{slug}` — Course detail (no level configs).

**Student endpoints:**
- `GET /abacus/{course_id}/progress?child_profile_id=...` — Level map with unlock/completion state.
- `GET /abacus/levels/{level_id}/start?child_profile_id=...&preview=false` — Get level config. Access check (entitlement) + unlock check (previous level passed). Preview mode for admin skips checks.
- `POST /abacus/levels/{level_id}/submit` — Submit attempt. Save AbacusAttempt.
- `GET /abacus/my` — List accessible courses.

- [ ] **Step 2: Register router in main.py**

Add import and include_router for abacus (same pattern as games).

- [ ] **Step 3: Verify and commit**

```bash
cd backend && python -c "from app.main import create_app; print('OK')"
git add backend/
git commit -m "feat(abacus): add complete API with default curriculum, level progression, entitlement checks"
```

---

### Task 3: Admin — Abacus Tab in Dashboard

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`
- Modify: `frontend/src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: Add Abacus tab**

Same pattern as the Games tab. Add "Abacus" tab with an appropriate icon (e.g., `Calculator` from lucide-react). Shows:
- Table of abacus courses: Title, Levels count, Price, Active, Edit link
- "Create Course" button → modal with: title, title_bn, load_defaults checkbox ("Load default 12-level curriculum"), pricing
- On create: `POST /abacus/` with `load_defaults=true/false` → redirect to `/admin/abacus/{id}`

Also add sidebar entry in `AdminLayout.tsx` for `/admin/abacus/*`.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add frontend/src/app/admin/page.tsx frontend/src/components/admin/AdminLayout.tsx
git commit -m "feat(abacus): add Abacus tab to admin dashboard"
```

---

### Task 4: Admin — Course/Level Editor Page

**Files:**
- Create: `frontend/src/app/admin/abacus/[id]/page.tsx`

- [ ] **Step 1: Create the editor page**

Follow the game editor pattern at `frontend/src/app/admin/games/[id]/page.tsx`. Read it first.

**Left column — Level Editor:**
- Ordered list of levels (each level is a collapsible card)
- Each card shows: sort order number, title, type badge (tutorial/practice/test in different colors), exercise type badge
- Click to expand → inline editor with:
  - Title (EN), Title BN
  - Description (EN), Description BN
  - Level type dropdown (tutorial / practice / test)
  - Exercise type dropdown (bead_slide / mental_math / mixed)
  - Config section:
    - Operations: checkboxes for +, −, ×, ÷ (empty = counting only)
    - Number range: min and max number inputs
    - Number of rods: number input (1-13)
    - Question count: number input
    - Time limit: number input (seconds, optional)
    - Flash duration: number input (ms, for mental_math)
    - Pass percentage: number input (default 80)
  - Tutorial content section (shown only when level_type=tutorial):
    - Steps list: each step has instruction (EN), instruction_bn, target_value (number), highlight_rods (comma-separated numbers)
    - Add step / remove step buttons
  - Save button → `PUT /abacus/levels/{level_id}`
  - Delete button → `DELETE /abacus/levels/{level_id}`
- "Add Level" button at bottom → `POST /abacus/{courseId}/levels`
- Up/down reorder buttons on each level card

**Right sidebar:**
- Course settings (active status)
- Pricing card (same as exam/game)
- Product attachments (same pattern)
- Recent attempts list
- Preview button for each level → `/abacus/{slug}/level/{levelId}?preview=true`

**API calls:**
- Load: `GET /abacus/{id}/admin`
- Save level: `PUT /abacus/levels/{levelId}`
- Add level: `POST /abacus/{courseId}/levels`
- Delete level: `DELETE /abacus/levels/{levelId}`
- Save pricing: `PUT /abacus/{courseId}`
- Attach/detach: `POST/DELETE /abacus/{courseId}/attach/{productId}`
- Attempts: `GET /abacus/{courseId}/attempts`

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add frontend/src/app/admin/abacus/
git commit -m "feat(abacus): add admin course/level editor page"
```

---

### Task 5: Public — Course Listing Page

**Files:**
- Create: `frontend/src/app/abacus/page.tsx`

- [ ] **Step 1: Create listing page**

Kid-friendly listing page at `/abacus`. Same animated style as games listing but with abacus theming.

- Hero section: gradient background (warm amber/orange tones), "Abacus World" title with animation, floating bead/abacus emojis (🧮 🔢 🧠)
- Search bar
- Course cards grid: thumbnail, title, level count badge, price/free badge, progress bar if enrolled
- Loading skeleton, empty state

**API:** `GET /abacus/?page=1&page_size=20&search=...`

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add frontend/src/app/abacus/page.tsx
git commit -m "feat(abacus): add public course listing page"
```

---

### Task 6: Public — Course Detail with Level Map

**Files:**
- Create: `frontend/src/app/abacus/[slug]/page.tsx`

- [ ] **Step 1: Create course detail page with level progression map**

This is the key page — shows the level map as a vertical progression path.

**Page structure:**

1. **Hero**: course background/thumbnail, title, description, price
2. **Child selector**: dropdown (same as exams/games)
3. **Level map**: vertical progression path
   - Each level is a node on the path connected by a dotted/dashed line
   - **Completed levels**: green circle with ✓ + stars earned (⭐⭐⭐) + title. Click to replay.
   - **Current level** (next to complete): large glowing purple circle, pulsing animation, "Start" button, title. This is the active one.
   - **Locked levels**: gray circle with 🔒 icon, grayed-out title, dotted connector. Not clickable.
   - The path line connecting levels: solid green for completed section, dashed gray for locked
   - Progress text: "Level 5/12"

4. **Bottom**: "Go Back" link to `/abacus`

**API calls:**
- `GET /abacus/slug/{slug}` — course metadata
- `GET /abacus/{courseId}/progress?child_profile_id={childId}` — level unlock/completion state
- Click "Start" → navigate to `/abacus/{slug}/level/{levelId}?child={childId}`

Use Framer Motion for entrance animations on the level nodes (stagger in from bottom).

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add frontend/src/app/abacus/[slug]/page.tsx
git commit -m "feat(abacus): add course detail page with level progression map"
```

---

### Task 7: Level Play Page Shell

**Files:**
- Create: `frontend/src/app/abacus/[slug]/level/[levelId]/page.tsx`

- [ ] **Step 1: Create level play page shell**

Full-screen level play page. Same pattern as game play page. This is a SHELL — the abacus component and exercise engines come in Plan 2.

**Structure:**
- Load level via `GET /abacus/levels/{levelId}/start?child_profile_id={childId}&preview={isPreview}`
- Full-screen with warm gradient background (amber/orange tones)
- Top bar: level title, timer (counting up), progress (question N/total), exit button
- Game container: centered white card

**Engine dispatch (placeholders for now):**
```tsx
{level.level_type === "tutorial" && <div>Tutorial Engine — Coming in Plan 2<br/><button onClick={...}>Complete</button></div>}
{level.level_type === "test" && level.exercise_type === "bead_slide" && <div>Bead Slide Test — Coming in Plan 2<br/><button onClick={...}>Complete</button></div>}
{level.level_type === "test" && level.exercise_type === "mental_math" && <div>Mental Math Test — Coming in Plan 2<br/><button onClick={...}>Complete</button></div>}
{level.level_type === "test" && level.exercise_type === "mixed" && <div>Mixed Test — Coming in Plan 2<br/><button onClick={...}>Complete</button></div>}
{level.level_type === "practice" && <div>Practice Mode — Coming in Plan 2<br/><button onClick={...}>Complete</button></div>}
```

**Completion screen**: same celebration pattern as games (confetti, stars, score). For test levels, show pass/fail result. Submit via `POST /abacus/levels/{levelId}/submit`.

**Preview mode**: `?preview=true` skips access/unlock checks and submit (same as games).

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add frontend/src/app/abacus/
git commit -m "feat(abacus): add level play page shell with timer, celebration, engine dispatch"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Verify backend**

```bash
cd backend && alembic upgrade head
python -c "from app.main import create_app; print('OK')"
```

- [ ] **Step 2: Test admin flow**

1. Go to `/admin?tab=abacus`
2. Create course with "Load default curriculum" checked
3. Verify 12 levels appear in editor
4. Edit a level's config, save, verify persistence
5. Set pricing, attach product

- [ ] **Step 3: Test public pages**

1. `/abacus` — listing shows course
2. `/abacus/{slug}` — level map shows with correct lock/unlock state
3. Click current level → play page loads with placeholder

- [ ] **Step 4: Test level shell**

1. Play page shows timer and placeholder engine
2. Click "Complete" → celebration + submit works
3. Back to level map → level shows as completed, next level unlocked
