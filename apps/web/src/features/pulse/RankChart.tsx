import { motion } from "motion/react";
import { useState } from "react";
import { chartSeries } from "../../data/fixtures";

const dates = ["Jun 26", "Jun 27", "Jun 28", "Jun 29", "Jun 30", "Jul 1", "Jul 2"];
const chart = { width: 760, height: 255, top: 18, bottom: 34, left: 34, right: 18 };

function point(index: number, rank: number) {
  const usableWidth = chart.width - chart.left - chart.right;
  const usableHeight = chart.height - chart.top - chart.bottom;
  return {
    x: chart.left + (index * usableWidth) / 6,
    y: chart.top + ((rank - 1) / 49) * usableHeight,
  };
}

function pathFor(values: number[]) {
  return values
    .map((value, index) => {
      const p = point(index, value);
      return `${index === 0 ? "M" : "L"}${p.x},${p.y}`;
    })
    .join(" ");
}

export function RankChart() {
  const [activeIndex, setActiveIndex] = useState(6);
  const active = point(activeIndex, chartSeries[0]?.values[activeIndex] ?? 12);

  return (
    <section className="rank-chart" aria-labelledby="momentum-heading">
      <div className="section-heading-row">
        <div>
          <h2 id="momentum-heading">Keyword momentum</h2>
          <p>Observed positions · lower is better</p>
        </div>
        <div className="range-switch" aria-label="Time range">
          <button className="is-active">7D</button>
          <button>30D</button>
          <button>90D</button>
        </div>
      </div>
      <div className="chart-legend">
        {chartSeries.map((series) => (
          <span key={series.name}>
            <i style={{ backgroundColor: series.color }} />
            {series.name}
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
            const y = point(0, rank).y;
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
          {dates.map((date, index) => {
            const x = point(index, 50).x;
            return (
              <text
                key={date}
                className="axis-label date-label"
                x={x}
                y={chart.height - 5}
                textAnchor={index === 0 ? "start" : index === 6 ? "end" : "middle"}
              >
                {date}
              </text>
            );
          })}
          {chartSeries.map((series) => (
            <motion.path
              key={series.name}
              d={pathFor(series.values)}
              fill="none"
              stroke={series.color}
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
          {dates.map((date, index) => {
            const x = point(index, 50).x;
            return (
              <rect
                key={date}
                x={x - 42}
                y={0}
                width="84"
                height={chart.height}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${date}, daily journal rank ${chartSeries[0]?.values[index]}`}
                onPointerEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
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
          <span>daily journal</span>
          <strong>#{chartSeries[0]?.values[activeIndex]}</strong>
          <em>+8</em>
        </motion.div>
      </div>
    </section>
  );
}
