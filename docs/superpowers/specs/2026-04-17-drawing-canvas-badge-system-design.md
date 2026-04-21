# Drawing Canvas + Badge System — Design Spec

**Date:** 2026-04-17
**Status:** Approved

## Overview

Three interconnected subsystems: (1) a platform-wide badge engine for rewarding kids across all modules, (2) an interactive HTML5 drawing canvas for free drawing and challenge submissions, and (3) a daily challenge + community gallery system with voting and parent approval.

## Subsystem 1: Badge Engine (Platform-Wide)

### Purpose

A generic, reusable badge infrastructure that can reward kids for activity across any module — drawings, games, exams, abacus, courses. Phase 1 wires it to drawings/challenges. Other modules connected later.

### Database Models

**Badge** — admin-defined badge templates

```
badges
├── id (UUID PK)
├── name (String 300)
├── name_bn (String 300, nullable)
├── description (String 1000, nullable)
├── description_bn (String 1000, nullable)
├── icon_url (String 1000 — badge image/icon)
├── category (String 30: art | games | exams | abacus | courses | general)
├── criteria (JSONB — earning rules)
├── is_active (Boolean, default true)
├── sort_order (Integer, default 0)
├── created_at (DateTime)
```

**criteria JSONB** — defines how a badge is earned:

```json
{
  "trigger": "drawing_count",
  "threshold": 5,
  "description": "Submit 5 drawings"
}
```

Supported triggers (Phase 1 — drawings):
- `drawing_count` — total approved drawings by child
- `challenge_streak` — consecutive days with a challenge submission
- `like_count` — total likes received across all drawings
- `featured_count` — number of times featured by admin

Future triggers (later phases):
- `game_completed` — total games completed
- `game_stars` — total stars earned in games
- `exam_passed` — total exams passed
- `abacus_level` — highest abacus level completed
- `course_completed` — total courses finished

**ChildBadge** — tracks earned badges per child

```
child_badges
├── id (UUID PK)
├── child_profile_id (UUID FK → child_profiles.id, cascade)
├── badge_id (UUID FK → badges.id, cascade)
├── earned_at (DateTime)
```

Unique constraint on `(child_profile_id, badge_id)` — can't earn same badge twice.

### Badge Checking Service

A `BadgeService` class with:
- `check_and_award(child_profile_id, trigger, db)` — called after relevant actions (drawing approved, challenge submitted, etc.). Checks all active badges with matching trigger, counts the child's stats, awards any newly qualified badges.
- `get_child_badges(child_profile_id, db)` — returns all earned badges for display.
- `get_badge_wall(child_profile_id, db)` — returns all badges (earned + locked) for the badge wall UI.

This service is called from drawing/challenge endpoints in Phase 1. Later phases add calls from game/exam/abacus submit endpoints.

### Admin — Badge Management

Admin tab or section for managing badges:
- CRUD for badge definitions
- Upload badge icon images
- Set criteria (trigger + threshold)
- Preview badge wall

### Student — Badge Wall

- Visible on child's dashboard/profile
- Grid of badge icons: earned ones are full color with earned date, locked ones are grayed out with progress bar ("3/5 drawings")
- Animation when a new badge is earned (popup notification)

## Subsystem 2: Drawing Canvas

### Purpose

An interactive HTML5 canvas where kids can draw freely or submit artwork for challenges. Touch and mouse support. Save as PNG.

### Canvas Component (`<DrawingCanvas>`)

**Tools:**
- Brush (freehand drawing)
- Eraser
- Color picker — preset kid-friendly palette (12-16 bright colors + black + white)
- Brush size — 3-4 presets (thin, medium, thick, extra thick) shown as circles
- Undo / Redo (history stack)
- Clear canvas (with confirmation)

**Implementation:**
- HTML5 `<canvas>` element with 2D context
- Draw via `onPointerDown/Move/Up` events (works for both mouse and touch)
- Store drawing history as array of strokes for undo/redo
- Each stroke: `{ tool, color, size, points: [{x,y}] }`
- Canvas resolution: 800×600 default, scales to container
- Background: white

**Save flow:**
1. `canvas.toBlob()` → create File object
2. Upload via `POST /uploads/image` with `folder=drawings`
3. Returns image URL
4. Create Drawing record via API

**Props:**
```typescript
interface DrawingCanvasProps {
  onSave: (imageUrl: string) => void;
  challengePrompt?: string;  // shown above canvas if present
  readOnly?: boolean;        // for viewing saved drawings
  initialImage?: string;     // load existing drawing for editing
}
```

### Database Models

**Drawing**

```
drawings
├── id (UUID PK)
├── child_profile_id (UUID FK → child_profiles.id, cascade)
├── user_id (UUID FK → users.id, cascade)
├── image_url (String 1000)
├── title (String 500, nullable)
├── title_bn (String 500, nullable)
├── challenge_id (UUID FK → challenges.id, nullable — null = free drawing)
├── status (String 20: pending | approved | rejected — default pending)
├── is_featured (Boolean, default false)
├── like_count (Integer, default 0 — denormalized)
├── created_at (DateTime)
```

**DrawingLike**

```
drawing_likes
├── id (UUID PK)
├── drawing_id (UUID FK → drawings.id, cascade)
├── user_id (UUID FK → users.id, cascade)
├── created_at (DateTime)
```

Unique constraint on `(drawing_id, user_id)` — one like per user per drawing.

### API Endpoints — Drawings

**Student:**
- `POST /drawings/` — save a drawing (image_url, title, challenge_id optional). Status = pending.
- `GET /drawings/my?child_profile_id=...` — list child's drawings (all statuses for own dashboard)
- `DELETE /drawings/{id}` — delete own drawing

