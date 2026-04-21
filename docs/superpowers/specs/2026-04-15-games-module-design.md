# Games Module — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Overview

A kid-first interactive games module for 0-12 year olds. Six game types, each a standalone product with free/paid pricing, attachable to courses/bundles. Every surface — from the listing page to the play screens — is designed to feel like a game world, not an education platform. Heavy use of Framer Motion animations, particle effects, playful illustrations, and vibrant color.

## Game Types

| Type | Admin Creates | System Generates |
|------|--------------|-----------------|
| Memory (card flip) | Image+label pairs, grid size | Card shuffle |
| Drag & Drop | Items + target zones (image/text) | — |
| Crossword | Words + clues (EN, BN optional) | Grid layout from word list |
| Find the Words | Word list | Letter grid with hidden words |
| Image Sequencing | Ordered images + reference background | Shuffle order |
| Arithmetic Quiz | Rules: operations, range, count | Random questions per attempt |

## Architecture

### Follows Exam Pattern

- `Game` model → 1:1 FK to `Product` (own slug, own price, own page)
- `ProductGame` model → many-to-many attachment to other products (same as `ProductExam`)
- New enum values: `ProductType.GAME`, `EntitlementType.GAME_ACCESS`
- Entitlement service grants `GAME_ACCESS` on purchase
- Access check: free games open to all, paid require entitlement (direct or via attached product)

### Database Models

#### Game

```
games
├── id (UUID PK)
├── product_id (UUID FK → products.id, unique, cascade)
├── game_type (String: memory | drag_drop | crossword | find_words | image_sequence | arithmetic)
├── difficulty (String: easy | medium | hard)
├── background_image_url (String, nullable — defaults per game type if null)
├── time_limit_seconds (Integer, nullable — null = no limit, timer still tracks)
├── is_active (Boolean, default true)
├── config (JSONB — game-type-specific content, see below)
├── total_plays (Integer, default 0 — denormalized counter)
├── created_at (DateTime)
```

#### Config JSONB by Game Type

**Memory:**
```json
{
  "grid": "3x4",
  "pairs": [
    { "image_url": "...", "label": "Horse", "label_bn": "ঘোড়া" },
    { "image_url": "...", "label": "Cat", "label_bn": "বিড়াল" }
  ]
}
```
Grid options: `2x2` (4 cards, 2 pairs), `2x3` (6 cards, 3 pairs), `3x4` (12 cards, 6 pairs), `4x4` (16 cards, 8 pairs).

**Drag & Drop:**
```json
{
  "items": [
    { "id": "item1", "content": "Horse", "content_bn": "ঘোড়া", "image_url": "..." }
  ],
  "targets": [
    { "id": "target1", "label": "Farm Animals", "label_bn": "খামারের প্রাণী", "image_url": "...", "correct_item_ids": ["item1"] }
  ]
}
```

**Crossword:**
```json
{
  "words": [
    { "word": "HORSE", "word_bn": "ঘোড়া", "clue": "A farm animal you can ride", "clue_bn": "খামারের প্রাণী যেটার উপর চড়া যায়" }
  ]
}
```
Grid layout auto-generated from word list using a placement algorithm. Words intersect on shared letters.

**Find the Words:**
```json
{
  "words": [
    { "word": "HORSE", "word_bn": "ঘোড়া" },
    { "word": "CAT", "word_bn": "বিড়াল" }
  ],
  "grid_size": 10
}
```
Letter grid auto-generated. Words placed horizontally, vertically, and diagonally. Remaining cells filled with random letters.

**Image Sequencing:**
```json
{
  "reference_image_url": "...",
  "steps": [
    { "image_url": "...", "label": "Step 1", "label_bn": "ধাপ ১", "sort_order": 0 },
    { "image_url": "...", "label": "Step 2", "label_bn": "ধাপ ২", "sort_order": 1 }
  ]
}
```
Reference image shown as hint. Steps shuffled for the kid to reorder.

**Arithmetic:**
```json
{
  "operations": ["+", "-"],
  "number_range": [1, 20],
  "question_count": 10
}
```
Questions auto-generated fresh each attempt. No negative results for subtraction. Division only when evenly divisible.

#### GameAttempt

```
game_attempts
├── id (UUID PK)
├── game_id (UUID FK → games.id, cascade)
├── child_profile_id (UUID FK → child_profiles.id, cascade)
├── user_id (UUID FK → users.id, cascade)
├── score (Integer — points earned)
├── total_points (Integer)
├── time_seconds (Integer — elapsed time)
├── completed (Boolean)
├── stars (Integer 0-3 — computed from performance)
├── attempt_data (JSONB — game-type-specific results)
├── started_at (DateTime)
├── completed_at (DateTime, nullable)
```

Stars calculation (computed on submit, not stored as rules):
- 3 stars: completed within excellent time threshold
- 2 stars: completed within good time threshold
- 1 star: completed regardless of time

Thresholds are per game type and scale with content size (more pairs = more time allowed).

#### ProductGame

