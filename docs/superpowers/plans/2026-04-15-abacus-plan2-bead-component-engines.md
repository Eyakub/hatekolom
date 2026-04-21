# Abacus Module — Plan 2: Interactive Bead Component + Engines

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the interactive soroban abacus component (beads that slide with touch/mouse) and 4 exercise engines (Tutorial, Bead Slide Test, Mental Math Test, Practice) that replace the placeholder stubs in the level play page.

**Architecture:** The core `<Abacus>` component is a standalone, reusable React component that renders a configurable number of rods with 1 heaven bead + 4 earth beads each. Beads are clickable (toggle) and the component reports its current value via `onChange`. Each engine wraps the Abacus component with exercise-specific logic (question generation, scoring, step-by-step guidance).

**Tech Stack:** React, TypeScript, Tailwind CSS, Framer Motion

**Spec:** `docs/superpowers/specs/2026-04-15-abacus-module-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/components/abacus/Abacus.tsx` | Create | Core interactive soroban component — rods, beads, click to toggle, value reading |
| `frontend/src/components/abacus/TutorialEngine.tsx` | Create | Step-by-step tutorial — shows instructions, highlights rods, checks target values |
| `frontend/src/components/abacus/BeadSlideTestEngine.tsx` | Create | Test mode — generates questions, kid answers via abacus, scoring |
| `frontend/src/components/abacus/MentalMathEngine.tsx` | Create | Flash problem → type answer, no abacus visible |
| `frontend/src/components/abacus/MixedTestEngine.tsx` | Create | Alternates bead_slide and mental_math questions |
| `frontend/src/components/abacus/PracticeEngine.tsx` | Create | Free practice — abacus + question, no scoring pressure |
| `frontend/src/app/abacus/[slug]/level/[levelId]/page.tsx` | Modify | Import engines, replace placeholders |

---

## Engine Interface

Every engine receives these props:

```typescript
interface AbacusEngineProps {
  config: {
    operations: string[];
    number_range: [number, number];
    num_rods: number;
    question_count: number;
    time_limit_seconds: number | null;
    flash_duration_ms: number;
    pass_percentage: number;
  };
  content: {
    steps?: Array<{
      instruction: string;
      instruction_bn?: string;
      target_value: number;
      highlight_rods: number[];
    }>;
  };
  elapsed: number;
  onComplete: (result: {
    score: number;
    total_points: number;
    time_seconds: number;
    passed: boolean;
    stars: number;
    attempt_data: Record<string, unknown>;
  }) => void;
  isPreview?: boolean;
}
```

---

### Task 1: Core Abacus Component

**Files:**
- Create: `frontend/src/components/abacus/Abacus.tsx`

- [ ] **Step 1: Create the interactive soroban component**

This is the heart of the module. A visual Japanese soroban abacus.

**Props:**
```typescript
interface AbacusProps {
  rods?: number;           // number of rods (default 1, max 13)
  value?: number;          // controlled value (optional)
  onChange?: (value: number) => void;  // called when beads change
  readOnly?: boolean;      // disable interaction
  highlightRods?: number[]; // array of rod indices to highlight (for tutorials)
  showValue?: boolean;     // show digit below each rod (default true)
  size?: "sm" | "md" | "lg"; // size preset
}
```

**Visual structure (top to bottom):**
- Frame: rounded rectangle with warm wood/bamboo color (`bg-amber-50 border-2 border-amber-300 rounded-2xl`)
- Heaven section (top): 1 bead per rod, separated from earth by the beam
- Beam: horizontal divider bar (`bg-amber-700 h-1.5`)
- Earth section (bottom): 4 beads per rod
- Rod labels below: "Ones", "Tens", "Hundreds", etc. (right-to-left, rod 0 = rightmost = ones)
- Value display: digit below each rod label (if `showValue`)

**Bead rendering:**
- Each bead is a rounded rectangle/pill shape: `w-10 h-6 rounded-full` (md size)
- Inactive bead: `bg-gray-300 border border-gray-400`
- Active bead (pushed toward beam): `bg-amber-500 border border-amber-600 shadow-md`
- Highlighted rod beads: `ring-2 ring-purple-400` (for tutorials)
- Beads are vertically stacked on each rod with small gaps

**Bead positions:**
- Heaven bead: inactive = at top of heaven section (away from beam), active = at bottom touching beam
- Earth beads: inactive = at bottom of earth section (away from beam), active = at top touching beam
- Use absolute positioning or flexbox with order to move beads

**Click interaction:**
- Click a heaven bead → toggle it (toward/away from beam)
- Click an earth bead → if inactive, activate it AND all beads below it (push all up to beam). If active, deactivate it AND all beads above it (pull all down from beam). This mimics real abacus physics where you push a group of beads, not individual ones.
- Example: if 2 earth beads are active and you click the 3rd bead → activate 3rd (now 3 active). If you click the 2nd bead → deactivate 2nd and 3rd (now 1 active).

