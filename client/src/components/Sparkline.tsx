interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
}

export function Sparkline({
  data,
  width = 64,
  height = 20,
  strokeColor = "currentColor",
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <span className="font-mono text-[10px] text-[var(--text-muted)]">—</span>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1 || 1)) * (width - 4) + 2;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="inline-block shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
