"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
          const divisor = randInt(Math.max(1, lo), hi);
          const quotient = randInt(lo, hi);
          a = quotient * divisor;
          b = divisor;
          answer = quotient;
          display = `${a} / ${b} = ?`;
          break;
        }
        default: {
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
/*  Mental-math sub-phases                                             */
/* ------------------------------------------------------------------ */

type MentalPhase = "flash" | "answer" | "feedback";

/* ------------------------------------------------------------------ */
/*  Countdown circle                                                   */
/* ------------------------------------------------------------------ */

function CountdownCircle({
  durationMs,
  running,
}: {
  durationMs: number;
  running: boolean;
}) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      className="absolute top-3 right-3"
    >
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="5"
      />
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke="#6366f1"
        strokeWidth="5"
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

export default function MixedTestEngine({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [abacusSize, setAbacusSize] = useState<"sm" | "md" | "lg">("lg");
  useEffect(() => {
    const update = () => setAbacusSize(window.innerWidth < 640 ? "sm" : "lg");
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  // Bead-slide state
  const [abacusValue, setAbacusValue] = useState(0);
  const [beadFeedback, setBeadFeedback] = useState<boolean | null>(null);

  // Mental-math state
  const [mentalPhase, setMentalPhase] = useState<MentalPhase>("flash");
  const [userAnswer, setUserAnswer] = useState("");
  const [mentalCorrect, setMentalCorrect] = useState<boolean | null>(null);
  const [countdownRunning, setCountdownRunning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = questions[index] as Question | undefined;
  const isBeadSlide = index % 2 === 0; // Even = bead_slide, Odd = mental_math

  /* ---- Completion ---- */
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
          answers: questions.map((q) => ({
            question: q.display,
            correct_answer: q.answer,
          })),
        },
      });
    },
    [questions, config.pass_percentage, elapsed, onComplete],
  );

  /* ---- Advance to next question ---- */
  const advance = useCallback(
    (newScore: number) => {
      const nextIndex = index + 1;
      if (nextIndex >= questions.length) {
        finish(newScore);
      } else {
        setIndex(nextIndex);
        // Reset bead-slide state
        setAbacusValue(0);
        setBeadFeedback(null);
        // Reset mental-math state
        setMentalPhase("flash");
        setUserAnswer("");
        setMentalCorrect(null);
        setCountdownRunning(false);
      }
    },
    [index, questions.length, finish],
  );

  /* ---- Mental-math flash timer ---- */
  useEffect(() => {
    if (isBeadSlide || mentalPhase !== "flash" || !question) return;

    const raf = requestAnimationFrame(() => setCountdownRunning(true));

    flashTimerRef.current = setTimeout(() => {
      setMentalPhase("answer");
      setCountdownRunning(false);
    }, config.flash_duration_ms);

    return () => {
      cancelAnimationFrame(raf);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [isBeadSlide, mentalPhase, question, config.flash_duration_ms]);

  /* ---- Auto-focus mental math input ---- */
  useEffect(() => {
    if (!isBeadSlide && mentalPhase === "answer") {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isBeadSlide, mentalPhase]);

  /* ---- Bead-slide check ---- */
  const handleBeadCheck = useCallback(() => {
    if (!question || beadFeedback !== null) return;

    const correct = abacusValue === question.answer;
    setBeadFeedback(correct);
    const newScore = correct ? score + 1 : score;
    if (correct) setScore(newScore);

    setTimeout(() => advance(newScore), 800);
  }, [question, abacusValue, beadFeedback, score, advance]);

  /* ---- Mental-math submit ---- */
  const handleMentalSubmit = useCallback(() => {
    if (mentalPhase !== "answer" || !question) return;

    const parsed = parseInt(userAnswer, 10);
    const correct = parsed === question.answer;

    setMentalCorrect(correct);
    setMentalPhase("feedback");

    const newScore = correct ? score + 1 : score;
    if (correct) setScore(newScore);

    setTimeout(() => advance(newScore), 800);
  }, [mentalPhase, question, userAnswer, score, advance]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleMentalSubmit();
      }
    },
    [handleMentalSubmit],
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
          Mixed Test Complete!
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

      {/* Mode badge */}
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
          isBeadSlide
            ? "bg-amber-100 text-amber-800"
            : "bg-purple-100 text-purple-800"
        }`}
      >
        {isBeadSlide ? "Abacus" : "Mental Math"}
      </span>

      {/* Question display */}
      {question && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center w-full">
          <p className="text-2xl font-bold text-gray-900">{question.display}</p>
        </div>
      )}

      {/* ---- Bead-slide mode ---- */}
      {isBeadSlide && question && (
        <>
          <Abacus
            rods={config.num_rods}
            value={abacusValue}
            onChange={setAbacusValue}
            size={abacusSize}
          />

          {beadFeedback !== null && (
            <div
              className={`text-4xl ${beadFeedback ? "text-green-500 animate-bounce" : "text-red-400"}`}
            >
              {beadFeedback ? "\u2713" : "\u2717"}
            </div>
          )}

          {beadFeedback === null && (
            <button
              type="button"
              onClick={handleBeadCheck}
              className="px-6 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 active:scale-95 transition-all"
            >
              Check
            </button>
          )}
        </>
      )}

      {/* ---- Mental-math mode ---- */}
      {!isBeadSlide && question && (
        <>
          {mentalPhase === "flash" && (
            <div className="relative flex items-center justify-center w-full min-h-[160px] bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <p className="text-3xl font-bold text-indigo-900">
                {question.display}
              </p>
              <CountdownCircle
                durationMs={config.flash_duration_ms}
                running={countdownRunning}
              />
            </div>
          )}

          {mentalPhase === "answer" && (
            <div className="flex flex-col items-center gap-4 w-full min-h-[160px] justify-center">
              <p className="text-base font-medium text-gray-700">
                Type your answer:
              </p>
              <input
                ref={inputRef}
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-28 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl p-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={handleMentalSubmit}
                className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
              >
                Submit
              </button>
            </div>
          )}

          {mentalPhase === "feedback" && (
            <div className="flex flex-col items-center gap-3 w-full min-h-[160px] justify-center">
              {mentalCorrect ? (
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
        </>
      )}
    </div>
  );
}
