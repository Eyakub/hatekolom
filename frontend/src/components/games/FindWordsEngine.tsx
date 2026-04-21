"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
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

interface WordEntry {
  word: string;
  word_bn?: string;
}

interface CellCoord {
  row: number;
  col: number;
}

interface WordPlacement {
  word: string;
  word_bn?: string;
  cells: CellCoord[];
  direction: "→" | "↓" | "↘" | "↙";
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Directions: [rowDelta, colDelta, label] */
const DIRECTIONS: [number, number, "→" | "↓" | "↘" | "↙"][] = [
  [0, 1, "→"],   // horizontal right
  [1, 0, "↓"],   // vertical down
  [1, 1, "↘"],   // diagonal down-right
  [1, -1, "↙"],  // diagonal down-left
];

/** Rotating colour palette for found words */
const FOUND_COLORS = [
  "bg-orange-200 text-orange-800",
  "bg-blue-200 text-blue-800",
  "bg-green-200 text-green-800",
  "bg-purple-200 text-purple-800",
  "bg-rose-200 text-rose-800",
  "bg-teal-200 text-teal-800",
];

/* ------------------------------------------------------------------ */
/*  Grid Generation Helpers                                            */
/* ------------------------------------------------------------------ */

function generateGrid(
  words: WordEntry[],
  gridSize: number,
): { grid: string[][]; placements: WordPlacement[] } {
  const grid: string[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ""),
  );

  const placements: WordPlacement[] = [];

