# Drawing Canvas + Badge System — Plan 2: Daily Challenges + Challenge Badges

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the daily challenge system — admin creates drawing prompts, kids submit artwork for challenges, submissions go through parent approval, approved submissions appear in the gallery filtered by challenge. Wire the `challenge_streak` badge trigger.

**Depends on:** Plan 1 (completed) — Badge engine, DrawingCanvas, gallery, badge wall all exist.

**Architecture:** Challenge is a standalone model. Submissions reuse the existing Drawing model (with `challenge_id` FK). Challenge APIs follow the same patterns as badges/drawings. Frontend pages reuse existing DrawingCanvas and gallery components.

**Tech Stack:** Python/FastAPI, SQLAlchemy, Alembic, PostgreSQL, Next.js/React, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-17-drawing-canvas-badge-system-design.md` — Subsystem 3

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/models/challenge.py` | Create | Challenge model |
| `backend/app/models/__init__.py` | Modify | Export Challenge |
| `backend/app/models/drawing.py` | Modify | Add challenge FK relationship |
| `backend/alembic/versions/..._add_challenge_table.py` | Create | Migration |
| `backend/app/api/v1/challenges.py` | Create | Challenge admin CRUD + public listing |
| `backend/app/main.py` | Modify | Register challenges router |
| `backend/app/services/badge_service.py` | Modify | Add challenge_streak trigger |
| `frontend/src/app/challenges/page.tsx` | Create | Active challenges list |
| `frontend/src/app/challenges/[id]/page.tsx` | Create | Challenge detail + submit drawing |
| `frontend/src/app/admin/page.tsx` | Modify | Add Challenges tab |
| `frontend/src/components/admin/AdminLayout.tsx` | Modify | Add Challenges sidebar entry |
| `frontend/src/app/gallery/page.tsx` | Modify | Add challenge filter to gallery |

---

### Task 1: Challenge Model + Migration

**Files:**
- Create: `backend/app/models/challenge.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/drawing.py`
- Create: migration file

- [ ] **Step 1: Create challenge model**

Create `backend/app/models/challenge.py`:

```python
"""Challenge models — daily/weekly drawing challenges."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    title_bn = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    description_bn = Column(Text, nullable=True)
    reference_image_url = Column(String(1000), nullable=True)
    challenge_type = Column(String(20), default="drawing")  # drawing | text | both
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)  # null = no end
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    drawings = relationship("Drawing", back_populates="challenge", lazy="noload")
```

- [ ] **Step 2: Add challenge relationship to Drawing model**

In `backend/app/models/drawing.py`, add a ForeignKey to the `challenge_id` column and a `challenge` relationship:

Change:
```python
challenge_id = Column(UUID(as_uuid=True), nullable=True)  # FK added in Phase 2 when Challenge model exists
```
To:
```python
challenge_id = Column(UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="SET NULL"), nullable=True)
```

Add relationship:
```python
challenge = relationship("Challenge", back_populates="drawings")
```

- [ ] **Step 3: Export model + create migration**

Add to `backend/app/models/__init__.py` (after Drawings section):
```python
# Challenges
from app.models.challenge import Challenge  # noqa: F401
```

Generate alembic migration (autogenerate will detect the new table + FK change), then run it.

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat(challenges): add Challenge model, FK on Drawing, migration"
```

---

### Task 2: Challenge API

**Files:**
- Create: `backend/app/api/v1/challenges.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create challenges API**

Create `backend/app/api/v1/challenges.py`. Follow games/badges API pattern.

**Admin endpoints (PermissionChecker([Permission.COURSE_CREATE])):**
- `POST /challenges/` — create challenge (title, title_bn, description, description_bn, reference_image_url, challenge_type, starts_at, ends_at)
- `PUT /challenges/{id}` — update challenge
- `GET /challenges/admin` — list all challenges (including inactive), ordered by starts_at desc
- `DELETE /challenges/{id}` — delete challenge

**Public endpoints:**
- `GET /challenges/` — list active challenges where starts_at <= now and (ends_at is null or ends_at > now), ordered by starts_at desc
- `GET /challenges/{id}` — challenge detail + submission_count (count of approved drawings with this challenge_id)
- `GET /challenges/today` — today's active challenge (the most recent active challenge whose starts_at <= now). Return single challenge or null.

**Student endpoints (get_current_user):**
- `GET /challenges/{id}/my-submission?child_profile_id=...` — check if child already submitted a drawing for this challenge. Return the drawing if exists, null if not.

- [ ] **Step 2: Register router in main.py**

Add import + include_router for challenges.

- [ ] **Step 3: Verify and commit**

```bash
cd backend && python -c "from app.main import create_app; print('OK')"
git add backend/
git commit -m "feat(challenges): add challenge admin CRUD and public listing APIs"
```

---

### Task 3: Wire challenge_streak Badge Trigger

**Files:**
- Modify: `backend/app/services/badge_service.py`

- [ ] **Step 1: Add challenge_streak counting**

In `BadgeService._get_count`, add a handler for `trigger == "challenge_streak"`:

```python
if trigger == "challenge_streak":
    # Count distinct dates where the child submitted a challenge drawing
    # that was approved, looking for consecutive days ending today
    from datetime import date, timedelta
    from sqlalchemy import cast, Date as SADate

    # Get all distinct dates with approved challenge submissions
    result = await db.execute(
        select(func.distinct(cast(Drawing.created_at, SADate)))
        .where(
            Drawing.child_profile_id == child_profile_id,
            Drawing.challenge_id.isnot(None),
            Drawing.status == "approved",
        )
        .order_by(cast(Drawing.created_at, SADate).desc())
    )
    dates = [row[0] for row in result.all()]

    if not dates:
        return 0

    # Count consecutive days ending from the most recent date
    streak = 1
    for i in range(1, len(dates)):
        if dates[i - 1] - dates[i] == timedelta(days=1):
            streak += 1
        else:
            break
    return streak
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/badge_service.py
git commit -m "feat(badges): add challenge_streak trigger to BadgeService"
```