**Parent:**
- `GET /drawings/pending?child_profile_id=...` — list pending drawings for parent review
- `PUT /drawings/{id}/approve` — approve drawing (status → approved). Triggers badge check.
- `PUT /drawings/{id}/reject` — reject drawing (status → rejected)

**Public:**
- `GET /drawings/gallery?page=1&page_size=20&challenge_id=...` — approved drawings, sorted by recent/popular
- `POST /drawings/{id}/like` — like a drawing (auth required, toggle — like/unlike)
- `GET /drawings/{id}` — single drawing detail with like count

**Admin:**
- `GET /drawings/admin?status=pending&page=1` — all drawings with filters
- `PUT /drawings/{id}/feature` — toggle featured status
- `DELETE /drawings/{id}` — admin delete

### Student Experience — Free Drawing

**`/draw` page:**
- Full-screen canvas with tool bar
- "Save" button → uploads image, creates Drawing with status=pending
- Title input (optional) before saving
- After save: "Saved! Waiting for parent approval." message
- Link to "My Drawings" portfolio

**Dashboard integration:**
- "My Drawings" section on child dashboard — grid of thumbnails
- Status badges: pending (yellow), approved (green), rejected (red)
- Click to view full size

### Parent Experience

**Parent dashboard:**
- Notification badge: "3 drawings pending approval"
- Pending drawings section: thumbnail + approve/reject buttons
- Approved drawings visible in child's portfolio

## Subsystem 3: Daily Challenges + Gallery

### Purpose

Admin creates drawing/text prompts. Kids submit responses. Approved submissions appear in a community gallery with hearts/voting. Drives engagement and badge earning.

### Database Models

**Challenge**

```
challenges
├── id (UUID PK)
├── title (String 500)
├── title_bn (String 500, nullable)
├── description (Text — the prompt)
├── description_bn (Text, nullable)
├── reference_image_url (String 1000, nullable — inspiration image)
├── challenge_type (String 20: drawing | text | both)
├── starts_at (DateTime)
├── ends_at (DateTime, nullable — null = no end)
├── is_active (Boolean, default true)
├── created_at (DateTime)
```

### API Endpoints — Challenges

**Admin:**
- `POST /challenges/` — create challenge
- `PUT /challenges/{id}` — update challenge
- `GET /challenges/admin` — list all challenges
- `DELETE /challenges/{id}` — delete challenge

**Public:**
- `GET /challenges/` — list active challenges (current + upcoming)
- `GET /challenges/{id}` — challenge detail with submission count
- `GET /challenges/today` — today's active challenge (if any)

**Student:**
- `GET /challenges/{id}/submissions?child_profile_id=...` — check if child already submitted
- Submission: use `POST /drawings/` with `challenge_id` set

### Student Experience — Challenges

**`/challenges` page:**
- Active challenges listed as cards with: title, description, reference image, deadline, submission count
- "Today's Challenge" highlighted at top
- Click → opens canvas with prompt shown above
- Submit → drawing saved with challenge_id, pending approval

### Community Gallery

**`/gallery` page:**
- Grid of approved drawings from all kids
- Filter: "All" / "Today's Challenge" / "Featured" / "Most Liked"
- Each card: drawing thumbnail, child's first name, heart count, featured badge (if featured)
- Click heart → toggle like (auth required)
- Click drawing → full view with title, child name, likes, challenge name (if from challenge)
- Featured drawings have a special gold border/badge

**Gallery is public** but liking requires login. Child names shown (first name only for privacy).

### Admin — Challenge & Gallery Management

**Admin challenges tab:**
- Create/edit challenges with: title (EN/BN), description (EN/BN), reference image upload, type (drawing/text/both), start/end dates
- View submissions per challenge

**Admin gallery moderation:**
- All drawings list with status filter
- Approve/reject buttons
- Feature/unfeature toggle
- Bulk actions

## Pages & Routes

| Route | Page |
|-------|------|
| `/draw` | Free drawing canvas (full screen) |
| `/drawings` | My drawings portfolio (child) |
| `/challenges` | Active challenges list |
| `/challenges/[id]` | Challenge detail + submit |
| `/gallery` | Community gallery (public) |
| `/gallery/[id]` | Single drawing view |
| `/admin?tab=badges` | Badge management |
| `/admin?tab=challenges` | Challenge management |
| `/admin?tab=gallery` | Gallery moderation |

## Tech Notes

- **Canvas**: HTML5 Canvas 2D API with pointer events (works on mouse + touch natively)
- **Undo/Redo**: store stroke history array, replay on canvas for undo
- **Image export**: `canvas.toBlob("image/png")` → FormData → existing upload endpoint
- **Badge checking**: called async after drawing approval, challenge submission. Uses database counts, not in-memory state.
- **Like toggle**: POST endpoint checks if like exists → removes if yes, creates if no. Updates denormalized `like_count` on Drawing.
- **Gallery sorting**: "recent" = by created_at DESC, "popular" = by like_count DESC, "featured" = is_featured=true first
- **Privacy**: gallery shows child's first name only. No last name, no profile link to strangers.
- **Image uploads**: reuse existing `POST /uploads/image` with `folder=drawings`

## Phased Rollout

### Phase 1 (this implementation cycle):
- Badge engine (models, service, admin CRUD, badge wall UI)
- Drawing canvas component
- Free drawing flow (save, portfolio, parent approval)
- Wire drawing badges (drawing_count, featured_count)

### Phase 2 (next cycle):
- Daily challenges (model, admin, challenge page, submit flow)
- Community gallery (gallery page, likes, featured)
- Wire challenge badges (challenge_streak, like_count)

### Phase 3 (future):
- Wire badges to games (game_completed, game_stars)
- Wire badges to exams (exam_passed)
- Wire badges to abacus (abacus_level)
- Wire badges to courses (course_completed)
- Badge notification popup when earned
