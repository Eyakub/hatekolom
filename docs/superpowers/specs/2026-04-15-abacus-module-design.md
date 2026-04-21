# Abacus Module — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Overview

A structured, level-based abacus (soroban) learning system for kids 0-12. Kids learn mental math by sliding beads on an interactive visual abacus. Starts with basic counting, progresses through arithmetic to mental math. Admin can customize levels to match physical book content. Ships with a default 12-level curriculum.

## Abacus Type

**Japanese Soroban**: 1 heaven bead (value=5) + 4 earth beads (value=1 each) per rod. Standard for modern kids' abacus education.

## Architecture

### Follows Exam/Game Pattern

- `AbacusCourse` model → 1:1 FK to `Product` (own price, slug, page)
- `AbacusLevel` model → belongs to AbacusCourse, ordered by `sort_order`
- `AbacusAttempt` model → tracks each level attempt (score, stars, time, pass/fail)
- `ProductAbacus` model → many-to-many attachment (same as ProductExam/ProductGame)
- New enums: `ProductType.ABACUS`, `EntitlementType.ABACUS_ACCESS`
- Entitlement service grants `ABACUS_ACCESS` on purchase
- Access check: free courses open to all, paid require entitlement (direct or via attached product)

### Level Progression

**Strict linear unlock.** Level N requires Level N-1 completed with ≥ pass_percentage (default 80%) score. Tutorial levels auto-pass (always 3 stars). First level is always unlocked.

## Database Models

### AbacusCourse

```
abacus_courses
├── id (UUID PK)
├── product_id (UUID FK → products.id, unique, cascade)
├── is_active (Boolean, default true)
├── total_levels (Integer, default 0 — denormalized)
├── created_at (DateTime)
```

### AbacusLevel

```
abacus_levels
├── id (UUID PK)
├── abacus_course_id (UUID FK → abacus_courses.id, cascade)
├── sort_order (Integer — determines unlock sequence)
├── title (String 500)
├── title_bn (String 500, nullable)
├── description (Text, nullable)
├── description_bn (Text, nullable)
├── level_type (String 20: tutorial | practice | test)
├── exercise_type (String 20: bead_slide | mental_math | mixed)
├── config (JSONB — exercise generation rules)
├── content (JSONB — tutorial step-by-step instructions)
├── created_at (DateTime)
```

**level_type:**
- `tutorial`: animated bead demonstrations, kid follows along. Auto-pass, always 3 stars.
- `practice`: kid solves problems with visual abacus. Unlimited attempts, no scoring, no unlock gate.
- `test`: timed exercises, scored. Must score ≥ pass_percentage to unlock next level.

**exercise_type:**
- `bead_slide`: show problem → kid slides beads on visual abacus → system checks bead position
- `mental_math`: flash problem briefly → kid types answer → no abacus visible (higher levels)
- `mixed`: alternates between bead_slide and mental_math questions

**config JSONB:**
```json
{
  "operations": ["+"],
  "number_range": [1, 9],
  "num_rods": 1,
  "question_count": 10,
  "time_limit_seconds": null,
  "flash_duration_ms": 3000,
  "pass_percentage": 80
}
```

- `operations`: array of allowed operations. `["+"]`, `["+", "-"]`, `["+", "-", "*"]`
- `number_range`: `[min, max]` for generated operands
- `num_rods`: how many rods to show on the abacus (1 = ones only, 2 = tens+ones, etc.)
- `question_count`: number of exercises in the level
- `time_limit_seconds`: null = no limit, timer still tracks elapsed time
- `flash_duration_ms`: for mental_math — how long the problem is visible (milliseconds)
- `pass_percentage`: minimum score % to pass the level (default 80)

**content JSONB (for tutorials):**
```json
{
  "steps": [
    {
      "instruction": "Push 3 earth beads up on the ones rod",
      "instruction_bn": "একক রডে ৩টি গুটি উপরে তোলো",
      "target_value": 3,
      "highlight_rods": [0]
    },
    {
      "instruction": "Now push the heaven bead down to add 5",
      "instruction_bn": "এবার স্বর্গ গুটি নামাও ৫ যোগ করতে",
      "target_value": 8,
      "highlight_rods": [0]
    }
  ]
}
```

### AbacusAttempt

```
abacus_attempts
├── id (UUID PK)
├── level_id (UUID FK → abacus_levels.id, cascade)
├── child_profile_id (UUID FK → child_profiles.id, cascade)
├── user_id (UUID FK → users.id, cascade)
├── score (Integer — correct answers)
├── total_points (Integer — total questions)
├── time_seconds (Integer — elapsed time)
├── passed (Boolean — score ≥ pass_percentage)
├── stars (Integer 0-3)
├── attempt_data (JSONB — per-question results)
├── started_at (DateTime)
├── completed_at (DateTime, nullable)
```

Stars calculation:
- 3 stars: ≥95% correct
- 2 stars: ≥ pass_percentage correct
- 1 star: completed but below pass_percentage (fail)

