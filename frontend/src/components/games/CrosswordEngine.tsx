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

interface WordDef {
  word: string;
  word_bn?: string;
  clue: string;
  clue_bn?: string;
}

interface Placement {
  wordIndex: number;
  startRow: number;
  startCol: number;
  direction: "across" | "down";
  word: string;
}

interface Cell {
  letter: string | null;
  wordIndices: number[];
}

/* ------------------------------------------------------------------ */
/*  Grid generation                                                    */
/* ------------------------------------------------------------------ */

function generateGrid(words: WordDef[]): {
  grid: Cell[][];
  placements: Placement[];
  rows: number;
  cols: number;
} {
  const GRID_SIZE = 20;

  // Working grid — we use a Map keyed by "row,col" for sparse storage
  const occupied = new Map<string, { letter: string; wordIndices: number[] }>();
  const placements: Placement[] = [];

  // Sort by length descending
  const sorted = words
    .map((w, i) => ({ word: w.word.toUpperCase(), index: i }))
    .sort((a, b) => b.word.length - a.word.length);

  const key = (r: number, c: number) => `${r},${c}`;

  /** Check if a word can be placed at given position without conflict */
  function canPlace(
    word: string,
    startRow: number,
    startCol: number,
    dir: "across" | "down"
  ): boolean {
    const dr = dir === "down" ? 1 : 0;
    const dc = dir === "across" ? 1 : 0;

    for (let i = 0; i < word.length; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      const k = key(r, c);
      const existing = occupied.get(k);

      if (existing) {
        // Must match the letter at this cell
        if (existing.letter !== word[i]) return false;
      } else {
        // Check adjacent cells for parallel conflicts
        // For across words, check cells above and below
        // For down words, check cells left and right
        const perpDr = dir === "across" ? 1 : 0;
        const perpDc = dir === "down" ? 1 : 0;

        const adj1 = occupied.get(key(r + perpDr, c + perpDc));
        const adj2 = occupied.get(key(r - perpDr, c - perpDc));

        // If an adjacent perpendicular cell is occupied but not an intersection,
        // it would create an unintended adjacency
        if (adj1 && !occupied.get(k)) {
          // Check if it's a legitimate crossing — only block if the adjacent cell
          // is part of a word running parallel to ours
          const adjOccupied = occupied.get(key(r + perpDr, c + perpDc));
          if (adjOccupied) {
            // Check next cell in our direction to see if adjacency is from a parallel word
            const nextInDir = occupied.get(key(r + perpDr + dr, c + perpDc + dc));
            const prevInDir = occupied.get(
              key(r + perpDr - dr, c + perpDc - dc)
            );
            if (nextInDir || prevInDir) return false;
          }
        }
        if (adj2 && !occupied.get(k)) {
          const adjOccupied = occupied.get(key(r - perpDr, c - perpDc));
          if (adjOccupied) {
            const nextInDir = occupied.get(key(r - perpDr + dr, c - perpDc + dc));
            const prevInDir = occupied.get(
              key(r - perpDr - dr, c - perpDc - dc)
            );
            if (nextInDir || prevInDir) return false;
          }
        }
      }
    }

    // Check cell before and after the word for adjacency
    const beforeR = startRow - dr;
    const beforeC = startCol - dc;
    if (occupied.has(key(beforeR, beforeC))) return false;

    const afterR = startRow + dr * word.length;
    const afterC = startCol + dc * word.length;
    if (occupied.has(key(afterR, afterC))) return false;

    return true;
  }

  /** Place a word on the grid */
  function placeWord(
    word: string,
    wordIndex: number,
    startRow: number,
    startCol: number,
    dir: "across" | "down"
  ) {
    const dr = dir === "down" ? 1 : 0;
    const dc = dir === "across" ? 1 : 0;

    for (let i = 0; i < word.length; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      const k = key(r, c);
      const existing = occupied.get(k);
      if (existing) {
        existing.wordIndices.push(wordIndex);
      } else {
        occupied.set(k, { letter: word[i], wordIndices: [wordIndex] });
      }
    }

    placements.push({ wordIndex, startRow, startCol, direction: dir, word });
  }

  // Place first word horizontally centered
  if (sorted.length > 0) {
    const first = sorted[0];
    const startRow = Math.floor(GRID_SIZE / 2);
    const startCol = Math.floor((GRID_SIZE - first.word.length) / 2);
    placeWord(first.word, first.index, startRow, startCol, "across");
  }

  // Place remaining words
  for (let si = 1; si < sorted.length; si++) {
    const { word, index } = sorted[si];
    let placed = false;

    // Try to intersect with already-placed words
    for (let li = 0; li < word.length && !placed; li++) {
      const letter = word[li];

      for (const p of placements) {
        if (placed) break;
        for (let pi = 0; pi < p.word.length; pi++) {
          if (p.word[pi] !== letter) continue;

          // Compute intersection — new word direction is opposite of placed word
          const newDir: "across" | "down" =
            p.direction === "across" ? "down" : "across";

          let startRow: number;
          let startCol: number;

          if (newDir === "down") {
            // New word goes down, placed word goes across
            // Intersection cell is at (p.startRow, p.startCol + pi)
            startRow = p.startRow - li;
            startCol = p.startCol + pi;
          } else {
            // New word goes across, placed word goes down
            // Intersection cell is at (p.startRow + pi, p.startCol)
            startRow = p.startRow + pi;
            startCol = p.startCol - li;
          }

          if (canPlace(word, startRow, startCol, newDir)) {
            placeWord(word, index, startRow, startCol, newDir);
            placed = true;
          }
        }
      }
    }

    // If couldn't intersect, place standalone
    if (!placed) {
      // Find a free area — try below existing content
      let minRow = GRID_SIZE;
      let maxRow = 0;
      for (const [k] of occupied) {
        const [rStr] = k.split(",");
        const r = parseInt(rStr, 10);
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
      }

      const startRow = maxRow + 2;
      const startCol = Math.floor((GRID_SIZE - word.length) / 2);
      const dir: "across" | "down" = si % 2 === 0 ? "across" : "down";

      placeWord(word, index, startRow, startCol, dir);
    }
  }

  // Compute bounding box
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (const [k] of occupied) {
    const parts = k.split(",");
    const r = parseInt(parts[0], 10);
    const c = parseInt(parts[1], 10);
    if (r < minRow) minRow = r;
    if (r > maxRow) maxRow = r;
    if (c < minCol) minCol = c;
    if (c > maxCol) maxCol = c;
  }

  // Add 1-cell padding
  minRow -= 1;
  minCol -= 1;
  maxRow += 1;
  maxCol += 1;

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  // Build trimmed grid
  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) {
      const k = key(r + minRow, c + minCol);
      const cell = occupied.get(k);
      if (cell) {
        row.push({ letter: cell.letter, wordIndices: [...cell.wordIndices] });
      } else {
        row.push({ letter: null, wordIndices: [] });
      }
    }
    grid.push(row);
  }

  // Adjust placements to trimmed coordinates
  const trimmedPlacements: Placement[] = placements.map((p) => ({
    ...p,
    startRow: p.startRow - minRow,
    startCol: p.startCol - minCol,
  }));

  return { grid, placements: trimmedPlacements, rows, cols };
}

