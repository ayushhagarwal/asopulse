import { motion } from "motion/react";
import { useEffect, useState } from "react";

const chart = { width: 760, height: 255, top: 18, bottom: 34, left: 34, right: 18 };

function point(index: number, rank: number, steps: number) {
  const usableWidth = chart.width - chart.left - chart.right;
  const usableHeight = chart.height - chart.top - chart.bottom;
  return {
    x: chart.left + (index * usableWidth) / Math.max(1, steps - 1),
    y: chart.top + ((rank - 1) / 49) * usableHeight,
  };
}

function pathFor(values: Array<number | null>) {
  const points = values.flatMap((value, index) =>
    typeof value === "number" ? [{ value, index }] : [],
  );
  return points
    .map((value, index) => {
      const p = point(value.index, value.value, values.length);
      return `${index === 0 ? "M" : "L"}${p.x},${p.y}`;
    })
    .join(" ");
}

export function RankChart({
  series,
  timeline,
}: {
  series: Array<{ keyword: string; color: string; values: Array<number | null> }>;
  timeline: Array<{ label: string; observedAt: string }>;
}) {
  const [activeIndex, setActiveIndex] = useState(Math.max(0, timeline.length - 1));

  useEffect(() => {
    setActiveIndex(Math.max(0, timeline.length - 1));
  }, [timeline.length]);

  if (timeline.length === 0 || series.length === 0) {
    return (
      <section className="rank-chart" aria-labelledby="momentum-heading">
        <div className="section-heading-row">
          <div>
            <h2 id="momentum-heading">Keyword momentum</h2>
            <p>Observed positions · lower is better</p>
          </div>
        </div>
        <div className="empty-chart">Momentum will appear after repeated daily observations.</div>
      </section>
    );
  }

  const leadSeries = series[0];
  const activeValue = leadSeries?.values[activeIndex] ?? 12;
  const active = point(activeIndex, activeValue ?? 12, timeline.length);

  return (
    <section className="rank-chart" aria-labelledby="momentum-heading">
      <div className="section-heading-row">
        <div>
          <h2 id="momentum-heading">Keyword momentum</h2>
          <p>Observed positions · lower is better</p>
        </div>
        <fieldset className="range-switch">
          <legend className="visually-hidden">Time range</legend>
          <button type="button" className="is-active">
            7D
          </button>
          <button type="button">30D</button>
          <button type="button">90D</button>
        </fieldset>
      </div>
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.keyword}>
            <i style={{ backgroundColor: item.color }} />
            {item.keyword}
          </span>
        ))}
      </div>
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label="Seven day rank history for three keywords"
        >
          {[1, 10, 20, 30, 40, 50].map((rank) => {
            const y = point(0, rank, timeline.length).y;
            return (
              <g key={rank}>
                <line
                  className="grid-line"
                  x1={chart.left}
                  y1={y}
                  x2={chart.width - chart.right}
                  y2={y}
                />
                <text className="axis-label" x="0" y={y + 4}>
                  {rank}
                </text>
              </g>
            );
          })}
          {timeline.map((date, index) => {
            const x = point(index, 50, timeline.length).x;
            return (
              <text
                key={date.observedAt}
                className="axis-label date-label"
                x={x}
                y={chart.height - 5}
                textAnchor={
                  index === 0 ? "start" : index === timeline.length - 1 ? "end" : "middle"
                }
              >
                {date.label}
              </text>
            );
          })}
          {series.map((item) => (
            <motion.path
              key={item.keyword}
              d={pathFor(item.values)}
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
          <line
            className="scrubber-line"
            x1={active.x}
            y1={chart.top}
            x2={active.x}
            y2={chart.height - chart.bottom}
          />
          <motion.circle
            cx={active.x}
            cy={active.y}
            r="9"
            fill="#fff"
            stroke="#65b963"
            strokeWidth="3"
            animate={{ cx: active.x, cy: active.y }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          />
          <motion.circle
            cx={active.x}
            cy={active.y}
            r="3.5"
            fill="#0f6b35"
            animate={{ cx: active.x, cy: active.y }}
          />
          {timeline.map((date, index) => {
            const x = point(index, 50, timeline.length).x;
            return (
              <rect
                key={date.observedAt}
                x={x - 42}
                y={0}
                width="84"
                height={chart.height}
                fill="transparent"
                onPointerEnter={() => setActiveIndex(index)}
              />
            );
          })}
        </svg>
        <motion.div
          className="chart-tooltip"
          animate={{
            left: `${(active.x / chart.width) * 100}%`,
            top: `${(active.y / chart.height) * 100}%`,
          }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        >
          <span>{leadSeries?.keyword}</span>
          <strong>{activeValue ? `#${activeValue}` : ">200"}</strong>
          <em>{timeline[activeIndex]?.label}</em>
        </motion.div>
      </div>
    </section>
  );
}
