"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, Reorder } from "motion/react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GameEngineProps {
  config: any;
  elapsed: number;
  onComplete: (result: {
    score: number;
    total_points: number;
    time_seconds: number;
    stars: number;
    attempt_data: Record<string, unknown>;
  }) => void;
  isPreview?: boolean;
}

interface Step {
  id: string;
  image_url: string;
  label: string;
  label_bn?: string;
  sort_order: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Fisher-Yates shuffle (returns new array) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ImageSequenceEngine({
  config,
  elapsed,
  onComplete,
}: GameEngineProps) {
  /* ---- Derive steps with stable ids ---- */
  const steps: Step[] = useMemo(
    () =>
      ((config?.steps ?? []) as any[]).map(
        (s: any, i: number) =>
          ({
            id: `step-${s.sort_order ?? i}`,
            image_url: s.image_url ?? "",
            label: s.label ?? `Step ${i + 1}`,
            label_bn: s.label_bn,
            sort_order: s.sort_order ?? i,
          }) satisfies Step,
      ),
    [config?.steps],
  );

  const referenceImageUrl: string | undefined = config?.reference_image_url;

  /* ---- Correct order (sorted by sort_order) ---- */
  const correctOrder = useMemo(
    () => [...steps].sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id),
    [steps],
  );

  /* ---- Shuffled initial order (stable across renders) ---- */
  const initialOrder = useMemo(() => shuffle(steps), [steps]);

  /* ---- State ---- */
  const [items, setItems] = useState<Step[]>(initialOrder);
  const [checkAttempts, setCheckAttempts] = useState(0);
  const [completed, setCompleted] = useState(false);
  /** Set of step ids that are locked (correctly placed) */
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  /** Feedback per step id: "correct" | "wrong" | null */
  const [feedback, setFeedback] = useState<Record<string, "correct" | "wrong" | null>>({});

  /* ---- Check answer handler ---- */
  const handleCheck = useCallback(() => {
    if (completed) return;

    const attempt = checkAttempts + 1;
    setCheckAttempts(attempt);

    const currentIds = items.map((item) => item.id);
    const nextFeedback: Record<string, "correct" | "wrong" | null> = {};
    const nextLocked = new Set(lockedIds);
    let allCorrect = true;

    currentIds.forEach((id, index) => {
      if (lockedIds.has(id)) {
        nextFeedback[id] = "correct";
        return;
      }
      if (id === correctOrder[index]) {
        nextFeedback[id] = "correct";
        nextLocked.add(id);
      } else {
        nextFeedback[id] = "wrong";
        allCorrect = false;
      }
    });

    setFeedback(nextFeedback);
    setLockedIds(nextLocked);

    if (allCorrect) {
      setCompleted(true);
      const totalPoints = steps.length;
      const stars = attempt <= 1 ? 3 : attempt <= 3 ? 2 : 1;
      onComplete({
        score: totalPoints,
        total_points: totalPoints,
        time_seconds: elapsed,
        stars,
        attempt_data: {
          checkAttempts: attempt,
          finalOrder: currentIds,
        },
      });
    } else {
      /* Clear wrong highlights after 1.5s so the kid can retry */
      setTimeout(() => {
        setFeedback((prev) => {
          const cleaned: Record<string, "correct" | "wrong" | null> = {};
          for (const [key, val] of Object.entries(prev)) {
            cleaned[key] = val === "wrong" ? null : val;
          }
          return cleaned;
        });
      }, 1500);
    }
  }, [items, correctOrder, checkAttempts, completed, lockedIds, steps.length, elapsed, onComplete]);

