# Games Module — Plan 1: Backend Foundation + Admin + Listing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete backend for the games module (models, API, entitlements), the admin game editor, and the public games listing page — so that games can be created, priced, and browsed. Game *play* UIs are in Plans 2 & 3.

**Architecture:** Follows the exam pattern exactly — `Game` model with 1:1 Product FK, `ProductGame` for many-to-many attachment, `GameAttempt` for tracking plays. All game-type-specific content stored in a JSONB `config` column. Frontend reuses existing admin patterns (exam editor layout) and builds a kid-themed listing page.

**Tech Stack:** Python/FastAPI, SQLAlchemy, Alembic, PostgreSQL, Next.js/React, Tailwind CSS, Framer Motion

**Spec:** `docs/superpowers/specs/2026-04-15-games-module-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/models/enums.py` | Modify | Add `GAME` to ProductType, `GAME_ACCESS` to EntitlementType |
| `backend/app/models/game.py` | Create | Game, GameAttempt, ProductGame models |
| `backend/app/models/__init__.py` | Modify | Export game models |
| `backend/app/models/product.py` | Modify | Add `game` relationship to Product |
| `backend/app/services/entitlement_service.py` | Modify | Add GAME case in `_grant_for_product` |
| `backend/alembic/versions/l2m3n4o5p6q7_add_games_tables.py` | Create | Migration for games tables + enum values |
| `backend/app/api/v1/games.py` | Create | Full games API (admin CRUD, public listing, student start/submit) |
| `backend/app/main.py` | Modify | Register games router |
| `frontend/src/app/admin/games/[id]/page.tsx` | Create | Admin game editor page |
| `frontend/src/app/games/page.tsx` | Create | Public games listing page (kid-themed) |
| `frontend/src/app/games/[slug]/page.tsx` | Create | Game detail/landing page |
| `frontend/src/app/games/[slug]/play/page.tsx` | Create | Game play page (shell — renders game engine by type) |
| `public/game-themes/` | Create | Default themed background SVGs (6 files) |

---

### Task 1: Add Enum Values

**Files:**
- Modify: `backend/app/models/enums.py`

- [ ] **Step 1: Add GAME to ProductType enum**

In `backend/app/models/enums.py`, add `GAME = "game"` to the `ProductType` enum after `EXAM`:

```python
class ProductType(str, enum.Enum):
    COURSE = "course"
    EBOOK = "ebook"
    PHYSICAL_BOOK = "physical_book"
    BUNDLE = "bundle"
    EXAM = "exam"
    GAME = "game"
```

- [ ] **Step 2: Add GAME_ACCESS to EntitlementType enum**

In the same file, add `GAME_ACCESS = "game_access"` to `EntitlementType`:

```python
class EntitlementType(str, enum.Enum):
    COURSE_ACCESS = "course_access"
    EBOOK_DOWNLOAD = "ebook_download"
    PHYSICAL_SHIPMENT = "physical_shipment"
    EXAM_ACCESS = "exam_access"
    GAME_ACCESS = "game_access"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/enums.py
git commit -m "feat(games): add GAME product type and GAME_ACCESS entitlement type"
```

---

### Task 2: Create Game Models

**Files:**
- Create: `backend/app/models/game.py`

- [ ] **Step 1: Create the game models file**

```python
"""Game models — games, attempts, and product-game links."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class Game(Base):
    __tablename__ = "games"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    game_type = Column(String(30), nullable=False)  # memory | drag_drop | crossword | find_words | image_sequence | arithmetic
    difficulty = Column(String(20), default="easy")  # easy | medium | hard
    background_image_url = Column(String(1000), nullable=True)  # null = use default per game_type
    time_limit_seconds = Column(Integer, nullable=True)  # null = no limit, timer still tracks
    is_active = Column(Boolean, default=True)
    config = Column(JSONB, default=dict)  # game-type-specific content
    total_plays = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="game")
    attempts = relationship("GameAttempt", back_populates="game", lazy="noload")


class GameAttempt(Base):
    __tablename__ = "game_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Integer, default=0)
    total_points = Column(Integer, default=0)
    time_seconds = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    stars = Column(Integer, default=0)  # 0-3
    attempt_data = Column(JSONB, default=dict)  # game-type-specific results
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    game = relationship("Game", back_populates="attempts")
    user = relationship("User")
    child = relationship("ChildProfile")


class ProductGame(Base):
    __tablename__ = "product_games"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
```

