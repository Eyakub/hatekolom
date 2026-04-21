"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Pair {
  image_url: string;
  label: string;
  label_bn?: string;
}

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

interface Card {
  id: number;
  pairIndex: number;
  image_url: string;
  label: string;
  label_bn?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Parse "3x4" → { cols: 3, rows: 4 } */
function parseGrid(grid: string): { cols: number; rows: number } {
  const [colStr, rowStr] = grid.split("x");
  return { cols: parseInt(colStr, 10), rows: parseInt(rowStr, 10) };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MemoryEngine({
  config,
  elapsed,
  onComplete,
}: GameEngineProps) {
  const { cols } = parseGrid(config.grid || "3x4");
  const pairs: Pair[] = config.pairs || [];

  /* ---- Build shuffled deck once ---- */
  const [cards] = useState<Card[]>(() => {
    const deck: Card[] = [];
    pairs.forEach((pair, idx) => {
      // Two cards per pair
      deck.push({
        id: idx * 2,
        pairIndex: idx,
        image_url: pair.image_url,
        label: pair.label,
        label_bn: pair.label_bn,
      });
      deck.push({
        id: idx * 2 + 1,
        pairIndex: idx,
        image_url: pair.image_url,
        label: pair.label,
        label_bn: pair.label_bn,
      });
    });
    return shuffle(deck);
  });

  /* ---- Game state ---- */
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [shaking, setShaking] = useState<Set<number>>(new Set());
  const [justMatched, setJustMatched] = useState<Set<number>>(new Set());
  const [completed, setCompleted] = useState(false);

  /* ---- Completion check ---- */
  const checkCompletion = useCallback(
    (matchedSet: Set<number>, currentMistakes: number) => {
      if (matchedSet.size === cards.length && !completed) {
        setCompleted(true);
        const pairCount = pairs.length;
        let stars: number;
        if (currentMistakes <= 1) stars = 3;
        else if (currentMistakes <= 3) stars = 2;
        else stars = 1;

        onComplete({
          score: pairCount,
          total_points: pairCount,
          time_seconds: elapsed,
          stars,
          attempt_data: {
            mistakes: currentMistakes,
            total_pairs: pairCount,
            total_flips: currentMistakes * 2 + pairCount * 2,
          },
        });
      }
    },
    [cards.length, completed, elapsed, onComplete, pairs.length],
  );

  /* ---- Handle card click ---- */
  const handleCardClick = useCallback(
    (cardId: number) => {
      // Ignore clicks while checking, on already matched/flipped cards
      if (isChecking) return;
      if (matched.has(cardId)) return;
      if (flipped.has(cardId)) return;
      if (selected.length >= 2) return;

      // Flip the card
      const newFlipped = new Set(flipped);
      newFlipped.add(cardId);
      setFlipped(newFlipped);

      const newSelected = [...selected, cardId];
      setSelected(newSelected);

      // If two cards selected, check for match
      if (newSelected.length === 2) {
        setIsChecking(true);
        const [firstId, secondId] = newSelected;
        const firstCard = cards.find((c) => c.id === firstId)!;
        const secondCard = cards.find((c) => c.id === secondId)!;

        if (firstCard.pairIndex === secondCard.pairIndex) {
          // Match!
          const newMatched = new Set(matched);
          newMatched.add(firstId);
          newMatched.add(secondId);

          // Trigger match pulse
          const newJustMatched = new Set<number>();
          newJustMatched.add(firstId);
          newJustMatched.add(secondId);
          setJustMatched(newJustMatched);

          // Clear pulse after animation
          setTimeout(() => setJustMatched(new Set()), 600);

          setMatched(newMatched);
          setSelected([]);
          setIsChecking(false);
          checkCompletion(newMatched, mistakes);
        } else {
          // Mismatch — shake then flip back
          setMistakes((prev) => prev + 1);

          const newShaking = new Set<number>();
          newShaking.add(firstId);
          newShaking.add(secondId);
          setShaking(newShaking);

          setTimeout(() => {
            setShaking(new Set());
            const resetFlipped = new Set(newFlipped);
            resetFlipped.delete(firstId);
            resetFlipped.delete(secondId);
            setFlipped(resetFlipped);
            setSelected([]);
            setIsChecking(false);
          }, 1000);
        }
      }
    },
    [isChecking, matched, flipped, selected, cards, checkCompletion, mistakes],
  );

  /* ---- Completion via effect as safety net ---- */
  useEffect(() => {
    if (matched.size === cards.length && cards.length > 0) {
      checkCompletion(matched, mistakes);
    }
  }, [matched, cards.length, checkCompletion, mistakes]);

  /* ---- Render ---- */
  const isCardFlipped = (id: number) => flipped.has(id) || matched.has(id);
  const isCardMatched = (id: number) => matched.has(id);
  const isCardShaking = (id: number) => shaking.has(id);
  const isCardJustMatched = (id: number) => justMatched.has(id);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Score bar */}
      <div className="flex items-center gap-4 text-sm font-bold font-bn">
        <span className="px-3 py-1.5 rounded-full bg-[#f3f0ff] text-[#5341CD]">
          {matched.size / 2} / {pairs.length} pairs
        </span>
        <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-500">
          {mistakes} mistake{mistakes !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Card grid */}
      <div
        className="grid w-full max-w-2xl mx-auto gap-3"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(70px, 1fr))`,
        }}
      >
        {cards.map((card) => {
          const isFlipped = isCardFlipped(card.id);
          const isMatched_ = isCardMatched(card.id);
          const isShaking_ = isCardShaking(card.id);
          const isPulsing = isCardJustMatched(card.id);

          return (
            <motion.button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              disabled={isChecking && !flipped.has(card.id)}
              className="aspect-square min-w-[70px] min-h-[48px] cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5341CD] focus-visible:ring-offset-2 rounded-xl"
              style={{ perspective: 600 }}
              animate={
                isPulsing
                  ? { scale: [1, 1.1, 1] }
                  : isShaking_
                    ? { x: [0, -5, 5, -5, 0] }
                    : { scale: 1, x: 0 }
              }
              transition={
                isPulsing
                  ? { duration: 0.4, ease: "easeInOut" }
                  : isShaking_
                    ? { duration: 0.4, ease: "easeInOut" }
                    : { duration: 0.2 }
              }
            >
              <div
                className="relative w-full h-full"
                style={{
                  transformStyle: "preserve-3d",
                  transition: "transform 0.5s ease",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Card BACK (visible when not flipped) */}
                <div
                  className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#5341CD] to-[#7C3AED] shadow-lg flex items-center justify-center"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <span className="text-white text-4xl sm:text-5xl font-black select-none">
                    ?
                  </span>
                </div>

                {/* Card FRONT (visible when flipped) */}
                <div
                  className={`absolute inset-0 rounded-xl shadow-lg overflow-hidden flex flex-col items-center justify-center bg-white ${
                    isMatched_
                      ? "ring-3 ring-green-400 ring-offset-1"
                      : ""
                  }`}
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div className="flex-1 w-full relative overflow-hidden rounded-t-xl">
                    <img
                      src={card.image_url}
                      alt={card.label}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <div className="w-full px-1 py-1 text-center">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-700 leading-tight truncate font-bn">
                      {card.label_bn || card.label}
                    </p>
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