**Value calculation:**
- Per rod: (heaven active ? 5 : 0) + (count of active earth beads)
- Total: sum of rod_value × 10^rod_index for all rods
- Rod 0 is rightmost (ones), rod 1 is tens, etc.

**State management:**
- Internal state: `beadState` — array of `{ heaven: boolean, earth: number }` per rod (earth = count of active earth beads, 0-4)
- On every click: recalculate value, call `onChange(newValue)`
- If `value` prop changes externally: update bead state to match (for programmatic control)

**Reset function:**
- Expose via `ref` using `useImperativeHandle`, or just respond to `value=0` prop

**Responsive sizing:**
- `sm`: bead `w-7 h-4`, gap `gap-0.5`
- `md`: bead `w-10 h-6`, gap `gap-1` (default)
- `lg`: bead `w-14 h-7`, gap `gap-1.5`

**Animation:**
- Bead slide: CSS transition `transition-all duration-200 ease-out` on position changes
- Click feedback: brief scale pulse on the clicked bead

**Touch support:**
- Beads are buttons with `cursor-pointer`
- Large enough tap targets (min 28px height even on sm)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/abacus/Abacus.tsx
git commit -m "feat(abacus): add interactive soroban bead component"
```

---

### Task 2: Tutorial Engine

**Files:**
- Create: `frontend/src/components/abacus/TutorialEngine.tsx`

- [ ] **Step 1: Create the tutorial engine**

Guides kids step-by-step through bead manipulation.

**Behavior:**
1. Read `content.steps` array from props
2. Show first step's instruction text (bilingual — show EN, BN below if available)
3. Highlight the relevant rods (from `step.highlight_rods`)
4. Render the `<Abacus>` component with `highlightRods` prop
5. Kid manipulates the abacus
6. When abacus value matches `step.target_value` → green flash, show "Correct!" briefly, then advance to next step
7. Show step progress: "Step 2/5"
8. After all steps → auto-complete with 3 stars (tutorials always pass)
9. Call `onComplete({ score: steps.length, total_points: steps.length, time_seconds: elapsed, passed: true, stars: 3, attempt_data: { steps_completed: steps.length } })`

**UI layout:**
- Top: instruction text in a card (`bg-blue-50 border border-blue-200 rounded-xl p-4`)
- Center: `<Abacus>` component (size `lg`)
- Bottom: step progress + "Reset Abacus" button
- When value matches: animated checkmark overlay, auto-advance after 1s

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/abacus/TutorialEngine.tsx
git commit -m "feat(abacus): add tutorial step-by-step engine"
```

---

### Task 3: Bead Slide Test Engine

**Files:**
- Create: `frontend/src/components/abacus/BeadSlideTestEngine.tsx`

- [ ] **Step 1: Create the bead slide test engine**

Generates math questions, kid answers by manipulating the abacus.

**Question generation (on mount, `useMemo`):**
- If `operations` is empty → counting mode: just show a number, kid represents it on abacus
- If `operations` has values → arithmetic: generate `a OP b = ?` problems
  - Same generation logic as ArithmeticEngine (from games): respect number_range, no negative results for subtraction, even division
- Generate `question_count` questions

**Game loop:**
1. Show question: large text "Show 7 on the abacus" (counting) or "3 + 4 = ?" (arithmetic)
2. Kid manipulates abacus
3. "Check" button → read abacus value, compare to correct answer
4. Correct: green flash, +1 score, auto-advance after 0.8s
5. Wrong: red shake on abacus frame, show "The answer is X" briefly, advance after 1.5s
6. Track score and mistakes

**Completion:**
- `total_points` = question_count
- `score` = correct answers
- `passed` = (score / total_points * 100) >= pass_percentage
- Stars: 3 if ≥95%, 2 if ≥ pass_percentage, 1 if below
- Call `onComplete`

