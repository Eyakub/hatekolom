"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "motion/react";

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

interface DragItem {
  id: string;
  content: string;
  content_bn?: string;
  image_url?: string;
}

interface DropTarget {
  id: string;
  label: string;
  label_bn?: string;
  image_url?: string;
  correct_item_ids: string[];
}

/** Framer Motion pan info shape (inlined to avoid import issues) */
interface PanInfo {
  point: { x: number; y: number };
  delta: { x: number; y: number };
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Playful target border colours — cycles through these */
const TARGET_COLORS = [
  { border: "border-orange-400", bg: "bg-orange-50", badge: "bg-orange-100 text-orange-700" },
  { border: "border-blue-400", bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700" },
  { border: "border-emerald-400", bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  { border: "border-purple-400", bg: "bg-purple-50", badge: "bg-purple-100 text-purple-700" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DragDropEngine({
  config,
  elapsed,
  onComplete,
}: GameEngineProps) {
  const items: DragItem[] = config?.items ?? [];
  const targets: DropTarget[] = config?.targets ?? [];

  /* ---- State ---- */
  // Map of targetId -> array of placed item ids
  const [placements, setPlacements] = useState<Record<string, string[]>>({});
  const [mistakes, setMistakes] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [shakingTarget, setShakingTarget] = useState<string | null>(null);

  /* ---- Refs for target hit-testing ---- */
  const targetRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ---- Derived: which items are already placed ---- */
  const placedItemIds = new Set(
    Object.values(placements).flat(),
  );
  const unplacedItems = items.filter((item) => !placedItemIds.has(item.id));

  /* ---- Completion check ---- */
  const checkCompletion = useCallback(
    (nextPlacements: Record<string, string[]>, currentMistakes: number) => {
      const totalPlaced = Object.values(nextPlacements).flat().length;
      if (totalPlaced === items.length && !completed) {
        setCompleted(true);
        const totalPoints = items.length;
        const stars =
          currentMistakes <= 1 ? 3 : currentMistakes <= 3 ? 2 : 1;

        onComplete({
          score: totalPoints,
          total_points: totalPoints,
          time_seconds: elapsed,
          stars,
          attempt_data: {
            mistakes: currentMistakes,
            placements: nextPlacements,
          },
        });
      }
    },
    [items.length, completed, elapsed, onComplete],
  );

  /* ---- Safety-net effect for completion ---- */
  useEffect(() => {
    const totalPlaced = Object.values(placements).flat().length;
    if (totalPlaced === items.length && items.length > 0) {
      checkCompletion(placements, mistakes);
    }
  }, [placements, items.length, checkCompletion, mistakes]);

  /* ---- Drop handler ---- */
  const handleDragEnd = useCallback(
    (
      itemId: string,
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: PanInfo,
    ) => {
      const point = info.point;

      for (let i = 0; i < targetRefs.current.length; i++) {
        const el = targetRefs.current[i];
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (
          point.x >= rect.left &&
          point.x <= rect.right &&
          point.y >= rect.top &&
          point.y <= rect.bottom
        ) {
          const target = targets[i];

          if (target.correct_item_ids.includes(itemId)) {
            /* ---- CORRECT ---- */
            setPlacements((prev) => {
              const next = {
                ...prev,
                [target.id]: [...(prev[target.id] || []), itemId],
              };
              // Use setTimeout so state is committed first
              setTimeout(() => checkCompletion(next, mistakes), 0);
              return next;
            });
          } else {
            /* ---- WRONG ---- */
            setMistakes((prev) => prev + 1);
            setShakingTarget(target.id);
            setTimeout(() => setShakingTarget(null), 500);
          }
          return;
        }
      }
      // Dropped outside any target — dragSnapToOrigin handles the bounce-back
    },
    [targets, checkCompletion, mistakes],
  );

  /* ---- Helpers ---- */
  const getItemById = (id: string) => items.find((item) => item.id === id);
  const colorFor = (idx: number) => TARGET_COLORS[idx % TARGET_COLORS.length];

  /* ---- Render ---- */
  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Score bar */}
      <div className="flex items-center gap-4 text-sm font-bold font-bn">
        <span className="px-3 py-1.5 rounded-full bg-[#f3f0ff] text-[#5341CD]">
          {placedItemIds.size} / {items.length} placed
        </span>
        <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-500">
          {mistakes} mistake{mistakes !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Main layout: items left / targets right (stacked on mobile) */}
      <div className="w-full flex flex-col lg:flex-row gap-6">
        {/* ====== Items panel (draggable cards) ====== */}
        <div className="w-full lg:w-[40%]">
          <h3 className="text-sm font-bold text-gray-500 mb-3 font-bn">
            Drag these items
          </h3>
          <div className="flex flex-wrap gap-3 min-h-[60px]">
            {unplacedItems.length === 0 && (
              <p className="text-sm text-gray-400 italic font-bn">
                All items placed!
              </p>
            )}
            {unplacedItems.map((item) => (
              <motion.div
                key={item.id}
                drag
                dragSnapToOrigin
                onDragEnd={(event, info) =>
                  handleDragEnd(item.id, event as MouseEvent, info)
                }
                whileDrag={{
                  scale: 1.05,
                  rotate: 3,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  zIndex: 50,
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{ touchAction: "none", zIndex: 1 }}
                className="bg-white rounded-xl border-2 border-gray-200 shadow-sm px-4 py-3 cursor-grab active:cursor-grabbing flex items-center gap-3 select-none"
              >
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.content}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    draggable={false}
                  />
                )}
                <span className="text-sm font-bold text-gray-700 font-bn">
                  {item.content_bn || item.content}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ====== Targets panel (drop zones) ====== */}
        <div className="w-full lg:w-[60%] flex flex-col gap-4">
          {targets.map((target, idx) => {
            const color = colorFor(idx);
            const isShaking = shakingTarget === target.id;
            const placedIds = placements[target.id] || [];

            return (
              <motion.div
                key={target.id}
                ref={(el) => {
                  targetRefs.current[idx] = el;
                }}
                animate={
                  isShaking
                    ? { x: [0, -6, 6, -6, 6, 0] }
                    : { x: 0 }
                }
                transition={
                  isShaking
                    ? { duration: 0.4, ease: "easeInOut" }
                    : { duration: 0.2 }
                }
                className={`border-2 border-dashed ${color.border} ${color.bg} rounded-2xl p-4 min-h-[100px] transition-colors`}
              >
                {/* Target header */}
                <div className="flex items-center gap-3 mb-3">
                  {target.image_url && (
                    <img
                      src={target.image_url}
                      alt={target.label}
                      className="w-10 h-10 rounded-lg object-cover"
                      draggable={false}
                    />
                  )}
                  <span className="text-base font-bold text-gray-700 font-bn">
                    {target.label_bn || target.label}
                  </span>
                </div>

                {/* Placed items as badges */}
                <div className="flex flex-wrap gap-2">
                  {placedIds.length === 0 && (
                    <span className="text-xs text-gray-400 italic font-bn">
                      Drop items here
                    </span>
                  )}
                  {placedIds.map((pid) => {
                    const placedItem = getItemById(pid);
                    if (!placedItem) return null;
                    return (
                      <motion.span
                        key={pid}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${color.badge} font-bn`}
                      >
                        {placedItem.image_url && (
                          <img
                            src={placedItem.image_url}
                            alt={placedItem.content}
                            className="w-6 h-6 rounded-full object-cover"
                            draggable={false}
                          />
                        )}
                        {placedItem.content_bn || placedItem.content}
                        <svg
                          className="w-4 h-4 text-green-500 flex-shrink-0"
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
                      </motion.span>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