/* ------------------------------------------------------------------ */
/*  Clue numbering                                                     */
/* ------------------------------------------------------------------ */

function assignClueNumbers(placements: Placement[]): Map<number, number> {
  // Assign clue numbers: sort placements by position (top-to-bottom, left-to-right)
  // Each unique start cell gets one number
  const cellToNumber = new Map<string, number>();
  const wordToClue = new Map<number, number>();

  const sorted = [...placements].sort((a, b) => {
    if (a.startRow !== b.startRow) return a.startRow - b.startRow;
    return a.startCol - b.startCol;
  });

  let num = 1;
  for (const p of sorted) {
    const k = `${p.startRow},${p.startCol}`;
    if (!cellToNumber.has(k)) {
      cellToNumber.set(k, num);
      num++;
    }
    wordToClue.set(p.wordIndex, cellToNumber.get(k)!);
  }

  return wordToClue;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CrosswordEngine({
  config,
  elapsed,
  onComplete,
}: GameEngineProps) {
  const words: WordDef[] = config.words || [];

  /* ---- Generate grid once ---- */
  const { grid, placements, rows, cols } = useMemo(
    () => generateGrid(words),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(words)]
  );

  const clueNumbers = useMemo(() => assignClueNumbers(placements), [placements]);

  /* ---- Cell numbering map: "row,col" → number ---- */
  const cellNumbers = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of placements) {
      const k = `${p.startRow},${p.startCol}`;
      if (!map.has(k)) {
        map.set(k, clueNumbers.get(p.wordIndex)!);
      }
    }
    return map;
  }, [placements, clueNumbers]);

  /* ---- State ---- */
  const [userInput, setUserInput] = useState<string[][]>(() =>
    Array.from({ length: rows }, () => Array(cols).fill(""))
  );
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [activeWordIdx, setActiveWordIdx] = useState<number | null>(null);
  const [solvedWords, setSolvedWords] = useState<Set<number>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [completed, setCompleted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  /* ---- Derived: active word's cells ---- */
  const activeWordCells = useMemo(() => {
    if (activeWordIdx === null) return new Set<string>();
    const p = placements.find((pl) => pl.wordIndex === activeWordIdx);
    if (!p) return new Set<string>();
    const cells = new Set<string>();
    const dr = p.direction === "down" ? 1 : 0;
    const dc = p.direction === "across" ? 1 : 0;
    for (let i = 0; i < p.word.length; i++) {
      cells.add(`${p.startRow + dr * i},${p.startCol + dc * i}`);
    }
    return cells;
  }, [activeWordIdx, placements]);

  /* ---- Find which word a cell belongs to (for current direction) ---- */
  const getWordAtCell = useCallback(
    (row: number, col: number, preferredDir?: "across" | "down"): number | null => {
      const cell = grid[row]?.[col];
      if (!cell || cell.letter === null) return null;

      const cellPlacements = placements.filter((p) =>
        cell.wordIndices.includes(p.wordIndex)
      );
      if (cellPlacements.length === 0) return null;

      if (preferredDir) {
        const match = cellPlacements.find((p) => p.direction === preferredDir);
        if (match) return match.wordIndex;
      }

      return cellPlacements[0].wordIndex;
    },
    [grid, placements]
  );

  /* ---- Select a cell ---- */
  const selectCell = useCallback(
    (row: number, col: number) => {
      const cell = grid[row]?.[col];
      if (!cell || cell.letter === null) return;

      // If tapping the same cell, toggle direction
      if (selectedCell?.row === row && selectedCell?.col === col) {
        const currentPlacement = placements.find(
          (p) => p.wordIndex === activeWordIdx
        );
        const otherDir =
          currentPlacement?.direction === "across" ? "down" : "across";
        const otherWord = getWordAtCell(row, col, otherDir);
        if (otherWord !== null) {
          setActiveWordIdx(otherWord);
          setSelectedCell({ row, col });
          inputRef.current?.focus();
          return;
        }
      }

      setSelectedCell({ row, col });

      // Determine which word to activate
      const currentDir =
        activeWordIdx !== null
          ? placements.find((p) => p.wordIndex === activeWordIdx)?.direction
          : undefined;
      const word = getWordAtCell(row, col, currentDir) ?? getWordAtCell(row, col);
      if (word !== null) {
        setActiveWordIdx(word);
      }

      inputRef.current?.focus();
    },
    [selectedCell, activeWordIdx, grid, placements, getWordAtCell]
  );

  /* ---- Check if a word is solved ---- */
  const checkWord = useCallback(
    (wordIdx: number, currentInput: string[][]): boolean => {
      const p = placements.find((pl) => pl.wordIndex === wordIdx);
      if (!p) return false;
      const dr = p.direction === "down" ? 1 : 0;
      const dc = p.direction === "across" ? 1 : 0;
      for (let i = 0; i < p.word.length; i++) {
        const r = p.startRow + dr * i;
        const c = p.startCol + dc * i;
        if (currentInput[r]?.[c]?.toUpperCase() !== p.word[i]) return false;
      }
      return true;
    },
    [placements]
  );

  /* ---- Move to next cell in current word direction ---- */
  const moveToNext = useCallback(
    (row: number, col: number, dir: "across" | "down", forward: boolean) => {
      const dr = dir === "down" ? (forward ? 1 : -1) : 0;
      const dc = dir === "across" ? (forward ? 1 : -1) : 0;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const cell = grid[nr][nc];
        if (cell.letter !== null) {
          setSelectedCell({ row: nr, col: nc });
          return;
        }
      }
    },
    [grid, rows, cols]
  );

  /* ---- Move to next word ---- */
  const moveToNextWord = useCallback(() => {
    if (activeWordIdx === null) return;

    const currentPIdx = placements.findIndex(
      (p) => p.wordIndex === activeWordIdx
    );
    // Find next unsolved word
    for (let offset = 1; offset <= placements.length; offset++) {
      const nextP = placements[(currentPIdx + offset) % placements.length];
      if (!solvedWords.has(nextP.wordIndex)) {
        setActiveWordIdx(nextP.wordIndex);
        setSelectedCell({ row: nextP.startRow, col: nextP.startCol });
        return;
      }
    }
  }, [activeWordIdx, placements, solvedWords]);

  /* ---- Handle key input ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedCell || completed) return;

      const { row, col } = selectedCell;
      const currentPlacement = placements.find(
        (p) => p.wordIndex === activeWordIdx
      );
      const dir = currentPlacement?.direction ?? "across";

      if (e.key === "Tab") {
        e.preventDefault();
        moveToNextWord();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (row > 0 && grid[row - 1][col].letter !== null) {
          selectCell(row - 1, col);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (row < rows - 1 && grid[row + 1][col].letter !== null) {
          selectCell(row + 1, col);
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (col > 0 && grid[row][col - 1].letter !== null) {
          selectCell(row, col - 1);
        }
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (col < cols - 1 && grid[row][col + 1].letter !== null) {
          selectCell(row, col + 1);
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        const newInput = userInput.map((r) => [...r]);
        if (newInput[row][col]) {
          newInput[row][col] = "";
          setUserInput(newInput);
        } else {
          moveToNext(row, col, dir, false);
        }
        return;
      }

      // Letter input
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        const letter = e.key.toUpperCase();
        const newInput = userInput.map((r) => [...r]);
        newInput[row][col] = letter;
        setUserInput(newInput);

        // Check if this letter is wrong
        const correctLetter = grid[row][col].letter;
        if (correctLetter && letter !== correctLetter) {
          setMistakes((prev) => prev + 1);
        }

        // Check all words this cell belongs to
        const cell = grid[row][col];
        const newSolved = new Set(solvedWords);
        for (const wIdx of cell.wordIndices) {
          if (checkWord(wIdx, newInput)) {
            newSolved.add(wIdx);
          }
        }
        setSolvedWords(newSolved);

        // Advance cursor
        moveToNext(row, col, dir, true);
      }
    },
    [
      selectedCell,
      completed,
      activeWordIdx,
      placements,
      userInput,
      grid,
      rows,
      cols,
      solvedWords,
      checkWord,
      moveToNext,
      moveToNextWord,
      selectCell,
    ]
  );

  /* ---- Handle mobile input ---- */
  const handleMobileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedCell || completed) return;
      const value = e.target.value;
      if (!value) return;

      const letter = value.slice(-1).toUpperCase();
      if (!/^[A-Z]$/.test(letter)) {
        e.target.value = "";
        return;
      }

      const { row, col } = selectedCell;
      const currentPlacement = placements.find(
        (p) => p.wordIndex === activeWordIdx
      );
      const dir = currentPlacement?.direction ?? "across";

      const newInput = userInput.map((r) => [...r]);
      newInput[row][col] = letter;
      setUserInput(newInput);

      // Check if this letter is wrong
      const correctLetter = grid[row][col].letter;
      if (correctLetter && letter !== correctLetter) {
        setMistakes((prev) => prev + 1);
      }

      // Check all words this cell belongs to
      const cell = grid[row][col];
      const newSolved = new Set(solvedWords);
      for (const wIdx of cell.wordIndices) {
        if (checkWord(wIdx, newInput)) {
          newSolved.add(wIdx);
        }
      }
      setSolvedWords(newSolved);

      // Advance cursor
      moveToNext(row, col, dir, true);

      // Reset the input value
      e.target.value = "";
    },
    [
      selectedCell,
      completed,
      activeWordIdx,
      placements,
      userInput,
      grid,
      solvedWords,
      checkWord,
      moveToNext,
    ]
  );

  /* ---- Completion check ---- */
  useEffect(() => {
    if (completedRef.current) return;
    if (solvedWords.size === words.length && words.length > 0) {
      completedRef.current = true;
      setCompleted(true);

      const totalPoints = words.length;
      const score = words.length;
      const stars = mistakes === 0 ? 3 : mistakes <= 5 ? 2 : 1;

      // Small delay for the celebration effect
      setTimeout(() => {
        onComplete({
          score,
          total_points: totalPoints,
          time_seconds: elapsed,
          stars,
          attempt_data: {
            mistakes,
            words_solved: words.length,
          },
        });
      }, 800);
    }
  }, [solvedWords, words.length, mistakes, elapsed, onComplete]);

  /* ---- Click on clue to jump to word ---- */
  const selectClue = useCallback(
    (wordIdx: number) => {
      const p = placements.find((pl) => pl.wordIndex === wordIdx);
      if (!p) return;
      setActiveWordIdx(wordIdx);
      setSelectedCell({ row: p.startRow, col: p.startCol });
      inputRef.current?.focus();
    },
    [placements]
  );

  /* ---- Split placements into across/down ---- */
  const acrossClues = useMemo(
    () =>
      placements
        .filter((p) => p.direction === "across")
        .sort(
          (a, b) =>
            (clueNumbers.get(a.wordIndex) ?? 0) -
            (clueNumbers.get(b.wordIndex) ?? 0)
        ),
    [placements, clueNumbers]
  );

  const downClues = useMemo(
    () =>
      placements
        .filter((p) => p.direction === "down")
        .sort(
          (a, b) =>
            (clueNumbers.get(a.wordIndex) ?? 0) -
            (clueNumbers.get(b.wordIndex) ?? 0)
        ),
    [placements, clueNumbers]
  );

  /* ---- Render ---- */
  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full max-w-5xl mx-auto">
      {/* Hidden input for mobile keyboard */}
      <input
        ref={inputRef}
        className="opacity-0 absolute w-0 h-0"
        type="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        inputMode="text"
        onChange={handleMobileInput}
        aria-label="Crossword input"
      />

      {/* Grid */}
      <div className="flex-shrink-0">
        <div
          ref={gridRef}
          className="inline-grid gap-[2px] outline-none"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          role="grid"
          aria-label="Crossword puzzle grid"
        >
          {grid.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              const k = `${rIdx},${cIdx}`;
              const isBlack = cell.letter === null;
              const isSelected =
                selectedCell?.row === rIdx && selectedCell?.col === cIdx;
              const isInActiveWord = activeWordCells.has(k);
              const userLetter = userInput[rIdx]?.[cIdx] ?? "";

              // Check if cell belongs to any solved word
              const isSolved = cell.wordIndices.some((wi) =>
                solvedWords.has(wi)
              );

              const clueNum = cellNumbers.get(k);

              if (isBlack) {
                return (
                  <div
                    key={k}
                    className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-800 rounded-sm"
                    role="gridcell"
                    aria-hidden="true"
                  />
                );
              }

              return (
                <motion.div
                  key={k}
                  className={`
                    relative w-9 h-9 sm:w-10 sm:h-10 rounded-sm cursor-pointer
                    flex items-center justify-center
                    font-bold font-mono text-lg uppercase select-none
                    transition-colors duration-150
                    ${
                      isSelected
                        ? "border-2 border-[#5341CD] bg-[#5341CD]/10 z-10"
                        : isSolved
                        ? "border border-green-400 bg-green-100 text-green-700"
                        : isInActiveWord
                        ? "border border-[#5341CD]/40 bg-blue-50"
                        : "border border-gray-300 bg-white"
                    }
                  `}
                  onClick={() => selectCell(rIdx, cIdx)}
                  animate={
                    isSolved
                      ? {
                          scale: [1, 1.08, 1],
                          transition: { duration: 0.3 },
                        }
                      : undefined
                  }
                  role="gridcell"
                  aria-label={`Row ${rIdx + 1}, Column ${cIdx + 1}${
                    clueNum ? `, Clue ${clueNum}` : ""
                  }${userLetter ? `, Letter ${userLetter}` : ", Empty"}`}
                >
                  {/* Clue number */}
                  {clueNum && (
                    <span className="absolute top-[1px] left-[2px] text-[8px] sm:text-[9px] font-semibold text-gray-500 leading-none">
                      {clueNum}
                    </span>
                  )}
                  {/* User letter */}
                  <span
                    className={`${
                      isSolved ? "text-green-700" : "text-gray-900"
                    }`}
                  >
                    {userLetter}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Clues Panel */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Across */}
        <div>
          <h3 className="font-bold text-sm sm:text-base text-gray-700 mb-2 flex items-center gap-1">
            Across <span aria-hidden="true">&#10145;</span>
          </h3>
          <div className="space-y-1">
            {acrossClues.map((p) => {
              const num = clueNumbers.get(p.wordIndex) ?? 0;
              const w = words[p.wordIndex];
              const isSolved = solvedWords.has(p.wordIndex);
              const isActive = activeWordIdx === p.wordIndex;

              return (
                <button
                  key={`across-${p.wordIndex}`}
                  onClick={() => selectClue(p.wordIndex)}
                  className={`
                    w-full text-left px-2 py-1.5 rounded text-sm sm:text-base
                    transition-colors duration-150
                    ${
                      isActive
                        ? "bg-[#5341CD]/10 border-l-2 border-[#5341CD]"
                        : "hover:bg-gray-50"
                    }
                    ${isSolved ? "line-through text-green-600" : "text-gray-700"}
                  `}
                >
                  <span className="font-bold mr-1.5">{num}.</span>
                  {w?.clue_bn ? (
                    <span>
                      {w.clue_bn}{" "}
                      <span className="text-gray-400 text-xs">({w.clue})</span>
                    </span>
                  ) : (
                    w?.clue
                  )}
                  {isSolved && (
                    <span className="ml-1.5 text-green-500" aria-label="Solved">
                      &#10003;
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Down */}
        <div>
          <h3 className="font-bold text-sm sm:text-base text-gray-700 mb-2 flex items-center gap-1">
            Down <span aria-hidden="true">&#11015;</span>
          </h3>
          <div className="space-y-1">
            {downClues.map((p) => {
              const num = clueNumbers.get(p.wordIndex) ?? 0;
              const w = words[p.wordIndex];
              const isSolved = solvedWords.has(p.wordIndex);
              const isActive = activeWordIdx === p.wordIndex;

              return (
                <button
                  key={`down-${p.wordIndex}`}
                  onClick={() => selectClue(p.wordIndex)}
                  className={`
                    w-full text-left px-2 py-1.5 rounded text-sm sm:text-base
                    transition-colors duration-150
                    ${
                      isActive
                        ? "bg-[#5341CD]/10 border-l-2 border-[#5341CD]"
                        : "hover:bg-gray-50"
                    }
                    ${isSolved ? "line-through text-green-600" : "text-gray-700"}
                  `}
                >
                  <span className="font-bold mr-1.5">{num}.</span>
                  {w?.clue_bn ? (
                    <span>
                      {w.clue_bn}{" "}
                      <span className="text-gray-400 text-xs">({w.clue})</span>
                    </span>
                  ) : (
                    w?.clue
                  )}
                  {isSolved && (
                    <span className="ml-1.5 text-green-500" aria-label="Solved">
                      &#10003;
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Completion message */}
        {completed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-4 bg-green-50 rounded-xl border border-green-200"
          >
            <p className="text-lg font-bold text-green-700">
              {mistakes === 0
                ? "Perfect! No mistakes!"
                : `Done! ${mistakes} mistake${mistakes > 1 ? "s" : ""}`}
            </p>
            <p className="text-3xl mt-1">
              {mistakes === 0 ? "⭐⭐⭐" : mistakes <= 5 ? "⭐⭐" : "⭐"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
