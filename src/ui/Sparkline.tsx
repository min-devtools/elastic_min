/**
 * Dependency-free SVG sparkline. Scales to its container via viewBox; the
 * stroke stays 1.5px on screen thanks to non-scaling-stroke.
 */
export function Sparkline({
  values,
  color = "var(--blue)",
  max,
}: {
  values: number[];
  color?: string;
  /** fixed scale top (e.g. 100 for percents); defaults to the series max */
  max?: number;
}) {
  const W = 100;
  const H = 32;
  if (values.length < 2) {
    return <div className="spark-empty">collecting…</div>;
  }
  const top = Math.max(max ?? Math.max(...values), 1);
  const step = W / (values.length - 1);
  const y = (v: number) => H - 2 - (Math.min(v, top) / top) * (H - 4);
  const points = values.map((v, i) => `${(i * step).toFixed(2)},${y(v).toFixed(2)}`);
  const area = `0,${H} ${points.join(" ")} ${W},${H}`;
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
