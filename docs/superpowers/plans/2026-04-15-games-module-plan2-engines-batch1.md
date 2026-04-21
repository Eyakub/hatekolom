# Games Module — Plan 2: Game Engines (Memory, Arithmetic, Drag & Drop)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 3 interactive game engines (Memory card flip, Arithmetic quiz, Drag & Drop) as React components that replace the placeholder stubs in the game play page.

**Architecture:** Each engine is a standalone React component in `frontend/src/components/games/`. It receives `config` (JSONB from backend) and `onComplete` callback (receives `GameResult`). The play page at `frontend/src/app/games/[slug]/play/page.tsx` imports and renders the engine based on `game_type`. All animations use Framer Motion (`motion` from `motion/react`). Elapsed time is tracked by the parent play page — engines receive it as a prop.

**Tech Stack:** React, TypeScript, Tailwind CSS, Framer Motion

**Spec:** `docs/superpowers/specs/2026-04-15-games-module-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/components/games/MemoryEngine.tsx` | Create | Memory card flip game — grid of cards, flip animation, match detection |
| `frontend/src/components/games/ArithmeticEngine.tsx` | Create | Math quiz — auto-generated questions, 4 answer choices, progress bar |
| `frontend/src/components/games/DragDropEngine.tsx` | Create | Drag items onto targets — Framer Motion drag, snap-to-target, validation |
| `frontend/src/app/games/[slug]/play/page.tsx` | Modify | Import engines, replace placeholder stubs with actual components |

---

## Engine Interface

Every engine receives these props:

```typescript
interface GameEngineProps {
  config: any;          // JSONB config from backend
  elapsed: number;      // seconds elapsed (tracked by parent)
  onComplete: (result: GameResult) => void;
}

interface GameResult {
  score: number;
  total_points: number;
  time_seconds: number;
  stars: number;
  attempt_data: Record<string, unknown>;
}
```

Stars calculation (all engines):
- 3 stars: completed with 0-1 mistakes
- 2 stars: completed with 2-3 mistakes
- 1 star: completed with 4+ mistakes

---

### Task 1: Memory Engine

**Files:**
- Create: `frontend/src/components/games/MemoryEngine.tsx`

- [ ] **Step 1: Create the Memory Engine component**

The Memory Game engine. Config shape:
```json
{
  "grid": "3x4",
  "pairs": [
    { "image_url": "...", "label": "Horse", "label_bn": "ঘোড়া" },
    { "image_url": "...", "label": "Cat", "label_bn": "বিড়াল" }
  ]
}
```

**Component behavior:**

1. **Initialization:**
   - Parse grid size (e.g., "3x4" → 3 cols, 4 rows = 12 cards = 6 pairs)
   - Create card deck: duplicate each pair to make 2 of each, shuffle randomly
   - Each card has: `id` (unique), `pairId` (shared between matches), `image_url`, `label`

2. **Game state:**
   - `cards`: shuffled array of card objects
   - `flippedIds`: Set of currently face-up card IDs (max 2 at a time)
   - `matchedIds`: Set of successfully matched card IDs
   - `mistakes`: counter for mismatches
   - `isChecking`: boolean to prevent clicks during mismatch delay

3. **Card rendering:**
   - CSS grid with columns from grid config (e.g., 3 cols for "3x4")
   - Each card is a `motion.button` with 3D flip animation
   - Card back: colored card with "?" or a pattern (use game-type accent color, e.g., purple gradient)
   - Card front: shows the pair image (`object-cover`, square aspect ratio, `rounded-xl`) with label below
   - Flip animation: use CSS `transform-style: preserve-3d` and `rotateY(180deg)`. The card container has `perspective: 1000px`. Front and back are absolutely positioned with `backface-visibility: hidden`.
   - Framer Motion: `animate={{ rotateY: isFlipped ? 180 : 0 }}` with `transition={{ duration: 0.4 }}`

4. **Click logic:**
   - If `isChecking` or card already matched or card already flipped → ignore
   - Flip the card (add to `flippedIds`)
   - If 2 cards are flipped:
     - If same `pairId` → MATCH: add both to `matchedIds`, play match animation (scale pulse + green glow), clear `flippedIds`
     - If different → MISMATCH: increment `mistakes`, set `isChecking=true`, after 1s delay flip both back, clear `flippedIds`, set `isChecking=false`
   - If all cards matched → game complete