```
product_games
├── id (UUID PK)
├── product_id (UUID FK → products.id, cascade)
├── game_id (UUID FK → games.id, cascade)
```
Same pattern as `ProductExam`. Allows attaching a game to courses, bundles, etc.

### Enum Additions

```python
# ProductType
GAME = "game"

# EntitlementType
GAME_ACCESS = "game_access"
```

### Entitlement Service Update

Add case in `_grant_for_product()`:
```
ProductType.GAME → create GAME_ACCESS entitlement
```

Access check in game start endpoint: same logic as exam (check direct entitlement → parent fallback → attached product entitlements → is_free bypass).

## Default Themed Backgrounds

Each game type ships with a built-in default cartoon background so games look great without admin effort. Admin can override with a custom upload.

| Game Type | Default Theme |
|-----------|--------------|
| Memory | Colorful card table with scattered stars and clouds |
| Drag & Drop | Playful workspace with floating shapes |
| Crossword | Notebook page with pencils and doodles |
| Find Words | Detective scene with magnifying glass |
| Image Sequence | Puzzle-piece landscape |
| Arithmetic | Fun chalkboard with cartoon numbers |

These are static SVG/illustration assets bundled with the frontend. Stored in `public/game-themes/`.

## Admin Panel

### Game List (in Admin Dashboard)

New "Games" tab in admin panel (alongside Courses, Exams, etc.). Table view of all games with: title, game type badge, difficulty badge, play count, price, active status.

### Game Editor Page (`/admin/games/[id]`)

Layout mirrors exam editor — left content area, right settings sidebar.

**Left: Game Content Editor**

Content form changes based on `game_type`:

- **Memory**: Grid size selector + pair list. Each pair: image upload (1:1 square) + label (EN) + label_bn (optional). Add/remove pairs.
- **Drag & Drop**: Two sections — "Items" (draggable things) and "Targets" (drop zones). Each has image + text. Admin maps which items go to which targets.
- **Crossword**: Word list with add/remove. Each word: word (EN) + word_bn + clue (EN) + clue_bn. Live preview of auto-generated grid.
- **Find Words**: Word list with add/remove. Each word: word (EN) + word_bn. Live preview of generated grid.
- **Image Sequence**: Reference image upload (16:9) + ordered step list. Each step: image upload (1:1) + label. Drag to reorder steps.
- **Arithmetic**: Operation toggles (+, −, ×, ÷), number range slider (min/max), question count input.

**Right Sidebar:**
- Game type (read-only after creation)
- Difficulty dropdown (Easy / Medium / Hard)
- Time limit (seconds, optional)
- Background image upload (with "Default" option showing preview of built-in theme)
- Pricing card (price, compare_price, is_free) — same as exam
- Product attachment search (same as exam)
- Recent attempts list (same as exam)

**Top Bar:**
- Back to admin
- Game title
- **Preview button** — opens the game in a modal exactly as a kid would see it, using current saved config

### Game Creation Flow

1. Admin clicks "Create Game" → modal: enter title, select game type, set difficulty
2. Creates Product (type=GAME) + Game record
3. Redirects to game editor page for content setup

## Student Experience

### Games Listing Page (`/games`)

**Full gaming vibes.** This is NOT a regular product listing — it's a game world entrance.

**Visual Design:**
- Animated hero section with floating game icons (cards, puzzle pieces, letters), parallax star field background, playful gradient (purple → blue → pink)
- "গেম জোন" / "Game Zone" title with bouncy text animation (Framer Motion spring)
- Animated mascot or character illustration welcoming kids
- Subtle particle effects (floating stars, bubbles) throughout the page

**Search & Filters:**
- Playful search bar with magnifying glass animation
- Game type filter as illustrated icon tabs (not plain text) — each game type has a cartoon icon. Active tab bounces/glows.
- Difficulty filter as star badges (1 star = Easy, 2 = Medium, 3 = Hard)

**Game Cards:**
- Themed background image as card cover (fills entire card, no white space)
- Game type icon badge (top-left, animated pulse)
- Difficulty stars (top-right)
- Title overlay at bottom with gradient scrim
- Hover: card tilts slightly (3D perspective transform), glows, scale up
- Price badge or "FREE" badge with playful styling
- Play count shown as a small "🎮 243 played" badge

**Loading state:** Animated skeleton cards with shimmer effect.
**Empty state:** Sad cartoon character saying "কোনো গেম পাওয়া যায়নি" with a bouncing animation.

### Game Play Page (`/games/[slug]/play`)

**Full-screen immersive game experience.** Background is the themed image (admin-set or default). No standard navbar — just a minimal floating top bar with:
- Game title (left)
- Timer counting up with animated digits (center) — pulses red in last 30 seconds if time limit set
- Star progress indicator (right) — fills in as kid performs
- Close/exit button (X, top-right) with "Are you sure?" confirmation

**Game Area:**
- Centered on screen over the themed background
- White/semi-transparent game container with large rounded corners and soft shadow
- All interactive elements are large and touch-friendly (min 48px tap targets)
- Sound-ready architecture (optional future: click sounds, match sounds) — no sound now, but don't block it

**Per-Game-Type UI:**

