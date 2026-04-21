"use client";

interface ProgressBarProps {
  percentage: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  color?: string;
}

export function ProgressBar({
  percentage,
  size = "md",
  showLabel = true,
  color = "bg-primary-600",
}: ProgressBarProps) {
  const heights = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex-1 ${heights[size]} bg-gray-100 rounded-full overflow-hidden`}
      >
        <div
          className={`${heights[size]} ${color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-gray-500 tabular-nums shrink-0">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
