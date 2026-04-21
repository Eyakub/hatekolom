"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
/*  Encouraging messages                                               */
/* ------------------------------------------------------------------ */

const CELEBRATE_MESSAGES = [
  "Great job!",
  "Awesome!",
  "Well done!",
  "You got it!",
  "Fantastic!",
  "Keep it up!",
  "Brilliant!",
  "Nice work!",
];

function randomCelebration(): string {
  return CELEBRATE_MESSAGES[randInt(0, CELEBRATE_MESSAGES.length - 1)];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PracticeEngine({
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
  const [abacusValue, setAbacusValue] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [celebration, setCelebration] = useState("");
  const [done, setDone] = useState(false);

  const question = questions[index] as Question | undefined;

  /* ---- Complete ---- */
  const finish = useCallback(() => {
    setDone(true);
    onComplete({
      score: questions.length,
      total_points: questions.length,
      time_seconds: elapsed,
      passed: true,
      stars: 3,
      attempt_data: {
        mode: "practice",
        questions_attempted: questions.length,
      },
    });
  }, [questions, elapsed, onComplete]);

  /* ---- Advance ---- */
  const advance = useCallback(() => {
    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      finish();
    } else {
      setIndex(nextIndex);
      setAbacusValue(0);
      setFeedback(null);
      setCelebration("");
    }
  }, [index, questions.length, finish]);

  /* ---- Check ---- */
  const handleCheck = useCallback(() => {
    if (!question || feedback === "correct") return;

    if (abacusValue === question.answer) {
      setFeedback("correct");
      setCelebration(randomCelebration());
      // Auto-advance after a short pause
      setTimeout(() => advance(), 1000);
    } else {
      setFeedback("wrong");
    }
  }, [question, abacusValue, feedback, advance]);

  /* ---- Skip ---- */
  const handleSkip = useCallback(() => {
    advance();
  }, [advance]);

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
          Practice Complete!
        </p>
        <p className="text-sm text-gray-500">
          Great job! You practiced all {questions.length} questions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {/* Progress */}
      <p className="text-sm font-medium text-gray-500">
        Question {index + 1}/{questions.length}
      </p>

      {/* Question card */}
      {question && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center w-full">
          <p className="text-2xl font-bold text-blue-900">{question.display}</p>
        </div>
      )}

      {/* Abacus */}
      <Abacus
        rods={config.num_rods}
        value={abacusValue}
        onChange={setAbacusValue}
        size={abacusSize}
      />

      {/* Feedback */}
      {feedback === "correct" && (
        <div className="flex flex-col items-center gap-1">
          <div className="text-4xl text-green-500 animate-bounce">&#10003;</div>
          <p className="text-base font-semibold text-green-700">
            {celebration}
          </p>
        </div>
      )}

      {feedback === "wrong" && (
        <p className="text-base font-medium text-orange-600">
          Try again! You can do it.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCheck}
          disabled={feedback === "correct"}
          className="px-6 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Check
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={feedback === "correct"}
          className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