**UI layout:**
- Top: question text + progress bar
- Center: `<Abacus>` (num_rods from config)
- Bottom: "Check Answer" button + "Reset" button

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/abacus/BeadSlideTestEngine.tsx
git commit -m "feat(abacus): add bead slide test engine"
```

---

### Task 4: Mental Math Engine

**Files:**
- Create: `frontend/src/components/abacus/MentalMathEngine.tsx`

- [ ] **Step 1: Create the mental math engine**

Flash a math problem briefly, kid types the answer without an abacus.

**Behavior:**
1. Generate questions (same as BeadSlideTestEngine)
2. Show question with a countdown ring animation for `flash_duration_ms` (e.g., 3 seconds)
3. After flash duration → question text hides, large number input appears
4. Kid types answer, presses Enter or "Submit" button
5. Correct: green flash, +1 score
6. Wrong: red flash, show correct answer
7. Advance to next after 0.8s

**Flash countdown UI:**
- Large math expression: "12 + 8 = ?"
- Circular countdown ring around it (SVG circle with `stroke-dashoffset` animation, same pattern as exam score donut but counting down)
- When timer hits 0: expression fades out, input fades in

**Number input:**
- Large centered input: `text-4xl font-black font-mono text-center`, auto-focus
- Submit on Enter key
- "Submit" button below

**Completion:** Same scoring as BeadSlideTestEngine.

**No abacus visible** — the whole point is mental visualization.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/abacus/MentalMathEngine.tsx
git commit -m "feat(abacus): add mental math flash engine"
```

---

### Task 5: Mixed Test Engine

**Files:**
- Create: `frontend/src/components/abacus/MixedTestEngine.tsx`

- [ ] **Step 1: Create the mixed test engine**

Alternates between bead_slide and mental_math questions.

**Behavior:**
1. Generate questions (same logic)
2. For each question, alternate type: even indices = bead_slide, odd indices = mental_math
3. Bead slide questions: show abacus, kid manipulates, "Check" button
4. Mental math questions: flash problem, hide, type answer
5. Track combined score

**Implementation:** Reuse the question generation logic. For each question, render either the abacus-based UI or the mental math UI based on the alternating pattern. Can literally import and compose from the other engines, or just inline both UIs in a conditional.

**Completion:** Same scoring as others.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/abacus/MixedTestEngine.tsx
git commit -m "feat(abacus): add mixed test engine (bead + mental alternating)"
```

---

### Task 6: Practice Engine

**Files:**
- Create: `frontend/src/components/abacus/PracticeEngine.tsx`

- [ ] **Step 1: Create the practice engine**

Free practice — questions with abacus, no scoring pressure.

**Behavior:**
1. Generate questions from config (same logic)
2. Show question + abacus
3. Kid tries, clicks "Check" — if correct, celebrate + next. If wrong, show hint ("Try again!") but don't penalize.
4. No pass/fail — always completes successfully
5. After all questions: auto-complete with 3 stars

**UI:** Same as BeadSlideTestEngine but without score pressure. "Check" button shows feedback, "Skip" button to move to next question. Encouraging messages on wrong attempts.

**Completion:**
- Always passes, always 3 stars
- Score = questions completed

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/abacus/PracticeEngine.tsx
git commit -m "feat(abacus): add practice mode engine"
```

---

### Task 7: Wire Engines into Play Page

**Files:**
- Modify: `frontend/src/app/abacus/[slug]/level/[levelId]/page.tsx`

- [ ] **Step 1: Import engines and replace placeholders**

Add imports:
```typescript
import TutorialEngine from "@/components/abacus/TutorialEngine";
import BeadSlideTestEngine from "@/components/abacus/BeadSlideTestEngine";
import MentalMathEngine from "@/components/abacus/MentalMathEngine";
import MixedTestEngine from "@/components/abacus/MixedTestEngine";
import PracticeEngine from "@/components/abacus/PracticeEngine";
```

Replace the placeholder `<div>` blocks with:

```tsx
{level.level_type === "tutorial" && (
  <TutorialEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
)}
{level.level_type === "test" && level.exercise_type === "bead_slide" && (
  <BeadSlideTestEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
)}
{level.level_type === "test" && level.exercise_type === "mental_math" && (
  <MentalMathEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
)}
{level.level_type === "test" && level.exercise_type === "mixed" && (
  <MixedTestEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
)}
{level.level_type === "practice" && (
  <PracticeEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/abacus/ frontend/src/components/abacus/
git commit -m "feat(abacus): wire all engines into level play page"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Test Tutorial Level**
1. Create abacus course with defaults
2. Play Level 1 (Counting 1-4 Tutorial)
3. Verify: instruction shows, rods highlighted, bead clicks work, value matches target → advances, all steps → celebration

- [ ] **Step 2: Test Bead Slide Test Level**
1. Complete Level 1 to unlock Level 2
2. Play Level 2 (Counting 1-4 Test)
3. Verify: questions appear, manipulate abacus, Check button validates, scoring works, pass/fail

- [ ] **Step 3: Test Mental Math Level**
1. Progress to Level 12 (or preview it)
2. Verify: problem flashes briefly, disappears, type answer, scoring

- [ ] **Step 4: Test Level Progression**
1. Complete Level 2 with ≥80%
2. Go back to course page
3. Verify: Level 2 shows completed with stars, Level 3 is unlocked
