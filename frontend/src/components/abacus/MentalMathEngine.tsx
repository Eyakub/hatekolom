"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
    steps?: Array<unknown>;
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
/*  Question generation                                                */
/* ------------------------------------------------------------------ */

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestions(
  operations: string[],
  range: [number, number],
  count: number,
): Question[] {
  const [lo, hi] = range;
  const questions: Question[] = [];

  for (let i = 0; i < count; i++) {
    if (operations.length === 0) {
      // Counting mode
      const n = randInt(lo, hi);
      questions.push({ display: `What is ${n}?`, answer: n });
    } else {
      const op = operations[randInt(0, operations.length - 1)];
      let a: number, b: number, answer: number, display: string;

      switch (op) {
        case "-": {
          a = randInt(lo, hi);
          b = randInt(lo, Math.min(a, hi));
          answer = a - b;
          display = `${a} - ${b} = ?`;
          break;
        }
        case "*": {
          a = randInt(lo, hi);
          b = randInt(lo, hi);
          answer = a * b;
          display = `${a} x ${b} = ?`;
          break;
        }
        case "/": {
          // Ensure clean division: pick answer and b, then a = answer * b
          const divisor = randInt(Math.max(1, lo), hi);
          const quotient = randInt(lo, hi);
          a = quotient * divisor;
          b = divisor;
          answer = quotient;
          display = `${a} / ${b} = ?`;
          break;
        }
        default: {
          // Addition ("+") or any unknown op defaults to addition
          a = randInt(lo, hi);
          b = randInt(lo, hi);
          answer = a + b;
          display = `${a} + ${b} = ?`;
          break;
        }
      }
      questions.push({ display, answer });
    }
  }

  return questions;
}

/* ------------------------------------------------------------------ */
/*  Phases                                                             */
/* ------------------------------------------------------------------ */

type Phase = "flash" | "answer" | "feedback";

/* ------------------------------------------------------------------ */
/*  Circular countdown SVG                                             */
/* ------------------------------------------------------------------ */

function CountdownCircle({
  durationMs,
  running,
}: {
  durationMs: number;
  running: boolean;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      className="absolute top-4 right-4"
    >
      {/* Background circle */}
      <circle
        cx="48"
        cy="48"
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="6"
      />
      {/* Animated countdown circle */}
      <circle
        cx="48"
        cy="48"
        r={radius}
        fill="none"
        stroke="#6366f1"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={running ? circumference : 0}
        style={{
          transition: running
            ? `stroke-dashoffset ${durationMs}ms linear`
            : "none",
          transform: "rotate(-90deg)",
          transformOrigin: "center",
        }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MentalMathEngine({
  config,
  elapsed,
  onComplete,
}: AbacusEngineProps) {
  const questions = useMemo(
    () =>
      generateQuestions(
        config.operations,
        config.number_range,
        config.question_count,
      ),
    // Generate once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("flash");
  const [score, setScore] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [done, setDone] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = questions[index] as Question | undefined;

  /* ---- Flash phase: show question then hide after flash_duration_ms ---- */
  useEffect(() => {
    if (phase !== "flash" || !question) return;

    // Trigger the CSS transition on the next frame
    const raf = requestAnimationFrame(() => setCountdownRunning(true));

    flashTimerRef.current = setTimeout(() => {
      setPhase("answer");
      setCountdownRunning(false);
    }, config.flash_duration_ms);

    return () => {
      cancelAnimationFrame(raf);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [phase, question, config.flash_duration_ms]);

  /* ---- Auto-focus input on answer phase ---- */
  useEffect(() => {
    if (phase === "answer") {
      // Small delay so DOM is ready
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [phase]);

  /* ---- Complete handler ---- */
  const finish = useCallback(
    (finalScore: number) => {
      const total = questions.length;
      const pct = total > 0 ? (finalScore / total) * 100 : 0;
      const passed = pct >= config.pass_percentage;
      const stars = pct >= 95 ? 3 : pct >= config.pass_percentage ? 2 : 1;

      setDone(true);
      onComplete({
        score: finalScore,
        total_points: total,
        time_seconds: elapsed,
        passed,
        stars,
        attempt_data: {
          answers: questions.map((q, i) => ({
            question: q.display,
            correct_answer: q.answer,
          })),
        },
      });
    },
    [questions, config.pass_percentage, elapsed, onComplete],
  );

  /* ---- Submit answer ---- */
  const handleSubmit = useCallback(() => {
    if (phase !== "answer" || !question) return;

    const parsed = parseInt(userAnswer, 10);
    const correct = parsed === question.answer;

    setIsCorrect(correct);
    setPhase("feedback");

    const newScore = correct ? score + 1 : score;
    if (correct) setScore(newScore);

    setTimeout(() => {
      const nextIndex = index + 1;
      if (nextIndex >= questions.length) {
        finish(newScore);
      } else {
        setIndex(nextIndex);
        setPhase("flash");
        setUserAnswer("");
        setIsCorrect(null);
        setCountdownRunning(false);
      }
    }, 800);
  }, [phase, question, userAnswer, score, index, questions.length, finish]);

  /* ---- Key handler ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  /* ---- Guards ---- */
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-gray-500">No questions generated.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-5xl text-green-500 animate-bounce">&#10003;</div>
        <p className="text-lg font-semibold text-green-700">
          Mental Math Complete!
        </p>
        <p className="text-sm text-gray-500">
          Score: {score}/{questions.length}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {/* Progress */}
      <p className="text-sm font-medium text-gray-500">
        Question {index + 1}/{questions.length} &middot; Score: {score}
      </p>

      {/* Flash phase: show question */}
      {phase === "flash" && question && (
        <div className="relative flex flex-col items-center justify-center w-full min-h-[200px] bg-indigo-50 border border-indigo-200 rounded-2xl p-8">
          <p className="text-4xl font-bold text-indigo-900 text-center">
            {question.display}
          </p>
          <CountdownCircle
            durationMs={config.flash_duration_ms}
            running={countdownRunning}
          />
        </div>
      )}

      {/* Answer phase: input */}
      {phase === "answer" && (
        <div className="flex flex-col items-center gap-4 w-full min-h-[200px] justify-center">
          <p className="text-lg font-medium text-gray-700">
            Type your answer:
          </p>
          <input
            ref={inputRef}
            type="number"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-32 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl p-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
          >
            Submit
          </button>
        </div>
      )}

      {/* Feedback phase */}
      {phase === "feedback" && question && (
        <div className="flex flex-col items-center gap-3 w-full min-h-[200px] justify-center">
          {isCorrect ? (
            <div className="text-5xl text-green-500 animate-bounce">
              &#10003;
            </div>
          ) : (
            <>
              <div className="text-5xl text-red-400">&#10007;</div>
              <p className="text-base text-gray-600">
                Correct answer:{" "}
                <span className="font-bold text-gray-900">
                  {question.answer}
                </span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