### ProductAbacus

```
product_abacus
├── id (UUID PK)
├── product_id (UUID FK → products.id, cascade)
├── abacus_course_id (UUID FK → abacus_courses.id, cascade)
```

## Enum Additions

```python
# ProductType
ABACUS = "abacus"

# EntitlementType
ABACUS_ACCESS = "abacus_access"
```

## Default Curriculum

Ships with the system. Admin can use as-is, customize, or create entirely new courses.

| # | Title | Title BN | Type | Exercise | Rods | Ops | Range |
|---|-------|----------|------|----------|------|-----|-------|
| 1 | Counting 1-4 | ১-৪ গণনা | tutorial | bead_slide | 1 | — | 1-4 |
| 2 | Counting 1-4 Test | ১-৪ গণনা পরীক্ষা | test | bead_slide | 1 | — | 1-4 |
| 3 | Friends of 5 (5-9) | ৫ এর বন্ধু (৫-৯) | tutorial | bead_slide | 1 | — | 5-9 |
| 4 | Counting 5-9 Test | ৫-৯ গণনা পরীক্ষা | test | bead_slide | 1 | — | 5-9 |
| 5 | Simple Addition | সাধারণ যোগ | tutorial | bead_slide | 1 | + | 1-9 |
| 6 | Addition Test | যোগ পরীক্ষা | test | bead_slide | 1 | + | 1-9 |
| 7 | Simple Subtraction | সাধারণ বিয়োগ | tutorial | bead_slide | 1 | − | 1-9 |
| 8 | Subtraction Test | বিয়োগ পরীক্ষা | test | bead_slide | 1 | − | 1-9 |
| 9 | Two-Digit Numbers | দুই অঙ্কের সংখ্যা | tutorial | bead_slide | 2 | +, − | 10-99 |
| 10 | Two-Digit Test | দুই অঙ্কের পরীক্ষা | test | bead_slide | 2 | +, − | 10-99 |
| 11 | Mental Math Intro | মানসিক গণিত | tutorial | mixed | 2 | +, − | 1-20 |
| 12 | Mental Math Test | মানসিক গণিত পরীক্ষা | test | mental_math | — | +, − | 1-50 |

## Interactive Abacus Component

The core UI — a visual soroban that kids interact with by sliding beads.

### Visual Design

- **Frame**: wooden/bamboo-colored rounded rectangle (kid-friendly, warm look)
- **Beam**: horizontal divider bar separating heaven (top) and earth (bottom) sections
- **Rods**: vertical lines, 1-13 rods depending on level config
- **Heaven beads (top)**: 1 per rod, value = 5. Slide DOWN toward beam to activate.
- **Earth beads (bottom)**: 4 per rod, value = 1 each. Slide UP toward beam to activate.
- **Bead colors**: active beads = orange/amber, inactive = gray/light
- **Rod labels**: below each rod — "Ones", "Tens", "Hundreds" etc. (shown for multi-rod levels)
- **Value display**: optional digit below each rod showing current rod value (can be toggled)

### Bead Interaction

- Click a bead → it toggles (slides toward or away from beam)
- Drag a bead → smooth slide with Framer Motion spring physics
- Earth beads: drag up to activate (push toward beam), drag down to deactivate
- Heaven bead: drag down to activate, drag up to deactivate
- Touch-friendly: beads are large (min 36px width, 24px height), easy to grab on mobile
- Visual feedback: bead scales slightly while being dragged, snaps to position on release

### Reading the Abacus Value

The system reads the abacus value by counting active beads per rod:
- Rod value = (heaven bead active ? 5 : 0) + (count of active earth beads)
- Total value = sum of (rod_value × 10^rod_position) for all rods
- Rod 0 = ones, Rod 1 = tens, Rod 2 = hundreds, etc.

### Reset

A "Reset" button clears all beads to inactive position (value = 0).

## Student Experience

### Abacus Listing Page (`/abacus`)

- Kid-friendly page showing available abacus courses
- Each course card: thumbnail, title, level count, price/free badge, progress (if enrolled)
- Same animated style as games listing page

### Course Page (`/abacus/[slug]`)

- **Level map**: vertical progression path connecting all levels
  - Completed levels: green circle with checkmark + stars earned (⭐⭐⭐)
  - Current level (next to complete): glowing purple circle, pulsing animation, "Start" button
  - Locked levels: gray circle with lock icon, dotted connector
- **Progress bar**: "Level 5/12" at the top
- **Course description** and any admin notes
- Child selector (same pattern as exams/games)

### Level Play Page (`/abacus/[slug]/level/[levelId]`)

Full-screen immersive page, same pattern as game play page.

**Top bar**: level title, timer (counting up), progress (question 3/10), exit button

#### Tutorial Levels

1. Show instruction text: "Push 3 earth beads up on the ones rod"
2. Highlight the relevant rod(s) with a subtle glow
3. Optional: show ghost/target beads in a lighter color showing where beads should end up
4. Kid manipulates the abacus
5. When abacus value matches `target_value` → green flash, "Next Step" button appears
6. After all steps → celebration screen (auto 3 stars)