  // Sort words longest first — longer words are harder to place
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length);

  for (const entry of sorted) {
    const word = entry.word.toUpperCase();
    let placed = false;

    const shuffledDirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);

    for (let attempt = 0; attempt < 50 && !placed; attempt++) {
      const [dr, dc, dirLabel] = shuffledDirs[attempt % shuffledDirs.length];

      // Calculate valid starting range
      const maxRow =
        dr === 0 ? gridSize - 1 : gridSize - 1 - (word.length - 1) * dr;
      const maxCol =
        dc === 0
          ? gridSize - 1
          : dc > 0
            ? gridSize - 1 - (word.length - 1)
            : gridSize - 1;
      const minCol = dc < 0 ? word.length - 1 : 0;

      if (maxRow < 0 || maxCol < minCol) continue;

      const startRow = Math.floor(Math.random() * (maxRow + 1));
      const startCol =
        minCol + Math.floor(Math.random() * (maxCol - minCol + 1));

      // Check if word fits without conflict
      let fits = true;
      const cells: CellCoord[] = [];

      for (let i = 0; i < word.length; i++) {
        const r = startRow + i * dr;
        const c = startCol + i * dc;

        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
          fits = false;
          break;
        }

        const existing = grid[r][c];
        if (existing !== "" && existing !== word[i]) {
          fits = false;
          break;
        }

        cells.push({ row: r, col: c });
      }

      if (fits) {
        // Place the word
        for (let i = 0; i < word.length; i++) {
          grid[cells[i].row][cells[i].col] = word[i];
        }
        placements.push({
          word,
          word_bn: entry.word_bn,
          cells,
          direction: dirLabel,
        });
        placed = true;
      }
    }
  }

  // Fill empty cells with random letters
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === "") {
        grid[r][c] = String.fromCharCode(
          65 + Math.floor(Math.random() * 26),
        );
      }
    }
  }

  return { grid, placements };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FindWordsEngine({
  config,
  elapsed,
  onComplete,
  isPreview,
}: GameEngineProps) {
  const words: WordEntry[] = config?.words ?? [];
  const gridSize: number = config?.grid_size ?? 10;

  /* ---- Generate grid once ---- */
  const { grid, placements } = useMemo(
    () => generateGrid(words, gridSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ---- State ---- */
  const [selection, setSelection] = useState<CellCoord[]>([]);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  // Map of "row,col" → colour index for found-word highlighting
  const [foundCells, setFoundCells] = useState<Map<string, number>>(new Map());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const isPointerDown = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  /* ---- Helpers ---- */
  const cellKey = (r: number, c: number) => `${r},${c}`;

  // Build a set of all placed word cells for hint highlighting
  const hintCells = useMemo(() => {
    const map = new Map<string, number>();
    placements.forEach((p, idx) => {
      p.cells.forEach((c) => map.set(`${c.row},${c.col}`, idx));
    });
    return map;
  }, [placements]);

  /** Check that a candidate cell extends the current straight line */
  const isValidExtension = useCallback(
    (current: CellCoord[], next: CellCoord): boolean => {
      if (current.length === 0) return true;

      // Must not already be in selection
      if (current.some((c) => c.row === next.row && c.col === next.col))
        return false;

      if (current.length === 1) {
        // Any adjacent cell is fine (establishes direction)
        const dr = Math.abs(next.row - current[0].row);
        const dc = Math.abs(next.col - current[0].col);
        return dr <= 1 && dc <= 1 && (dr + dc > 0);
      }

      // Direction is established from first two cells
      const dirRow = Math.sign(current[1].row - current[0].row);
      const dirCol = Math.sign(current[1].col - current[0].col);

      const last = current[current.length - 1];
      const expectedRow = last.row + dirRow;
      const expectedCol = last.col + dirCol;

      return next.row === expectedRow && next.col === expectedCol;
    },
    [],
  );

  /** Get the word string from selection cells */
  const getSelectionWord = useCallback(
    (sel: CellCoord[]): string => {
      return sel.map((c) => grid[c.row][c.col]).join("");
    },
    [grid],
  );

  /** Check if selection matches any unfound word (forward or reverse) */
  const checkMatch = useCallback(
    (sel: CellCoord[]): WordPlacement | null => {
      const selWord = getSelectionWord(sel);
      const selWordReversed = selWord.split("").reverse().join("");

      for (const placement of placements) {
        if (foundWords.has(placement.word)) continue;
        if (placement.word === selWord || placement.word === selWordReversed) {
          return placement;
        }
      }
      return null;
    },
    [getSelectionWord, placements, foundWords],
  );

  /* ---- Completion ---- */
  const handleCompletion = useCallback(
    (newFoundWords: Set<string>, currentWrongAttempts: number) => {
      if (newFoundWords.size === placements.length && !completed) {
        setCompleted(true);
        const totalPoints = placements.length;
        const stars =
          currentWrongAttempts <= 2 ? 3 : currentWrongAttempts <= 5 ? 2 : 1;

        onComplete({
          score: totalPoints,
          total_points: totalPoints,
          time_seconds: elapsed,
          stars,
          attempt_data: {
            wrong_attempts: currentWrongAttempts,
            total_words: placements.length,
          },
        });
      }
    },
    [placements.length, completed, elapsed, onComplete],
  );

  /* ---- Safety-net effect for completion ---- */
  useEffect(() => {
    if (foundWords.size === placements.length && placements.length > 0) {
      handleCompletion(foundWords, wrongAttempts);
    }
  }, [foundWords, placements.length, handleCompletion, wrongAttempts]);

  /* ---- Cell click/drag handlers using data attributes ---- */
  const getCellFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent): CellCoord | null => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target) return null;
      const cellEl = (target as HTMLElement).closest("[data-row]") as HTMLElement | null;
      if (!cellEl) return null;
      const row = parseInt(cellEl.dataset.row!, 10);
      const col = parseInt(cellEl.dataset.col!, 10);
      if (isNaN(row) || isNaN(col)) return null;
      return { row, col };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const cell = getCellFromEvent(e);
      if (!cell) return;
      isPointerDown.current = true;
      setSelection([cell]);
    },
    [getCellFromEvent],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPointerDown.current) return;
      const cell = getCellFromEvent(e);
      if (!cell) return;
      setSelection((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.row === cell.row && last.col === cell.col) return prev;
        }
        if (isValidExtension(prev, cell)) {
          return [...prev, cell];
        }
        return prev;
      });
    },
    [getCellFromEvent, isValidExtension],
  );

  const finishSelection = useCallback(() => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;

    setSelection((currentSelection) => {
      if (currentSelection.length < 2) {
        return [];
      }

      const matched = checkMatch(currentSelection);

      if (matched) {
        const colorIdx = foundWords.size % FOUND_COLORS.length;

        setFoundCells((prev) => {
          const next = new Map(prev);
          for (const cell of currentSelection) {
            next.set(cellKey(cell.row, cell.col), colorIdx);
          }
          return next;
        });

        setFoundWords((prev) => {
          const next = new Set(prev);
          next.add(matched.word);
          setTimeout(() => handleCompletion(next, wrongAttempts), 0);
          return next;
        });
      } else {
        setWrongAttempts((prev) => prev + 1);
      }

      return [];
    });
  }, [checkMatch, foundWords.size, handleCompletion, wrongAttempts]);

  const handleMouseUp = useCallback(() => {
    finishSelection();
  }, [finishSelection]);

  /* ---- Global mouseup fallback ---- */
  useEffect(() => {
    const handler = () => {
      if (isPointerDown.current) finishSelection();
    };
    document.addEventListener("mouseup", handler);
    document.addEventListener("touchend", handler);
    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("touchend", handler);
    };
  }, [finishSelection]);

  /* ---- Build set of currently selected cells for fast lookup ---- */
  const selectionSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of selection) {
      set.add(cellKey(c.row, c.col));
    }
    return set;
  }, [selection]);

  /* ---- Render ---- */
  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Score bar */}
      <div className="flex items-center gap-4 text-sm font-bold">
        <span className="px-3 py-1.5 rounded-full bg-[#f3f0ff] text-[#5341CD]">
          {foundWords.size} / {placements.length} words found
        </span>
        {isPreview && (
          <button
            onClick={() => setShowHints((p) => !p)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
              showHints
                ? "bg-yellow-200 text-yellow-800"
                : "bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-700"
            }`}
          >
            {showHints ? "Hide Hints" : "Show Hints"}
          </button>
        )}
      </div>

      {/* Main layout: grid + word list */}
      <div className="w-full flex flex-col md:flex-row gap-6 items-start justify-center">
        {/* ====== Letter Grid ====== */}
        <div
          ref={gridRef}
          className="grid select-none gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            const cell = (() => {
              const target = document.elementFromPoint(touch.clientX, touch.clientY);
              if (!target) return null;
              const cellEl = (target as HTMLElement).closest("[data-row]") as HTMLElement | null;
              if (!cellEl) return null;
              return { row: parseInt(cellEl.dataset.row!, 10), col: parseInt(cellEl.dataset.col!, 10) };
            })();
            if (!cell) return;
            e.preventDefault();
            isPointerDown.current = true;
            setSelection([cell]);
          }}
          onTouchMove={(e) => {
            if (!isPointerDown.current) return;
            e.preventDefault();
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (!target) return;
            const cellEl = (target as HTMLElement).closest("[data-row]") as HTMLElement | null;
            if (!cellEl) return;
            const cell = { row: parseInt(cellEl.dataset.row!, 10), col: parseInt(cellEl.dataset.col!, 10) };
            if (isNaN(cell.row) || isNaN(cell.col)) return;
            setSelection((prev) => {
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                if (last.row === cell.row && last.col === cell.col) return prev;
              }
              if (isValidExtension(prev, cell)) return [...prev, cell];
              return prev;
            });
          }}
          onTouchEnd={() => finishSelection()}
        >
            {grid.map((row, rIdx) =>
              row.map((letter, cIdx) => {
                const key = cellKey(rIdx, cIdx);
                const isSelected = selectionSet.has(key);
                const foundColorIdx = foundCells.get(key);
                const isFound = foundColorIdx !== undefined;

                const hintIdx = hintCells.get(key);
                const isHinted = showHints && hintIdx !== undefined && !isFound;

                let cellClass =
                  "bg-white border border-gray-200 text-gray-700";
                if (isSelected) {
                  cellClass = "bg-[#5341CD]/20 text-[#5341CD] border-[#5341CD]/30";
                } else if (isFound) {
                  cellClass = FOUND_COLORS[foundColorIdx];
                } else if (isHinted) {
                  cellClass = "bg-yellow-100 text-yellow-800 border-yellow-300 font-black";
                }

                return (
                  <div
                    key={key}
                    data-row={rIdx}
                    data-col={cIdx}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md text-sm sm:text-base font-bold font-mono flex items-center justify-center select-none cursor-pointer transition-colors duration-100 ${cellClass}`}
                  >
                    {letter}
                  </div>
                );
              }),
            )}
        </div>

        {/* ====== Word List Panel ====== */}
        <div className="w-full md:w-56 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-gray-500 font-bn">
            {foundWords.size}/{placements.length} words found
          </h3>

          <div className="flex flex-col gap-2">
            {placements.map((placement, idx) => {
              const isWordFound = foundWords.has(placement.word);
              const colorIdx = idx % FOUND_COLORS.length;
              // Extract just the bg class for the badge
              const colorClass = FOUND_COLORS[colorIdx];

              return (
                <motion.div
                  key={placement.word}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold font-bn ${
                    isWordFound
                      ? colorClass
                      : "bg-gray-50 text-gray-700"
                  }`}
                  initial={false}
                  animate={isWordFound ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {isWordFound && (
                    <svg
                      className="w-4 h-4 flex-shrink-0"
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
                  )}
                  <span className={isWordFound ? "line-through" : ""}>
                    {placement.word_bn || placement.word}
                  </span>
                  <span className={`text-xs opacity-60 ${isWordFound ? "line-through" : ""}`}>
                    ({placement.word})
                  </span>
                  <span className="text-xs opacity-40 ml-auto" title={
                    placement.direction === "→" ? "Horizontal" :
                    placement.direction === "↓" ? "Vertical" :
                    "Diagonal"
                  }>
                    {placement.direction}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