- [ ] **Step 2: Add game relationship to Product model**

In `backend/app/models/product.py`, add after the `exam` relationship (around line 43):

```python
    game = relationship("Game", back_populates="product", uselist=False, lazy="noload")
```

- [ ] **Step 3: Export game models in __init__.py**

In `backend/app/models/__init__.py`, add at the end:

```python
# Games
from app.models.game import Game, GameAttempt, ProductGame  # noqa: F401
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/game.py backend/app/models/product.py backend/app/models/__init__.py
git commit -m "feat(games): add Game, GameAttempt, ProductGame models"
```

---

### Task 3: Database Migration

**Files:**
- Create: `backend/alembic/versions/l2m3n4o5p6q7_add_games_tables.py`

- [ ] **Step 1: Find the current alembic head revision**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend && alembic heads`

Note the revision ID — use it as `down_revision` in the migration.

- [ ] **Step 2: Create migration file**

Create `backend/alembic/versions/l2m3n4o5p6q7_add_games_tables.py`:

```python
"""Add games tables

Revision ID: l2m3n4o5p6q7
Revises: <HEAD_FROM_STEP_1>
Create Date: 2026-04-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "l2m3n4o5p6q7"
down_revision: Union[str, None] = "<HEAD_FROM_STEP_1>"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Games table
    op.create_table(
        "games",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("game_type", sa.String(30), nullable=False),
        sa.Column("difficulty", sa.String(20), server_default="easy"),
        sa.Column("background_image_url", sa.String(1000), nullable=True),
        sa.Column("time_limit_seconds", sa.Integer, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("config", JSONB, server_default="{}"),
        sa.Column("total_plays", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Game attempts table
    op.create_table(
        "game_attempts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("game_id", UUID(as_uuid=True), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_profile_id", UUID(as_uuid=True), sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer, server_default="0"),
        sa.Column("total_points", sa.Integer, server_default="0"),
        sa.Column("time_seconds", sa.Integer, server_default="0"),
        sa.Column("completed", sa.Boolean, server_default="false"),
        sa.Column("stars", sa.Integer, server_default="0"),
        sa.Column("attempt_data", JSONB, server_default="{}"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Product-game attachments table
    op.create_table(
        "product_games",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("game_id", UUID(as_uuid=True), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("product_games")
    op.drop_table("game_attempts")
    op.drop_table("games")
```

- [ ] **Step 3: Run migration**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend && alembic upgrade head`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/l2m3n4o5p6q7_add_games_tables.py
git commit -m "feat(games): add database migration for games, game_attempts, product_games"
```

---

### Task 4: Update Entitlement Service

**Files:**
- Modify: `backend/app/services/entitlement_service.py`

- [ ] **Step 1: Add GAME to the physical_only skip list**

Around line 152, update the `physical_only` skip to include GAME:

```python
        if physical_only and product.product_type in (ProductType.COURSE, ProductType.EBOOK, ProductType.EXAM, ProductType.GAME):
            return created
```

- [ ] **Step 2: Add GAME case in _grant_for_product**

After the `EXAM` case block (around line 223) and before the `PHYSICAL_BOOK` case, add:

```python
        elif product.product_type == ProductType.GAME:
            if not await _exists(EntitlementType.GAME_ACCESS):
                ent = Entitlement(
                    user_id=user_id,
                    child_profile_id=child_profile_id,
                    product_id=product.id,
                    order_item_id=order_item_id,
                    entitlement_type=EntitlementType.GAME_ACCESS.value,
                )
                db.add(ent)
                created.append(ent)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/entitlement_service.py
git commit -m "feat(games): add GAME_ACCESS entitlement granting in entitlement service"
```

---

### Task 5: Create Games API

**Files:**
- Create: `backend/app/api/v1/games.py`

This is the largest backend task. The API follows the exam API pattern exactly. Create `backend/app/api/v1/games.py` with the following structure:

- [ ] **Step 1: Create the games API file with schemas and helpers**

The file should contain:

**Schemas (Pydantic):**
- `GameCreateRequest`: title, title_bn, slug, description, description_bn, thumbnail_url, price, compare_price, is_free, game_type, difficulty, background_image_url, time_limit_seconds, config (dict)
- `GameUpdateRequest`: all fields optional
- `GameConfigUpdateRequest`: config (dict)
- `GameSubmitRequest`: child_profile_id, score, total_points, time_seconds, completed, stars, attempt_data (dict)

**Helper function:**
- `_get_game_response(game_id, db, admin=False)`: Serializes game with product fields. If `admin=True`, includes full config. If `admin=False`, returns config with correct answers stripped based on game_type (for crossword/find_words — strip the grid solution; for drag_drop — strip correct_item_ids).

**Default backgrounds map:**
```python
DEFAULT_BACKGROUNDS = {
    "memory": "/game-themes/memory-default.svg",
    "drag_drop": "/game-themes/dragdrop-default.svg",
    "crossword": "/game-themes/crossword-default.svg",
    "find_words": "/game-themes/findwords-default.svg",
    "image_sequence": "/game-themes/sequence-default.svg",
    "arithmetic": "/game-themes/arithmetic-default.svg",
}
```

**Admin endpoints:**
- `POST /games/` — Create game (product + game record). Same pattern as `create_exam`.
- `PUT /games/{game_id}` — Update game settings + product fields. Same pattern as `update_exam`.
- `PUT /games/{game_id}/config` — Update game config (JSONB). Separate endpoint so config can be saved independently.
- `GET /games/{game_id}/admin` — Get full game with config (admin view).
- `POST /games/{game_id}/attach/{product_id}` — Attach game to product (ProductGame link).
- `DELETE /games/{game_id}/attach/{product_id}` — Detach.
- `GET /games/{game_id}/attempts` — List all attempts (admin view). Returns child name, score, stars, time, completion date.

**Public endpoints:**
- `GET /games/` — List all active games with product info (paginated, filterable by game_type and difficulty, searchable by title). Returns: id, title, title_bn, slug, thumbnail_url, game_type, difficulty, background_image_url (with default fallback), price, is_free, total_plays.
- `GET /games/slug/{slug}` — Game detail by product slug (no config, just metadata + play count).
- `GET /games/product/{product_id}/attached` — Games attached to a product.

**Student endpoints:**
- `GET /games/{game_id}/start?child_profile_id=...` — Get game config to play. Access check: same logic as exam start (free bypass → direct entitlement → parent entitlement → attached product entitlement). Returns full config. For competitive game types, strip answers (e.g., crossword grid solution, drag_drop correct_item_ids).
- `POST /games/{game_id}/submit` — Submit attempt. Save GameAttempt, increment total_plays on Game. Returns the saved attempt with stars.
- `GET /games/my` — List games the user has access to (direct entitlements + attached via products + free games).

Follow the exact patterns from `backend/app/api/v1/exams.py` — same imports, same permission checks (`PermissionChecker`, `get_current_user`), same pagination, same error handling.

- [ ] **Step 2: Verify the API file imports correctly**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend && python -c "from app.api.v1.games import router; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/games.py
git commit -m "feat(games): add complete games API — admin CRUD, public listing, student start/submit"
```

---

### Task 6: Register Games Router

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add games router import and registration**

In `backend/app/main.py`, add after the exams router import (around line 167):

```python
    from app.api.v1.games import router as games_router
```

And add after the exams include_router (around line 193):

```python
    app.include_router(games_router, prefix=settings.API_V1_PREFIX)
```

- [ ] **Step 2: Verify backend starts**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend && python -c "from app.main import create_app; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(games): register games API router"
```

---

### Task 7: Default Game Theme Backgrounds

**Files:**
- Create: `frontend/public/game-themes/memory-default.svg`
- Create: `frontend/public/game-themes/dragdrop-default.svg`
- Create: `frontend/public/game-themes/crossword-default.svg`
- Create: `frontend/public/game-themes/findwords-default.svg`
- Create: `frontend/public/game-themes/sequence-default.svg`
- Create: `frontend/public/game-themes/arithmetic-default.svg`

- [ ] **Step 1: Create the game-themes directory and 6 SVG backgrounds**

Each SVG should be a colorful, kid-friendly cartoon-style background (approximately 800×600 viewBox). Use soft gradients, rounded shapes, scattered playful elements:

- **memory-default.svg**: Soft purple/blue gradient background with scattered star shapes, cloud doodles, and playing card silhouettes. Playful and magical feeling.
- **dragdrop-default.svg**: Warm orange/yellow gradient with floating geometric shapes (circles, triangles, squares) and dotted movement trails. Workspace energy.
- **crossword-default.svg**: Cream/white notebook-style background with faint ruled lines, pencil doodles in margins, small eraser and pencil illustrations scattered around edges.
- **findwords-default.svg**: Teal/green gradient with magnifying glass illustrations, small footprint trails, and detective-style magnifying circles scattered around. Discovery theme.
- **sequence-default.svg**: Sky blue gradient with puzzle piece shapes floating around, some connected, some scattered. Jigsaw/ordering theme.
- **arithmetic-default.svg**: Green chalkboard-style background with chalk-drawn numbers (1-9), plus/minus symbols, and small stars scattered around. Fun classroom feeling.

Each SVG should be fairly minimal (under 5KB), using `<linearGradient>`, `<circle>`, `<rect>`, `<path>` elements. These are backgrounds, so they should be subtle enough to not distract from game content overlaid on top. Use low opacity (0.1-0.3) for decorative elements.

- [ ] **Step 2: Commit**

```bash
git add frontend/public/game-themes/
git commit -m "feat(games): add default themed background SVGs for all 6 game types"
```

---

### Task 8: Admin Game Editor Page

**Files:**
- Create: `frontend/src/app/admin/games/[id]/page.tsx`

- [ ] **Step 1: Create the admin game editor page**

This page mirrors the exam editor layout at `frontend/src/app/admin/exams/[id]/page.tsx`. Study that file's patterns and replicate the structure for games.

**Page layout: left content (8 cols) + right sidebar (4 cols)**

**Left column — Game Content Editor:**

The content form switches based on `game_type`. Each game type has its own config editing UI:

**Memory config form:**
- Grid size selector: dropdown with options "2x2", "2x3", "3x4", "4x4"
- Pairs list: each pair has image upload (1:1 square, reuse `POST /uploads/image` with `folder=game-images`) + label (EN) + label_bn (optional)
- Add pair / remove pair buttons
- Show current pair count vs required count for selected grid size

**Drag & Drop config form:**
- Two sections side by side: "Items" and "Targets"
- Items: each has image upload + content (EN) + content_bn. Add/remove buttons.
- Targets: each has image upload + label (EN) + label_bn + multi-select of which items belong to this target (using item IDs).
- Add/remove buttons for both.

**Crossword config form:**
- Word list: each entry has word (EN) + word_bn + clue (EN) + clue_bn
- Add word / remove word buttons

**Find Words config form:**
- Word list: each entry has word (EN) + word_bn
- Grid size input (default 10)
- Add word / remove word buttons

**Image Sequence config form:**
- Reference image upload (16:9 aspect-video)
- Ordered steps list: each step has image upload (1:1 square) + label (EN) + label_bn + sort_order
- Drag to reorder steps (or up/down buttons)
- Add step / remove step buttons

**Arithmetic config form:**
- Operation toggles: checkboxes for +, −, ×, ÷
- Number range: two number inputs (min, max)
- Question count: number input

**Right sidebar (same pattern as exam editor):**
- Game Settings card: difficulty dropdown, time limit input
- Background Image card: upload button with preview, "Use Default" reset option showing the default SVG preview
- Pricing card: price, compare_price, is_free (identical to exam)
- Product Attachments card: search + attach/detach (identical to exam)
- Recent Attempts card: list of attempts with child name, stars, score, time

**Top bar:**
- Back link to `/admin?tab=games`
- Game title
- **Preview button** — navigates to `/games/{slug}/play?preview=true` in a new tab

**API calls:**
- Load: `GET /games/{id}/admin`
- Save settings: `PUT /games/{id}` (title, difficulty, time_limit, pricing)
- Save config: `PUT /games/{id}/config` (the JSONB game content)
- Image upload: `POST /uploads/image` with `folder=game-images`
- Attach product: `POST /games/{id}/attach/{productId}`
- Detach product: `DELETE /games/{id}/attach/{productId}`
- Load attempts: `GET /games/{id}/attempts`

**State management:** Same pattern as exam editor — separate form states for settings, pricing, and config. Toast notifications for success/error.

- [ ] **Step 2: Verify the page compiles**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/games/
git commit -m "feat(games): add admin game editor page with config forms for all 6 game types"
```

---

### Task 9: Games Listing Page

**Files:**
- Create: `frontend/src/app/games/page.tsx`

- [ ] **Step 1: Create the games listing page with full gaming vibes**

This is the kid-facing games listing. It should feel like entering a game world — NOT a standard product listing. Heavy use of Framer Motion animations, vibrant colors, playful elements.

**Page structure:**

1. **Animated Hero Section:**
   - Full-width gradient background: purple (#5341CD) → blue (#3B82F6) → pink (#EC4899) with animated shifting
   - "গেম জোন" / "Game Zone" title with Framer Motion spring bounce animation (text scales in from 0)
   - Floating animated game icons around the title: 🎮 🧩 🎯 🔢 🃏 — each with independent float animation (subtle up/down oscillation with different delays)
   - Subtle particle background: small circles/stars floating upward with low opacity, using Framer Motion infinite animations
   - Search bar centered below title: rounded-full input with playful magnifying glass icon, purple focus border

2. **Filter Section:**
   - Game type filters as illustrated icon tabs in a horizontal scrollable row:
     - "All" (🎮), "Memory" (🃏), "Drag & Drop" (🎯), "Crossword" (✏️), "Find Words" (🔍), "Sequencing" (🧩), "Math" (🔢)
     - Active tab: scaled up, colored background with bounce animation, glow shadow
     - Inactive: subtle background, hover scale effect
   - Difficulty filter: three star-badge buttons (⭐ Easy, ⭐⭐ Medium, ⭐⭐⭐ Hard) — toggleable

3. **Game Cards Grid:**
   - Responsive: 1 col mobile, 2 col tablet (sm), 3 col desktop (lg)
   - Each card:
     - Background: game's themed background image (or default) fills the card entirely
     - Game type icon badge: top-left, small rounded pill with icon + type name, semi-transparent dark background
     - Difficulty stars: top-right, small star icons (1/2/3 filled)
     - Bottom overlay: gradient scrim (transparent → dark) with title, play count ("🎮 243"), and price badge
     - Hover effect: Framer Motion `whileHover={{ scale: 1.03, rotateY: 3 }}` for subtle 3D tilt + shadow increase
     - Click: navigates to `/games/{slug}`
     - Price: "FREE" in a green badge or "৳199" in a purple badge
   - Staggered entrance animation: each card fades in with slight upward motion, staggered by 0.05s

4. **States:**
   - Loading: animated shimmer skeleton cards (3 across)
   - Empty: playful illustration with "কোনো গেম পাওয়া যায়নি" text and bouncing sad-face animation
   - Error: standard error card with retry button

**API call:** `GET /games/?page=1&page_size=20&game_type=memory&difficulty=easy&search=...`

**Imports needed:** `motion` from `motion/react`, lucide icons, `api` from `@/lib/api`, `useLocaleStore`, `useAuthStore`, standard React hooks.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/games/page.tsx
git commit -m "feat(games): add kid-themed games listing page with animations and filters"
```

---

### Task 10: Game Detail Page

**Files:**
- Create: `frontend/src/app/games/[slug]/page.tsx`

- [ ] **Step 1: Create the game detail/landing page**

This is the page a kid/parent sees before playing. Shows game info, pricing, and a "Play" button.

**Page structure:**

1. **Hero section:**
   - Game's themed background image as full-width hero (with overlay gradient for readability)
   - Game type badge (e.g., "🃏 Memory Game") — large, styled pill
   - Game title — large, white, bold
   - Difficulty stars
   - Description text (bilingual)

2. **Info cards row:**
   - Time limit card (if set): clock icon + "2 minutes"
   - Difficulty card: star icons + "Easy/Medium/Hard"
   - Total plays card: gamepad icon + count
   - Best score card (if user has played before): trophy icon + stars

3. **Play button:**
   - Large, centered, prominent — gradient purple button with gamepad icon
   - "খেলা শুরু করো" / "Start Playing"
   - If paid + no access: show price and "কিনুন" (Buy) button instead
   - If requires child selection: child profile picker (same pattern as exam)

4. **Price section (if not free):**
   - Price with compare price strikethrough
   - Add to cart / buy button

**API calls:**
- `GET /games/slug/{slug}` — game metadata
- Access check happens when user clicks Play → navigates to `/games/{slug}/play?child={childId}`

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/games/[slug]/page.tsx
git commit -m "feat(games): add game detail/landing page with hero, info cards, play button"
```

---

### Task 11: Game Play Page Shell

**Files:**
- Create: `frontend/src/app/games/[slug]/play/page.tsx`

- [ ] **Step 1: Create the game play page shell**

This is a full-screen immersive page that:
1. Loads the game config via `GET /games/{gameId}/start?child_profile_id=...`
2. Renders the themed background
3. Shows the floating top bar (title, timer, stars, exit button)
4. Based on `game_type`, renders the appropriate game engine component (placeholder components for now — Plans 2 & 3 will implement the actual engines)
5. On completion, shows the celebration screen and submits via `POST /games/{gameId}/submit`

**Page structure:**

1. **Themed background:** Full-screen, game's `background_image_url` (or default) as `background-image` with `background-size: cover`

2. **Floating top bar:** Fixed at top, semi-transparent backdrop-blur:
   - Left: game title (truncated)
   - Center: timer counting up — animated digit display. If `time_limit_seconds` set, shows countdown instead and pulses red in last 30s.
   - Right: star progress indicator (3 empty stars that fill as kid performs) + close button (X) with beforeunload confirmation

3. **Game container:** Centered, white/semi-transparent card with large rounded corners (`rounded-3xl`), max-width appropriate for game type. Contains the game engine.

4. **Game engine dispatch:**
```tsx
{game.game_type === "memory" && <MemoryEngine config={game.config} onComplete={handleComplete} />}
{game.game_type === "arithmetic" && <ArithmeticEngine config={game.config} onComplete={handleComplete} />}
{game.game_type === "drag_drop" && <DragDropEngine config={game.config} onComplete={handleComplete} />}
{game.game_type === "crossword" && <CrosswordEngine config={game.config} onComplete={handleComplete} />}
{game.game_type === "find_words" && <FindWordsEngine config={game.config} onComplete={handleComplete} />}
{game.game_type === "image_sequence" && <ImageSequenceEngine config={game.config} onComplete={handleComplete} />}
```

For now, each engine is a placeholder that shows "Coming Soon" and a "Complete" button for testing. Plans 2 & 3 replace these.

5. **Completion/Celebration screen:** Full overlay with:
   - Confetti particle explosion (Framer Motion: many small colored circles animating outward from center)
   - Stars earned: 3 large star SVGs that fill in one by one with spring animation
   - Score: counting-up number animation
   - Time: displayed with clock icon
   - Encouragement message: random pick from ["তুমি দারুণ করেছো!", "অসাধারণ!", "চমৎকার!", "বাহ! খুব ভালো!"]
   - "আবার খেলো" (Play Again) button — primary
   - "অন্য গেম" (Other Games) button — secondary, links to `/games`

6. **onComplete handler:**
   - Receives `{ score, total_points, time_seconds, stars, attempt_data }` from game engine
   - Calls `POST /games/{gameId}/submit` with the data
   - Shows celebration screen

**States:**
- Loading: full-screen themed background with centered spinner
- Error: error card with "ফিরে যাও" button
- Active: game engine + timer
- Complete: celebration overlay

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/games/[slug]/play/
git commit -m "feat(games): add game play page shell with timer, celebration screen, engine dispatch"
```

---

### Task 12: Add Games Tab to Admin Dashboard

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Add a "Games" tab to the admin dashboard**

The admin dashboard at `frontend/src/app/admin/page.tsx` has tabs for Courses, Exams, etc. Add a "Games" tab that:
- Shows a table of all games (fetched from `GET /games/?page=1&page_size=50` with admin auth)
- Columns: Title, Game Type (badge), Difficulty (stars), Plays, Price, Active status, Actions (Edit link)
- "Create Game" button in the header
- Create game modal: title, game_type dropdown (6 options), difficulty dropdown, submit → `POST /games/` → redirect to `/admin/games/{id}`

Follow the exact pattern of how exams are listed and created in the admin page.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat(games): add Games tab to admin dashboard with list and create modal"
```

---

### Task 13: End-to-End Verification

- [ ] **Step 1: Start backend and verify migration**

```bash
cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend && alembic upgrade head
```

- [ ] **Step 2: Test admin flow**

1. Go to `http://localhost:3001/admin?tab=games`
2. Click "Create Game" → fill title, select "memory", set difficulty
3. Verify redirect to game editor page
4. In the config form, add a few memory pairs with images
5. Save config, verify it persists on reload
6. Set pricing, background image, attach a product

- [ ] **Step 3: Test public listing**

1. Go to `http://localhost:3001/games`
2. Verify animated hero section with game icons
3. Verify game cards show with themed backgrounds
4. Test filters (game type tabs, difficulty stars)
5. Click a game card → game detail page

- [ ] **Step 4: Test game play shell**

1. From game detail, click "Play"
2. Verify themed background loads
3. Verify timer starts counting
4. Click the placeholder "Complete" button
5. Verify celebration screen shows with confetti + stars
6. Verify attempt is saved (check admin attempts list)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(games): complete Plan 1 — backend foundation, admin editor, listing, play shell"
```
