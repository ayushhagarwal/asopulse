function segments(
  values: Array<{ rank: number | null; observed?: boolean }>,
  width: number,
  height: number,
) {
  const points = values.map((value, index) => ({
    rank: value.rank,
    x: values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width,
    y:
      value.observed === false
        ? null
        : value.rank === null
          ? height
          : ((value.rank - 1) / 199) * height,
  }));
  const paths: string[] = [];
  let current = "";
  for (const point of points) {
    if (point.y === null) {
      if (current) paths.push(current);
      current = "";
      continue;
    }
    current += `${current ? " L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }
  if (current) paths.push(current);
  return paths;
}

export function RankSparkline({
  points,
  movement,
  label,
}: {
  points: Array<{ rank: number | null; observed?: boolean }>;
  movement: number | null;
  label: string;
}) {
  const color = movement !== null && movement < 0 ? "#a24f45" : "#168640";
  return (
    <svg className="rank-sparkline" viewBox="0 0 108 32" role="img" aria-label={label}>
      {segments(points, 108, 32).map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