5. **Match animation:** Matched cards get a brief `scale: [1, 1.1, 1]` pulse and green border via Framer Motion
6. **Mismatch animation:** Cards shake briefly (`x: [0, -5, 5, -5, 0]`) before flipping back

7. **Completion:**
   - `total_points`: number of pairs
   - `score`: number of pairs (always = total since you must match all)
   - `stars`: 3 if mistakes ≤ 1, 2 if mistakes ≤ 3, 1 otherwise
   - Call `onComplete({ score, total_points, time_seconds: elapsed, stars, attempt_data: { mistakes, total_pairs } })`

8. **Styling:** Cards should be large and touch-friendly. Gap between cards: `gap-3`. Card min-size: ensure they're at least 80px on mobile. Use `aspect-square` for card containers. Rounded corners (`rounded-xl`). Shadow on hover.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/games/MemoryEngine.tsx
git commit -m "feat(games): add Memory card flip game engine"
```

---

### Task 2: Arithmetic Engine

**Files:**
- Create: `frontend/src/components/games/ArithmeticEngine.tsx`

- [ ] **Step 1: Create the Arithmetic Engine component**

Config shape:
```json
{
  "operations": ["+", "-"],
  "number_range": [1, 20],
  "question_count": 10
}
```

**Component behavior:**

1. **Initialization:**
   - Generate `question_count` questions from config rules
   - Each question: pick 2 random numbers in range, pick random operation from allowed list
   - For subtraction: ensure first number ≥ second (no negatives)
   - For division: generate as `a = b * quotient` where quotient is random 1-10 in range, so division is always even
   - For multiplication: both numbers should be reasonable (both within range)
   - Generate 4 answer choices: 1 correct + 3 plausible wrong (correct ± random offset of 1-5, ensure no duplicates, no negatives)
   - Shuffle answer choices

2. **Game state:**
   - `questions`: generated array
   - `currentIndex`: which question we're on (0-based)
   - `score`: correct answers count
   - `mistakes`: wrong answers count
   - `answered`: boolean for current question (to show feedback before advancing)
   - `selectedAnswer`: which answer was picked (for coloring)

3. **Question display:**
   - Large centered math expression: "12 + 7 = ?" with `text-5xl sm:text-6xl font-black font-mono`
   - Operation symbol: colored differently (+ green, − red, × blue, ÷ orange)
   - Progress bar at top: `{currentIndex + 1} / {question_count}` with animated width bar

4. **Answer buttons:**
   - 2×2 grid of large buttons
   - Each button: `rounded-2xl p-6 text-3xl font-black font-mono` with colored borders from `optionStyles`-like array
   - On click:
     - If correct: button turns green, bounces (`scale: [1, 1.2, 1]`), "+1" floating animation, increment score
     - If wrong: button turns red, shakes, correct answer briefly highlighted in green, increment mistakes
   - After 0.8s delay: advance to next question
   - Disable all buttons during feedback delay

5. **Completion** (after last question):
   - `total_points`: question_count
   - `score`: correct answers
   - `stars`: 3 if mistakes ≤ 1, 2 if mistakes ≤ 3, 1 otherwise
   - Call `onComplete({ score, total_points, time_seconds: elapsed, stars, attempt_data: { mistakes, questions_count: question_count } })`

6. **Styling:** Big, bold numbers. Kid-friendly. Touch-friendly answer buttons (min 80px height). Animations on every interaction.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/games/ArithmeticEngine.tsx
git commit -m "feat(games): add Arithmetic quiz game engine"
```

---

### Task 3: Drag & Drop Engine

**Files:**
- Create: `frontend/src/components/games/DragDropEngine.tsx`

- [ ] **Step 1: Create the Drag & Drop Engine component**

Config shape:
```json
{
  "items": [
    { "id": "item1", "content": "Horse", "content_bn": "ঘোড়া", "image_url": "..." }
  ],
  "targets": [
    { "id": "target1", "label": "Farm Animals", "label_bn": "খামারের প্রাণী", "image_url": "...", "correct_item_ids": ["item1", "item2"] }
  ]
}
```

**Component behavior:**