  /* ---- Reorder handler (prevent reordering locked items) ---- */
  const handleReorder = useCallback(
    (newOrder: Step[]) => {
      if (completed) return;
      /* Ensure locked items stay in their positions */
      if (lockedIds.size > 0) {
        const result = [...newOrder];
        /* Put locked items back in their correct positions */
        for (let i = 0; i < correctOrder.length; i++) {
          if (lockedIds.has(correctOrder[i])) {
            const step = steps.find((s) => s.id === correctOrder[i]);
            if (step) {
              const currentIdx = result.findIndex((s) => s.id === step.id);
              if (currentIdx !== -1 && currentIdx !== i) {
                result.splice(currentIdx, 1);
                result.splice(i, 0, step);
              }
            }
          }
        }
        setItems(result);
      } else {
        setItems(newOrder);
      }
    },
    [completed, lockedIds, correctOrder, steps],
  );

  /* ---- Render ---- */
  return (
    <div className="w-full flex flex-col items-center gap-6">
      {/* Reference image hint panel */}
      {referenceImageUrl && (
        <div className="w-full max-w-md mx-auto">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-700 mb-2 text-center font-bn">
              🔍 Reference
            </p>
            <img
              src={referenceImageUrl}
              alt="Reference"
              className="aspect-video max-w-md mx-auto rounded-xl object-cover border border-amber-300 w-full"
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-4 text-sm font-bold font-bn">
        <span className="px-3 py-1.5 rounded-full bg-[#f3f0ff] text-[#5341CD]">
          {steps.length} steps
        </span>
        {checkAttempts > 0 && (
          <span className="px-3 py-1.5 rounded-full bg-orange-50 text-orange-600">
            {checkAttempts} attempts
          </span>
        )}
      </div>

      {/* Reorderable list */}
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={handleReorder}
        className="w-full max-w-lg flex flex-col gap-3"
      >
        {items.map((item, index) => {
          const isLocked = lockedIds.has(item.id);
          const fb = feedback[item.id];
          const borderClass =
            fb === "correct"
              ? "border-green-400 bg-green-50"
              : fb === "wrong"
                ? "border-red-400 bg-red-50"
                : "border-gray-200 bg-white";

          return (
            <Reorder.Item
              key={item.id}
              value={item}
              dragListener={!isLocked && !completed}
              style={{ touchAction: "none" }}
              className={`rounded-2xl border-2 shadow-sm p-3 flex items-center gap-4 select-none ${borderClass} ${
                isLocked || completed
                  ? "cursor-default"
                  : "cursor-grab active:cursor-grabbing"
              }`}
            >
              {/* Position number */}
              <div className="w-8 h-8 rounded-full bg-[#5341CD] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                {index + 1}
              </div>

              {/* Step image */}
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.label}
                  className="aspect-square w-24 sm:w-32 rounded-xl object-cover flex-shrink-0"
                  draggable={false}
                />
              )}

              {/* Label */}
              <span className="text-sm sm:text-base font-bold text-gray-700 font-bn flex-1">
                {item.label_bn || item.label}
              </span>

              {/* Feedback icon */}
              {fb === "correct" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <svg
                    className="w-6 h-6 text-green-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              )}
              {fb === "wrong" && (
                <motion.div
                  animate={{ x: [0, -4, 4, -4, 4, 0] }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                  <svg
                    className="w-6 h-6 text-red-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </motion.div>
              )}

              {/* Drag handle (grip icon) — hidden when locked */}
              {!isLocked && !completed && (
                <div className="flex flex-col gap-0.5 flex-shrink-0 text-gray-400">
                  <span className="block w-4 h-0.5 bg-current rounded-full" />
                  <span className="block w-4 h-0.5 bg-current rounded-full" />
                  <span className="block w-4 h-0.5 bg-current rounded-full" />
                </div>
              )}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      {/* Check button */}
      {!completed && (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleCheck}
          className="mt-2 px-8 py-3 rounded-full bg-[#5341CD] text-white font-bold text-lg shadow-md hover:bg-[#4332b0] transition-colors font-bn"
        >
          Check Answer ✓
        </motion.button>
      )}

      {/* Completion message */}
      {completed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-4"
        >
          <p className="text-2xl font-bold text-green-600 font-bn">
            🎉 Correct! Well done!
          </p>
        </motion.div>
      )}
    </div>
  );
}
