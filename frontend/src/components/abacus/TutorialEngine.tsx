"use client";

import { useState, useCallback, useEffect } from "react";
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
    steps?: Array<{
      instruction: string;
      instruction_bn?: string;
      target_value: number;
      highlight_rods: number[];
    }>;
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TutorialEngine({
  config,
  content,
  elapsed,
  onComplete,
}: AbacusEngineProps) {
  const steps = content.steps ?? [];
  const totalSteps = steps.length;

  // Responsive abacus size
  const [abacusSize, setAbacusSize] = useState<"sm" | "md" | "lg">("lg");
  useEffect(() => {
    const update = () => setAbacusSize(window.innerWidth < 640 ? "sm" : "lg");
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [currentStep, setCurrentStep] = useState(0);
  const [abacusValue, setAbacusValue] = useState(0);
  const [showCheck, setShowCheck] = useState(false);
  const [completed, setCompleted] = useState(false);

  const step = steps[currentStep] as
    | (typeof steps)[number]
    | undefined;

  const handleAbacusChange = useCallback(
    (value: number) => {
      if (showCheck || completed || !step) return;

      setAbacusValue(value);

      if (value === step.target_value) {
        setShowCheck(true);
        setTimeout(() => {
          setShowCheck(false);

          const nextStep = currentStep + 1;
          if (nextStep >= totalSteps) {
            setCompleted(true);
            onComplete({
              score: totalSteps,
              total_points: totalSteps,
              time_seconds: elapsed,
              passed: true,
              stars: 3,
              attempt_data: { steps_completed: totalSteps },
            });
          } else {
            setCurrentStep(nextStep);
            setAbacusValue(0);
          }
        }, 1000);
      }
    },
    [showCheck, completed, step, currentStep, totalSteps, elapsed, onComplete],
  );

  const handleReset = useCallback(() => {
    if (showCheck || completed) return;
    setAbacusValue(0);
  }, [showCheck, completed]);

  /* ---- Empty steps guard ---- */
  if (totalSteps === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-gray-500">No tutorial steps available.</p>
      </div>
    );
  }

  /* ---- Completed state ---- */
  if (completed) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-5xl text-green-500 animate-bounce">&#10003;</div>
        <p className="text-lg font-semibold text-green-700">
          Tutorial Complete!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Progress */}
      <p className="text-sm font-medium text-gray-500">
        Step {currentStep + 1}/{totalSteps}
      </p>

      {/* Instruction card */}
      {step && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center w-full max-w-md">
          <p className="text-base font-medium text-blue-900">
            {step.instruction}
          </p>
          {step.instruction_bn && (
            <p className="text-sm text-gray-500 mt-1">
              {step.instruction_bn}
            </p>
          )}
        </div>
      )}

      {/* Checkmark overlay */}
      {showCheck && (
        <div className="text-5xl text-green-500 animate-bounce">&#10003;</div>
      )}

      {/* Abacus */}
      {step && (
        <Abacus
          rods={config.num_rods}
          value={abacusValue}
          onChange={handleAbacusChange}
          highlightRods={step.highlight_rods}
          size={abacusSize}
        />
      )}

      {/* Reset button */}
      <button
        type="button"
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        onClick={handleReset}
        disabled={showCheck}
      >
        Reset Abacus
      </button>
    </div>
  );
}
