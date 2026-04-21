"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

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

interface Question {
  a: number;
  b: number;
  operation: string;
  answer: number;
  choices: number[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Random integer between min and max (inclusive) */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Shuffle an array in-place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Map operation to display symbol */
function opSymbol(op: string): string {
  switch (op) {
    case "+": return "+";
    case "-": return "\u2212";
    case "*": return "\u00D7";
    case "/": return "\u00F7";
    default: return op;
  }
}

/** Map operation to Tailwind text color */
function opColor(op: string): string {
  switch (op) {
    case "+": return "text-emerald-500";
    case "-": return "text-red-500";
    case "*": return "text-blue-500";
    case "/": return "text-orange-500";
    default: return "text-gray-800";
  }
}

/** Generate 3 unique wrong answers that are not equal to the correct answer and >= 0 */
function generateWrongAnswers(correct: number): number[] {
  const wrong = new Set<number>();
  let attempts = 0;
  while (wrong.size < 3 && attempts < 50) {
    attempts++;
    const offset = randInt(1, 5) * (Math.random() < 0.5 ? 1 : -1);
    const candidate = correct + offset;
    if (candidate >= 0 && candidate !== correct && !wrong.has(candidate)) {
      wrong.add(candidate);
    }
  }
  // Fallback: fill remaining with sequential offsets
  let fallback = 1;
  while (wrong.size < 3) {
    const candidate = correct + fallback;
    if (candidate >= 0 && !wrong.has(candidate) && candidate !== correct) {
      wrong.add(candidate);
    }
    fallback++;
  }
  return Array.from(wrong);
}

/** Generate a single question */
function generateQuestion(
  operations: string[],
  min: number,
  max: number,
): Question {
  const operation = pickRandom(operations);

  let a: number;
  let b: number;
  let answer: number;

  switch (operation) {
    case "-": {
      a = randInt(min, max);
      b = randInt(min, a); // ensure a >= b
      answer = a - b;
      break;
    }
    case "/": {
      b = randInt(1, Math.min(10, max));
      answer = randInt(min, max);
      a = answer * b;
      break;
    }
    case "*": {
      a = randInt(min, max);
      b = randInt(min, max);
      answer = a * b;
      break;
    }
    default: {
      // addition
      a = randInt(min, max);
      b = randInt(min, max);
      answer = a + b;
      break;
    }
  }

  const wrong = generateWrongAnswers(answer);
  const choices = shuffle([answer, ...wrong]);

  return { a, b, operation, answer, choices };
}

/* ------------------------------------------------------------------ */
/*  Button color schemes (orange, blue, purple, rose)                  */
/* ------------------------------------------------------------------ */

const BUTTON_STYLES = [
  {
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700",
    hover: "hover:bg-orange-100",
    ring: "focus:ring-orange-400",
  },
  {
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700",
    hover: "hover:bg-blue-100",
    ring: "focus:ring-blue-400",
  },
  {
    bg: "bg-purple-50",
    border: "border-purple-300",
    text: "text-purple-700",
    hover: "hover:bg-purple-100",
    ring: "focus:ring-purple-400",
  },
  {
    bg: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-700",
    hover: "hover:bg-rose-100",
    ring: "focus:ring-rose-400",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ArithmeticEngine({
  config,
  elapsed,
  onComplete,
}: GameEngineProps) {
  const operations: string[] = config?.operations ?? ["+"];
  const [min, max] = config?.number_range ?? [1, 20];
  const questionCount: number = config?.question_count ?? 10;

  /* ---- Generate questions once on mount ---- */
  const questions = useMemo(
    () =>
      Array.from({ length: questionCount }, () =>
        generateQuestion(operations, min, max),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questionCount],
  );

  /* ---- State ---- */
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{
    selected: number;
    correct: boolean;
  } | null>(null);
  const [showPlus, setShowPlus] = useState(false);
  const [answersLog, setAnswersLog] = useState<
    { question: string; selected: number; correct: number; isCorrect: boolean }[]
  >([]);

  const question = questions[currentIndex] as Question | undefined;

  /* ---- Handle answer ---- */
  const handleAnswer = useCallback(
    (choice: number) => {
      if (feedback || !question) return; // already answered or no question

      const isCorrect = choice === question.answer;
      const newScore = isCorrect ? score + 1 : score;

      setFeedback({ selected: choice, correct: isCorrect });
      if (isCorrect) {
        setScore(newScore);
        setShowPlus(true);
      }

      // Log this answer
      const logEntry = {
        question: `${question.a} ${opSymbol(question.operation)} ${question.b}`,
        selected: choice,
        correct: question.answer,
        isCorrect,
      };

      const newLog = [...answersLog, logEntry];
      setAnswersLog(newLog);

      // Advance after delay
      setTimeout(() => {
        setFeedback(null);
        setShowPlus(false);

        const nextIndex = currentIndex + 1;
        if (nextIndex >= questions.length) {
          // Game complete
          const totalPoints = questionCount;
          const finalScore = newScore;
          const mistakes = totalPoints - finalScore;
          const stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;

          onComplete({
            score: finalScore,
            total_points: totalPoints,
            time_seconds: elapsed,
            stars,
            attempt_data: {
              answers: newLog,
              operations,
              number_range: [min, max],
            },
          });
        } else {
          setCurrentIndex(nextIndex);
        }
      }, 800);
    },
    [
      feedback,
      question,
      score,
      currentIndex,
      questions.length,
      questionCount,
      answersLog,
      elapsed,
      onComplete,
      operations,
      min,
      max,
    ],
  );

  if (!question) return null;

  /* ---- Derived ---- */
  const progressPercent = ((currentIndex) / questions.length) * 100;

  return (
    <div className="w-full max-w-lg mx-auto select-none">
      {/* ============ Progress bar ============ */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-500 font-bn">
            Question {currentIndex + 1}/{questions.length}
          </span>
          <span className="text-sm font-bold text-gray-400">
            Score: {score}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#5341CD] to-[#3B82F6]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        </div>
      </div>

      {/* ============ Question ============ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-10 relative"
        >
          <p className="text-5xl sm:text-6xl font-black font-mono tracking-tight">
            <span className="text-gray-800">{question.a}</span>
            {" "}
            <span className={opColor(question.operation)}>
              {opSymbol(question.operation)}
            </span>
            {" "}
            <span className="text-gray-800">{question.b}</span>
            {" "}
            <span className="text-gray-400">=</span>
            {" "}
            <span className="text-gray-400">?</span>
          </p>

          {/* +1 floating animation */}
          <AnimatePresence>
            {showPlus && (
              <motion.span
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -60, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="absolute top-0 left-1/2 -translate-x-1/2 text-2xl font-black text-emerald-500 pointer-events-none"
              >
                +1
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* ============ Answer grid ============ */}
      <div className="grid grid-cols-2 gap-4">
        {question.choices.map((choice, idx) => {
          const style = BUTTON_STYLES[idx % BUTTON_STYLES.length];
          const isSelected = feedback?.selected === choice;
          const isCorrectAnswer = choice === question.answer;

          // Determine button appearance during feedback
          let buttonClasses = `${style.bg} ${style.border} ${style.text} ${style.hover} ${style.ring}`;
          if (feedback) {
            if (isSelected && feedback.correct) {
              // Correct selection
              buttonClasses =
                "bg-emerald-100 border-emerald-500 text-emerald-700";
            } else if (isSelected && !feedback.correct) {
              // Wrong selection
              buttonClasses = "bg-red-100 border-red-500 text-red-700";
            } else if (!feedback.correct && isCorrectAnswer) {
              // Highlight correct answer when user chose wrong
              buttonClasses =
                "bg-emerald-50 border-emerald-400 text-emerald-600";
            }
          }

          return (
            <motion.button
              key={`${currentIndex}-${idx}`}
              onClick={() => handleAnswer(choice)}
              disabled={!!feedback}
              className={`
                p-5 sm:p-6 rounded-2xl text-2xl sm:text-3xl font-black font-mono
                border-2 transition-colors outline-none focus:ring-2
                disabled:cursor-default
                ${buttonClasses}
              `}
              whileHover={!feedback ? { scale: 1.05 } : undefined}
              whileTap={!feedback ? { scale: 0.95 } : undefined}
              // Correct answer bounce
              animate={
                feedback && isSelected && feedback.correct
                  ? { scale: [1, 1.2, 1] }
                  : feedback && isSelected && !feedback.correct
                    ? { x: [0, -5, 5, -5, 0] }
                    : undefined
              }
              transition={{ duration: 0.4 }}
            >
              {choice}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
