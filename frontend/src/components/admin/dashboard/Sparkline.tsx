"use client";

/**
 * Dependency-free SVG sparkline for KPI cards.
 * Renders a smoothed area + line. Handles empty/flat data gracefully.
 */
export function Sparkline({
  values,
  stroke = "#7c2df7",
  fill = "#7c2df7",
  width = 120,
  height = 36,
  strokeWidth = 1.75,
}: {
  values: number[];
  stroke?: string;
  fill?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (!values || values.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line
          x1={0}
          y1={height - 2}
          x2={width}
          y2={height - 2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeOpacity={0.25}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const padY = 2;
  const usableH = height - padY * 2;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = padY + usableH - ((v - min) / range) * usableH;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`))
    .join(" ");
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  const gradientId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.25" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2.5}
        fill={stroke}
      />
    </svg>
  );
}