1. **Memory Game**
   - Card grid centered. Cards show "?" or a card-back pattern initially.
   - Flip animation: 3D CSS perspective transform (card rotates to reveal image)
   - Match: cards glow green + scale pulse + stay revealed
   - Mismatch: cards shake + flip back after 1s delay
   - All matched: burst of confetti particles

2. **Drag & Drop**
   - Items panel (left or top on mobile) with draggable cards
   - Target zones (right or bottom) with dashed borders and labels
   - Drag: item follows finger/cursor with slight rotation and shadow
   - Correct drop: target glows green, item snaps in with spring animation
   - Wrong drop: item bounces back to original position with shake
   - Touch support via pointer events (not just mouse)

3. **Crossword**
   - Auto-generated grid displayed as classic crossword cells
   - Tap a cell → highlight the full word (across or down), show clue in a floating panel
   - Keyboard input (on-screen for mobile)
   - Correct word filled: cells flash green
   - All words: celebration

4. **Find the Words**
   - Letter grid displayed as a matrix of round letter cells
   - Swipe/drag across letters to select a word (highlight trail follows finger)
   - Found word: letters stay highlighted in a color, word crossed off the list on the side
   - Word list panel shows found/remaining count
   - All found: celebration

5. **Image Sequencing**
   - Reference image shown at top (semi-transparent or in a "hint" panel that can be toggled)
   - Shuffled step images below as draggable cards
   - Drop zones numbered 1, 2, 3... in a row
   - Drag to reorder. Snap animation on drop.
   - "Check" button: correct positions glow green, wrong ones shake
   - All correct: celebration

6. **Arithmetic Quiz**
   - One question at a time, large centered numbers: "12 + 7 = ?"
   - Four multiple-choice answer buttons (auto-generated: 1 correct + 3 plausible wrong)
   - Correct: button bounces green, +points animation floats up
   - Wrong: button shakes red, correct answer briefly highlighted
   - Progress bar at top showing question count
   - After last question: results screen

### Completion/Celebration Screen

After every game completion — this is the reward moment:

- **Full-screen confetti/particle explosion** (Framer Motion + CSS)
- **Stars earned** — large animated star icons that fill in one by one (1-3 stars)
- **Score display** — points with counting-up number animation
- **Time display** — with clock icon
- **"তুমি দারুণ করেছো!"** or similar encouragement message (varies randomly)
- **Action buttons:**
  - "আবার খেলো" (Play Again) — primary, prominent
  - "অন্য গেম" (Other Games) → back to `/games`
- **No pass/fail** — every completion is celebrated

### Mobile Responsiveness

- Games listing: 1 column on mobile, 2 on tablet, 3 on desktop
- Game play: all games must work with touch. Card sizes and tap targets scale to screen.
- Memory grid adapts columns to screen width
- Drag & drop uses pointer events (works on touch + mouse)
- Crossword/find words: on-screen keyboard for mobile

## API Endpoints

### Admin

- `POST /games/` — create game (product + game record)
- `PUT /games/{game_id}` — update game settings + product fields
- `PUT /games/{game_id}/config` — update game config (JSONB content)
- `GET /games/{game_id}/admin` — get full game with config (admin view)
- `DELETE /games/{game_id}` — soft delete (set is_active=false)
- `POST /games/{game_id}/attach/{product_id}` — attach to product
- `DELETE /games/{game_id}/attach/{product_id}` — detach
- `GET /games/{game_id}/attempts` — list attempts (admin view)

### Public

- `GET /games/` — list active games (paginated, filterable by type/difficulty, searchable)
- `GET /games/slug/{slug}` — game detail by slug (no config, just metadata)
- `GET /games/product/{product_id}/attached` — games attached to a product

### Student

- `GET /games/{game_id}/start?child_profile_id=...` — get game config to play (access check, no correct answers for crossword/find words)
- `POST /games/{game_id}/submit` — submit attempt (score, time, completion)
- `GET /games/my` — list games the user has access to

## Pages & Routes

| Route | Page |
|-------|------|
| `/games` | Games listing (public, game-world themed) |
| `/games/[slug]` | Game detail/landing page |
| `/games/[slug]/play` | Full-screen game play |
| `/admin/games/[id]` | Admin game editor |

## Tech Notes

- **Framer Motion** (already installed) for all animations: card flips, drags, celebrations, page transitions
- **Drag & Drop**: Use Framer Motion's `drag` prop + `onDragEnd` for all drag interactions (no extra library needed)
- **Crossword grid generation**: Implement a simple word placement algorithm on the backend (place words one by one, find intersections)
- **Find words grid generation**: Place words in random directions, fill remaining cells with random letters — backend generates on game creation, stores in config
- **Arithmetic generation**: Pure frontend — generate questions from rules on each attempt start, no backend needed per question
- **Touch support**: All pointer interactions use `onPointerDown/Move/Up` or Framer's built-in drag, which handles touch natively
- **Default backgrounds**: Ship as static SVG/PNG in `public/game-themes/` — 6 files, one per type
- **Image uploads**: Reuse existing `POST /uploads/image` with `folder=game-images`