---

### Task 4: Challenges List Page

**Files:**
- Create: `frontend/src/app/challenges/page.tsx`

- [ ] **Step 1: Create the challenges list page**

Active challenges at `/challenges`.

**Structure:**
- Kid-friendly header: "Drawing Challenges 🎯" / "আঁকার চ্যালেঞ্জ 🎯" with gradient
- "Today's Challenge" highlighted card at top (fetched from `GET /challenges/today`). If exists: large card with title, description, reference image, "Start Drawing" button. If none: "No challenge today" message.
- Below: grid of other active challenges (from `GET /challenges/`), 2 cols desktop, 1 mobile
- Each challenge card: title (bilingual), description excerpt, reference image thumbnail (if any), deadline (if ends_at), submission count
- Click card → navigate to `/challenges/{id}`
- Auth not required to view, but submission requires login

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/challenges/
git commit -m "feat(challenges): add challenges list page with today's challenge highlight"
```

---

### Task 5: Challenge Detail + Submit Page

**Files:**
- Create: `frontend/src/app/challenges/[id]/page.tsx`

- [ ] **Step 1: Create the challenge detail and submission page**

Challenge detail at `/challenges/[id]`.

**Structure:**
- Challenge info: title (bilingual), full description, reference image (large, if any), deadline
- Submission status: if child already submitted (check `GET /challenges/{id}/my-submission?child_profile_id=...`), show their drawing thumbnail + status badge. If not, show the canvas.
- Canvas area: `<DrawingCanvas onSave={handleSave} challengePrompt={challenge.title} />`
- Save flow: same as `/draw` page — upload blob, then `POST /drawings/` with `challenge_id` set to this challenge's ID + child_profile_id + title
- After save: success message, link to "View my submission" or "Back to challenges"
- Child selector dropdown (same pattern as draw page)
- Auth required for submission; redirect to login if not authenticated (with _hasHydrated guard)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/challenges/
git commit -m "feat(challenges): add challenge detail page with canvas submission flow"
```

---

### Task 6: Admin — Challenges Tab

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`
- Modify: `frontend/src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: Add Challenges tab to admin dashboard**

In `admin/page.tsx`:
1. Add `"challenges"` to the Tab type union and validTabs array
2. Add state: `challengesData`, `showChallengeForm`, `editChallenge`, `challengeForm`
3. Add data loading for challenges tab: `GET /challenges/admin`
4. Add tab content:
   - Table: Title (bilingual), Type badge (drawing/text/both), Starts At, Ends At, Active status, Actions (Edit/Delete)
   - "Create Challenge" button → modal: title, title_bn, description, description_bn, reference_image_url (text input), challenge_type dropdown (drawing|text|both), starts_at (datetime-local input), ends_at (datetime-local input, optional), is_active toggle
   - Edit via same modal in edit mode
   - Delete with showConfirm pattern

**API:** `GET /challenges/admin`, `POST /challenges/`, `PUT /challenges/{id}`, `DELETE /challenges/{id}`

- [ ] **Step 2: Add sidebar entry in AdminLayout**

In the Content group, add after "gallery":
```typescript
{ id: "challenges", bn: "চ্যালেঞ্জ", en: "Challenges", icon: Target },
```

Import `Target` from lucide-react.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add frontend/src/app/admin/page.tsx frontend/src/components/admin/AdminLayout.tsx
git commit -m "feat(admin): add Challenges management tab"
```

---

### Task 7: Gallery — Challenge Filter

**Files:**
- Modify: `frontend/src/app/gallery/page.tsx`

- [ ] **Step 1: Add challenge filter to gallery**

The gallery currently has sort tabs (Recent/Popular/Featured). Add a "Challenges" filter:

1. Fetch active challenges list from `GET /challenges/` on mount
2. Add a challenge filter dropdown/pills above or beside the sort tabs: "All Drawings" | specific challenge names
3. When a challenge is selected, pass `challenge_id` query param to the gallery API: `GET /drawings/gallery?challenge_id={id}&sort=recent`
4. Show challenge name + description as a banner when a challenge filter is active

**Backend change needed:** The drawings gallery endpoint needs to accept an optional `challenge_id` query param. Modify `backend/app/api/v1/drawings.py` — add `challenge_id: Optional[UUID] = Query(None)` to the gallery endpoint and filter drawings accordingly.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/gallery/page.tsx backend/app/api/v1/drawings.py
git commit -m "feat(gallery): add challenge filter to gallery page and API"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Backend check**

```bash
cd backend && alembic upgrade head
python -c "from app.main import create_app; print('OK')"
```

- [ ] **Step 2: Frontend check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Test challenge admin flow**

1. Go to `/admin?tab=challenges`
2. Create challenge: "Draw Your Pet" with type=drawing, starts_at=today
3. Verify challenge appears in table

- [ ] **Step 4: Test challenge submission flow**

1. Go to `/challenges` — challenge appears
2. Click challenge → canvas loads with challenge prompt
3. Draw something, save
4. Verify drawing saved with challenge_id in `/drawings`

- [ ] **Step 5: Test gallery challenge filter**

1. Go to `/gallery` — challenge filter shows
2. Select the challenge — only drawings for that challenge appear

- [ ] **Step 6: Test challenge streak badge**

1. Create badge with trigger=challenge_streak, threshold=1
2. Submit + approve a challenge drawing
3. Verify badge awarded
