"use client";

import { useState, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AbacusProps {
  rods?: number;
  value?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  highlightRods?: number[];
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
}

interface RodState {
  heaven: boolean;
  earth: number; // 0-4 active earth beads
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SIZE_CONFIG = {
  sm: {
    bead: "w-8 h-5",
    beadW: 32,
    rod: "w-8",
    rodLine: "w-0.5",
    gap: "gap-0.5",
    frame: "p-3",
    beam: "h-1",
    label: "text-[10px]",
    heavenH: "h-16",
    earthH: "h-28",
  },
  md: {
    bead: "w-12 h-6",
    beadW: 48,
    rod: "w-12",
    rodLine: "w-0.5",
    gap: "gap-1",
    frame: "p-4",
    beam: "h-1.5",
    label: "text-xs",
    heavenH: "h-20",
    earthH: "h-36",
  },
  lg: {
    bead: "w-16 h-7",
    beadW: 64,
    rod: "w-16",
    rodLine: "w-0.5",
    gap: "gap-1.5",
    frame: "p-5",
    beam: "h-2",
    label: "text-sm",
    heavenH: "h-24",
    earthH: "h-44",
  },
} as const;

/** Decompose a number into per-rod bead state. Index 0 = ones place. */
function valueToBeadState(val: number, rodCount: number): RodState[] {
  return Array.from({ length: rodCount }, (_, i) => {
    const digit = Math.floor(val / Math.pow(10, i)) % 10;
    // Clamp digit to 0-9
    const clamped = Math.min(9, Math.max(0, digit));
    return {
      heaven: clamped >= 5,
      earth: clamped >= 5 ? clamped - 5 : clamped,
    };
  });
}

/** Calculate total value from bead state array. */
function calculateValue(beadState: RodState[]): number {
  return beadState.reduce((total, rod, index) => {
    const rodValue = (rod.heaven ? 5 : 0) + rod.earth;
    return total + rodValue * Math.pow(10, index);
  }, 0);
}

/** Format a place-value label: 1, 10, 100, ... */
function placeLabel(rodIndex: number): string {
  if (rodIndex === 0) return "1";
  return "1" + "0".repeat(rodIndex);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface BeadProps {
  active: boolean;
  highlighted: boolean;
  onClick: () => void;
  readOnly: boolean;
  sizeKey: "sm" | "md" | "lg";
}

function Bead({ active, highlighted, onClick, readOnly, sizeKey }: BeadProps) {
  const cfg = SIZE_CONFIG[sizeKey];
  const baseClasses = [
    cfg.bead,
    "rounded-full border relative z-10",
    "transition-all duration-200 ease-out",
    "flex-shrink-0",
  ];

  if (active) {
    baseClasses.push("bg-amber-500 border-amber-600 shadow-sm");
  } else {
    baseClasses.push("bg-gray-300 border-gray-400");
  }

  if (highlighted) {
    baseClasses.push("ring-2 ring-purple-400 ring-offset-1");
  }

  if (!readOnly) {
    baseClasses.push("cursor-pointer hover:brightness-110 active:scale-95");
  }

  return (
    <button
      type="button"
      className={baseClasses.join(" ")}
      onClick={readOnly ? undefined : onClick}
      disabled={readOnly}
      aria-label={active ? "Active bead" : "Inactive bead"}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Single Rod                                                         */
/* ------------------------------------------------------------------ */

interface RodProps {
  rodState: RodState;
  rodIndex: number;
  highlighted: boolean;
  showValue: boolean;
  readOnly: boolean;
  sizeKey: "sm" | "md" | "lg";
  onToggleHeaven: () => void;
  onClickEarth: (beadPosition: number) => void;
}

function Rod({
  rodState,
  rodIndex,
  highlighted,
  showValue,
  readOnly,
  sizeKey,
  onToggleHeaven,
  onClickEarth,
}: RodProps) {
  const cfg = SIZE_CONFIG[sizeKey];
  const { heaven, earth } = rodState;
  const digit = (heaven ? 5 : 0) + earth;

  return (
    <div className={`flex flex-col items-center`}>
      {/* Rod column with vertical line */}
      <div className={`relative flex flex-col items-center ${cfg.rod}`}>
        {/* Vertical rod line — behind everything */}
        <div
          className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 ${cfg.rodLine} bg-amber-800/60 rounded-full`}
        />

        {/* Heaven section: 1 bead that slides toward/away from beam */}
        <div className={`flex flex-col items-center ${cfg.heavenH}`}>
          {/* Space above bead when active (bead slides down to beam) */}
          <div className={`transition-all duration-300 ease-out ${heaven ? "flex-1" : "flex-[0]"}`} />
          <Bead
            active={heaven}
            highlighted={highlighted}
            onClick={onToggleHeaven}
            readOnly={readOnly}
            sizeKey={sizeKey}
          />
          {/* Space below bead when inactive (bead stays at top) */}
          <div className={`transition-all duration-300 ease-out ${!heaven ? "flex-1" : "flex-[0]"}`} />
        </div>

        {/* Beam */}
        <div
          className={`${cfg.beam} w-full bg-amber-700 rounded-full my-0.5 relative z-20 flex-shrink-0`}
        />

        {/* Earth section: 4 beads that slide toward/away from beam */}
        <div className={`flex flex-col items-center ${cfg.earthH} ${cfg.gap}`}>
          {/* Active beads group — touching beam at top */}
          {Array.from({ length: earth }, (_, i) => (
            <Bead
              key={`active-${i}`}
              active={true}
              highlighted={highlighted}
              onClick={() => onClickEarth(i)}
              readOnly={readOnly}
              sizeKey={sizeKey}
            />
          ))}

          {/* Flexible gap between active (top) and inactive (bottom) groups */}
          <div className="flex-1" />

          {/* Inactive beads group — resting at bottom */}
          {Array.from({ length: 4 - earth }, (_, i) => (
            <Bead
              key={`inactive-${i}`}
              active={false}
              highlighted={highlighted}
              onClick={() => onClickEarth(earth + i)}
              readOnly={readOnly}
              sizeKey={sizeKey}
            />
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className={`flex flex-col items-center ${cfg.label} mt-1`}>
        <span className="text-amber-800 font-medium">{placeLabel(rodIndex)}</span>
        {showValue && (
          <span className="text-amber-900 font-bold tabular-nums">{digit}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Abacus({
  rods = 1,
  value,
  onChange,
  readOnly = false,
  highlightRods = [],
  showValue = true,
  size = "md",
}: AbacusProps) {
  const rodCount = Math.min(13, Math.max(1, rods));
  const cfg = SIZE_CONFIG[size];

  // Internal bead state
  const [beadState, setBeadState] = useState<RodState[]>(() =>
    valueToBeadState(value ?? 0, rodCount)
  );

  // Sync internal state when controlled `value` prop changes externally
  useEffect(() => {
    if (value !== undefined) {
      const maxVal = Math.pow(10, rodCount) - 1;
      const clamped = Math.min(maxVal, Math.max(0, value));
      setBeadState(valueToBeadState(clamped, rodCount));
    }
  }, [value, rodCount]);

  // Sync rod count changes
  useEffect(() => {
    setBeadState((prev) => {
      if (prev.length === rodCount) return prev;
      const currentValue = calculateValue(prev);
      return valueToBeadState(currentValue, rodCount);
    });
  }, [rodCount]);

  const updateRod = useCallback(
    (rodIndex: number, updater: (rod: RodState) => RodState) => {
      setBeadState((prev) => {
        const next = prev.map((r, i) => (i === rodIndex ? updater(r) : r));
        // Defer onChange to avoid setState-during-render
        const newValue = calculateValue(next);
        queueMicrotask(() => onChange?.(newValue));
        return next;
      });
    },
    [onChange]
  );

  const handleToggleHeaven = useCallback(
    (rodIndex: number) => {
      updateRod(rodIndex, (rod) => ({ ...rod, heaven: !rod.heaven }));
    },
    [updateRod]
  );

  const handleClickEarth = useCallback(
    (rodIndex: number, beadPosition: number) => {
      updateRod(rodIndex, (rod) => {
        const isActive = beadPosition < rod.earth;
        if (isActive) {
          // Clicking an active bead: deactivate it and all above it (further from beam)
          return { ...rod, earth: beadPosition };
        } else {
          // Clicking an inactive bead: activate it and all below it (closer to beam)
          return { ...rod, earth: beadPosition + 1 };
        }
      });
    },
    [updateRod]
  );

  // Display rods left to right = highest place value to lowest
  // beadState[0] = ones (rightmost), beadState[rodCount-1] = highest (leftmost)
  const displayOrder = Array.from({ length: rodCount }, (_, i) => rodCount - 1 - i);

  const totalValue = calculateValue(beadState);

  return (
    <div className="inline-flex flex-col items-center">
      {/* Frame */}
      <div
        className={`bg-amber-50 border-2 border-amber-300 rounded-2xl ${cfg.frame} shadow-inner`}
      >
        {/* Total value display */}
        <div className="text-center mb-2">
          <span className="text-lg font-bold text-amber-900 tabular-nums tracking-wider">
            {totalValue.toLocaleString()}
          </span>
        </div>

        {/* Rods row */}
        <div className="flex items-start gap-3">
          {displayOrder.map((rodIndex) => (
            <Rod
              key={rodIndex}
              rodState={beadState[rodIndex]}
              rodIndex={rodIndex}
              highlighted={highlightRods.includes(rodIndex)}
              showValue={showValue}
              readOnly={readOnly}
              sizeKey={size}
              onToggleHeaven={() => handleToggleHeaven(rodIndex)}
              onClickEarth={(pos) => handleClickEarth(rodIndex, pos)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