1. **Initialization:**
   - Parse items and targets from config
   - Shuffle items order randomly

2. **Game state:**
   - `items`: array of draggable items (with `placed: boolean` and `targetId: string | null`)
   - `targets`: array of targets (with `placedItems: string[]` — IDs of items placed here)
   - `mistakes`: counter
   - `draggedItem`: currently being dragged item ID (or null)

3. **Layout:**
   - **Desktop:** Items panel on left (40%), targets on right (60%) — `flex flex-col lg:flex-row gap-6`
   - **Mobile:** Items on top, targets below — stacks naturally
   - Items: draggable cards in a flex-wrap layout
   - Targets: drop zones with dashed borders, spaced vertically

4. **Item rendering:**
   - Each unplaced item: `motion.div` with `drag` prop enabled, `dragConstraints` set to parent ref
   - Shows image (if present, 60×60 rounded) + text label
   - While dragging: elevated shadow, slight rotation (`rotate: 3`), scale 1.05, higher z-index
   - Use `onDragEnd` with pointer position to detect which target the item was dropped on

5. **Target rendering:**
   - Each target: a bordered box (`border-2 border-dashed rounded-2xl p-4 min-h-[100px]`)
   - Shows target label (+ image if present) at top
   - Below: shows placed items as small badges/chips
   - When an item is being dragged over: highlight border (solid blue/purple, scale slightly)

6. **Drop logic (onDragEnd):**
   - Get pointer position from the drag event
   - Check if pointer is within any target's bounding rect (use `getBoundingClientRect()` via refs)
   - If dropped on a target:
     - Check if item's ID is in target's `correct_item_ids`
     - If correct: item snaps into target with spring animation, green flash, mark item as placed
     - If wrong: item bounces back to items panel with shake animation, increment mistakes
   - If dropped outside any target: item returns to original position

7. **Completion** (all items correctly placed):
   - `total_points`: total number of items
   - `score`: total items (all must be placed correctly to complete)
   - `stars`: 3 if mistakes ≤ 1, 2 if mistakes ≤ 3, 1 otherwise
   - Call `onComplete({ score, total_points, time_seconds: elapsed, stars, attempt_data: { mistakes, items_count: items.length } })`

8. **Touch support:** Framer Motion's `drag` prop works with touch natively. Ensure `touch-action: none` on draggable elements.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/games/DragDropEngine.tsx
git commit -m "feat(games): add Drag & Drop game engine"
```

---

### Task 4: Wire Engines into Play Page

**Files:**
- Modify: `frontend/src/app/games/[slug]/play/page.tsx`

- [ ] **Step 1: Import engines and replace placeholders**

At the top of the file, add imports:
```typescript
import MemoryEngine from "@/components/games/MemoryEngine";
import ArithmeticEngine from "@/components/games/ArithmeticEngine";
import DragDropEngine from "@/components/games/DragDropEngine";
```

Replace the 3 placeholder `<div>` blocks for memory, drag_drop, and arithmetic with:

```tsx
{game.game_type === "memory" && (
  <MemoryEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} />
)}
{game.game_type === "arithmetic" && (
  <ArithmeticEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} />
)}
{game.game_type === "drag_drop" && (
  <DragDropEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} />
)}
```

Keep the remaining 3 placeholders (crossword, find_words, image_sequence) unchanged for Plan 3.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/games/[slug]/play/page.tsx frontend/src/components/games/
git commit -m "feat(games): wire Memory, Arithmetic, Drag & Drop engines into play page"
```

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Test Memory Game**

1. In admin, create a memory game with 6 pairs (3×4 grid) — upload 6 different images
2. Play the game as a student
3. Verify: cards render in grid, flip animation works, matching works, mismatch shakes and flips back, completion triggers celebration

- [ ] **Step 2: Test Arithmetic Game**

1. In admin, create an arithmetic game with + and − operations, range 1-20, 5 questions
2. Play the game
3. Verify: questions display with large numbers, 4 answer choices, correct/wrong feedback, progress bar advances, completion triggers celebration

- [ ] **Step 3: Test Drag & Drop Game**

1. In admin, create a drag & drop game with 4 items and 2 targets
2. Play the game
3. Verify: items are draggable, snap into correct targets, wrong drops bounce back, completion triggers celebration