#### Test Levels (bead_slide)

1. Show problem: large text "7 + 5 = ?"
2. Kid manipulates abacus to show answer
3. "Check" button → system reads abacus value
4. If correct: green flash + "+1" animation + auto advance to next question
5. If wrong: red shake + show correct answer briefly + advance
6. After all questions → results screen with score, stars, pass/fail
7. If passed (≥80%): next level unlocks, celebration
8. If failed: "Try Again" button, encouraging message

#### Test Levels (mental_math)

1. Flash problem on screen for `flash_duration_ms` (e.g., 3 seconds) with countdown ring
2. Problem disappears
3. Large number input appears — kid types answer
4. Submit → check answer, same feedback as above
5. No abacus visible — kid visualizes it mentally

#### Test Levels (mixed)

Alternates between bead_slide and mental_math questions within the same test.

### Completion/Results Screen

Same celebration pattern as games:
- Stars animation (1-3 filling in)
- Score display with count-up
- Time display
- Pass: "Level Complete!" + next level unlocked animation
- Fail: "Keep Practicing!" + "Try Again" button
- No harsh fail messaging — encouraging tone

## Admin Panel

### Admin Dashboard Tab

New "Abacus" tab in admin panel. Table of abacus courses with: title, level count, active status, price, edit link. "Create Course" button.

### Course Editor (`/admin/abacus/[id]`)

Same layout as exam/game editor — left content, right sidebar.

**Left: Level Editor**
- Ordered list of levels (drag to reorder or sort_order input)
- Each level card shows: sort order, title, type badge (tutorial/practice/test), exercise type badge
- Click level → expand inline editor:
  - Title (EN), Title BN
  - Description (EN), Description BN
  - Level type dropdown
  - Exercise type dropdown
  - Config fields: operations checkboxes, number range inputs, num_rods, question_count, time_limit, flash_duration, pass_percentage
  - For tutorials: step editor (add/remove/reorder steps, each with instruction text + target_value + highlight_rods)
- "Add Level" button
- Delete level button with confirmation

**Right Sidebar:**
- Course settings (title override, active status)
- Pricing card (same as exam/game)
- Product attachments (same pattern)
- Course stats (total students, completion rates)

**Preview**: each level has a preview button → opens `/abacus/{slug}/level/{levelId}?preview=true`

### Seed Default Curriculum

Admin can click "Load Default Curriculum" button when creating a new course to populate all 12 default levels. Can then customize as needed.

## API Endpoints

### Admin

- `POST /abacus/` — create course (product + abacus_course + optional default levels)
- `PUT /abacus/{course_id}` — update course settings + product fields
- `GET /abacus/{course_id}/admin` — full course with all levels (admin view)
- `POST /abacus/{course_id}/levels` — add a level
- `PUT /abacus/levels/{level_id}` — update a level (config, content, metadata)
- `DELETE /abacus/levels/{level_id}` — delete a level
- `PUT /abacus/{course_id}/reorder` — reorder levels (accepts array of level IDs in new order)
- `POST /abacus/{course_id}/attach/{product_id}` — attach to product
- `DELETE /abacus/{course_id}/attach/{product_id}` — detach
- `GET /abacus/{course_id}/attempts` — list all attempts (admin view)

### Public

- `GET /abacus/` — list active courses (paginated, searchable)
- `GET /abacus/slug/{slug}` — course detail with level list (no configs, just metadata + locked/unlocked state)

### Student

- `GET /abacus/{course_id}/progress?child_profile_id=...` — get level map with completion/unlock state per level
- `GET /abacus/levels/{level_id}/start?child_profile_id=...` — get level config to play (access + unlock check)
- `POST /abacus/levels/{level_id}/submit` — submit attempt (score, time, pass/fail, stars)
- `GET /abacus/my` — list courses the user has access to

## Pages & Routes

| Route | Page |
|-------|------|
| `/abacus` | Course listing (public) |
| `/abacus/[slug]` | Course detail with level map |
| `/abacus/[slug]/level/[levelId]` | Level play page (full-screen) |
| `/admin/abacus/[id]` | Admin course editor |

## Tech Notes

- **Abacus component**: standalone React component `<Abacus rods={2} value={0} onChange={setValue} readOnly={false} />`. Reusable across tutorial, practice, and test modes.
- **Bead physics**: Framer Motion `drag` with constraints (vertical only, snap to positions)
- **Question generation**: same pattern as arithmetic game — generate from config rules on the frontend
- **Mental math flash**: CSS animation for countdown ring, `setTimeout` to hide problem after duration
- **Level unlock logic**: backend checks most recent passing attempt for previous level before allowing start
- **Default curriculum**: stored as a JSON constant in the backend, inserted via `POST /abacus/` with `load_defaults=true` query param
- **Image uploads**: reuse existing `POST /uploads/image` with `folder=abacus-images`
