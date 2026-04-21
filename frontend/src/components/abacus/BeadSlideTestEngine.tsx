"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Abacus from "./Abacus";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
    steps?: Array<any>;
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

interface Question {
  display: string;
  answer: number;
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

/** Map operation to display symbol */
function opSymbol(op: string): string {
  switch (op) {
    case "+":
      return "+";
    case "-":
      return "\u2212";
    case "*":
      return "\u00D7";
    case "/":
      return "\u00F7";
    default:
      return op;
  }
}

/** Generate questions based on mode */
function generateQuestions(
  operations: string[],
  [min, max]: [number, number],
  count: number,
): Question[] {
  const questions: Question[] = [];

  for (let i = 0; i < count; i++) {
    if (operations.length === 0) {
      // Counting mode: show a number, kid represents it on abacus
      const num = randInt(min, max);
      questions.push({ display: `Show ${num}`, answer: num });
    } else {
      // Arithmetic mode
      const op = pickRandom(operations);
      let a: number;
      let b: number;
      let answer: number;

      switch (op) {
        case "-": {
          a = randInt(min, max);
          b = randInt(min, a); // ensure a >= b
          answer = a - b;
          break;
        }
        case "/": {
          // a = answer * b, both in reasonable range
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

      questions.push({
        display: `${a} ${opSymbol(op)} ${b} = ?`,
        answer,
      });
    }
  }

  return questions;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BeadSlideTestEngine({
  config,
  elapsed,
  onComplete,
}: AbacusEngineProps) {
  const {
    operations,
    number_range,
    num_rods,
    question_count,
    pass_percentage,
  } = config;

  /* ---- Generate questions once on mount ---- */
  const questions = useMemo(
    () => generateQuestions(operations, number_range, question_count),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question_count],
  );

  /* ---- State ---- */
  const [abacusSize, setAbacusSize] = useState<"sm" | "md" | "lg">("lg");
  useEffect(() => {
    const update = () => setAbacusSize(window.innerWidth < 640 ? "sm" : "lg");
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [currentValue, setCurrentValue] = useState(0);
  const [abacusKey, setAbacusKey] = useState(0);
  const [feedback, setFeedback] = useState<
    "correct" | "wrong" | null
  >(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [answersLog, setAnswersLog] = useState<
    { question: string; submitted: number; correct: number; isCorrect: boolean }[]
  >([]);

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const question = questions[currentIndex] as Question | undefined;

  /* ---- Complete the test ---- */
  const completeTest = useCallback(
    (finalScore: number, log: typeof answersLog) => {
      const total = question_count;
      const pct = (finalScore / total) * 100;
      const passed = pct >= pass_percentage;
      const stars = pct >= 95 ? 3 : pct >= pass_percentage ? 2 : 1;

      onComplete({
        score: finalScore,
        total_points: total,
        time_seconds: elapsed,
        passed,
        stars,
        attempt_data: {
          answers: log,
          operations,
          number_range,
        },
      });
    },
    [question_count, pass_percentage, elapsed, onComplete, operations, number_range],
  );

  /* ---- Handle check answer ---- */
  const handleCheck = useCallback(() => {
    if (feedback || !question) return;

    const isCorrect = currentValue === question.answer;
    const newScore = isCorrect ? score + 1 : score;
    const newMistakes = isCorrect ? mistakes : mistakes + 1;

    if (isCorrect) {
      setScore(newScore);
      setFeedback("correct");
    } else {
      setMistakes(newMistakes);
      setFeedback("wrong");
      setCorrectAnswer(question.answer);
    }

    const logEntry = {
      question: question.display,
      submitted: currentValue,
      correct: question.answer,
      isCorrect,
    };
    const newLog = [...answersLog, logEntry];
    setAnswersLog(newLog);

    const delay = isCorrect ? 800 : 1500;

    advanceTimerRef.current = setTimeout(() => {
      setFeedback(null);
      setCorrectAnswer(null);
      setCurrentValue(0);
      setAbacusKey((k) => k + 1); // force abacus reset

      const nextIndex = currentIndex + 1;
      if (nextIndex >= questions.length) {
        completeTest(newScore, newLog);
      } else {
        setCurrentIndex(nextIndex);
      }
    }, delay);
  }, [
    feedback,
    question,
    currentValue,
    score,
    mistakes,
    answersLog,
    currentIndex,
    questions.length,
    completeTest,
  ]);

  if (!question) return null;

  /* ---- Derived ---- */
  const progressPercent = (currentIndex / questions.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto select-none">
      {/* ============ Progress bar ============ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-500">
            Question {currentIndex + 1} / {questions.length}
          </span>
          <span className="text-sm font-bold text-gray-400">
            Score: {score}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ============ Question display ============ */}
      <div className="text-center mb-6">
        <p className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-gray-800">
          {question.display}
        </p>
      </div>

      {/* ============ Feedback ============ */}
      <div className="h-10 flex items-center justify-center mb-4">
        {feedback === "correct" && (
          <span className="text-xl font-bold text-emerald-500 animate-pulse">
            Correct!
          </span>
        )}
        {feedback === "wrong" && correctAnswer !== null && (
          <span className="text-xl font-bold text-red-500">
            Correct answer: {correctAnswer}
          </span>
        )}
      </div>

      {/* ============ Abacus ============ */}
      <div className="flex justify-center mb-6">
        <Abacus
          key={abacusKey}
          rods={num_rods}
          onChange={setCurrentValue}
          size={abacusSize}
        />
      </div>

      {/* ============ Check Answer button ============ */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleCheck}
          disabled={!!feedback}
          className={`
            px-8 py-3 rounded-xl text-lg font-bold transition-all
            ${
              feedback
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600 active:scale-95 text-white shadow-md hover:shadow-lg"
            }
          `}
        >
          Check Answer
        </button>
      </div>
    </div>
  );
}
