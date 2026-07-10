import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "../../components/icons";
import { apiRequest } from "../../lib/api";

type Range = "7d" | "30d" | "90d";
type HistoryResponse = {
  data: {
    keywordId: string;
    keyword: string;
    range: Range;
    timeline: Array<{ date: string; label: string; rank: number | null; observed: boolean }>;
    currentRank: number | null;
    movement: number | null;
    lastObservedAt: string | null;
  };
};

function chartSegments(values: Array<{ rank: number | null; observed: boolean }>) {
  const width = 360;
  const height = 300;
  const points = values.map((value, index) => ({
    rank: value.rank,
    x: values.length <= 1 ? 0 : (index / (values.length - 1)) * width,
    y: value.observed ? (value.rank === null ? height : ((value.rank - 1) / 199) * height) : null,
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

function relativeTime(value: string | null) {
  if (!value) return "Pending first observation";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleString();
}

export function KeywordHistoryDrawer({
  projectId,
  keywordId,
  onClose,
}: {
  projectId: string;
  keywordId: string | null;
  onClose: () => void;
}) {
  const [range, setRange] = useState<Range>("30d");
  const closeRef = useRef<HTMLButtonElement>(null);
  const history = useQuery({
    queryKey: ["keyword-history", projectId, keywordId, range],
    queryFn: () =>
      apiRequest<HistoryResponse>(
        `/projects/${projectId}/watchlist/${keywordId}/history?range=${range}`,
      ),
    enabled: keywordId !== null,
  });

  useEffect(() => {
    if (!keywordId) return;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKey);
    };
  }, [keywordId, onClose]);

  const data = history.data?.data;
  const values = data?.timeline ?? [];
  return (
    <AnimatePresence>
      {keywordId ? (
        <motion.aside
          className="keyword-history-drawer"
          aria-labelledby="history-drawer-title"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
        >
          <div className="history-drawer-heading">
            <div>
              <h2 id="history-drawer-title">{data?.keyword ?? "Keyword history"}</h2>
              <p>Observed App Store position · lower is better</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close keyword history"
            >
              <CloseIcon />
            </button>
          </div>
          {history.isError ? (
            <div className="drawer-state">
              <strong>History could not be loaded.</strong>
              <button type="button" className="text-link" onClick={() => history.refetch()}>
                Try again
              </button>
            </div>
          ) : null}
          {history.isLoading ? <div className="drawer-state">Loading rank history…</div> : null}
          {data ? (
            <>
              <dl className="history-summary">
                <div>
                  <dt>Current rank</dt>
                  <dd>{data.currentRank ?? ">200"}</dd>
                </div>
                <div>
                  <dt>Movement ({range.toUpperCase()})</dt>
                  <dd className={data.movement && data.movement < 0 ? "negative" : "positive"}>
                    {data.movement === null
                      ? "—"
                      : `${data.movement > 0 ? "↑" : data.movement < 0 ? "↓" : "→"} ${Math.abs(data.movement)}`}
                  </dd>
                </div>
                <div>
                  <dt>Last checked</dt>
                  <dd>{relativeTime(data.lastObservedAt)}</dd>
                </div>
              </dl>
              <div className="history-chart-heading">
                <h3>Rank history</h3>
                <fieldset className="segmented-control">
                  <legend className="visually-hidden">History range</legend>
                  {(["7d", "30d", "90d"] as const).map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={range === item ? "is-active" : ""}
                      onClick={() => setRange(item)}
                    >
                      {item.toUpperCase()}
                    </button>
                  ))}
                </fieldset>
              </div>
              <div className="history-chart">
                <div className="history-y-axis">
                  <span>1</span>
                  <span>50</span>
                  <span>100</span>
                  <span>150</span>
                  <span>200</span>
                </div>
                <svg
                  viewBox="0 0 360 300"
                  role="img"
                  aria-label={`${data.keyword} ${range.toUpperCase()} rank history`}
                >
                  {[0, 75, 150, 225, 300].map((y) => (
                    <line key={y} x1="0" x2="360" y1={y} y2={y} className="history-grid-line" />
                  ))}
                  {chartSegments(values).map((path) => (
                    <path
                      key={path}
                      d={path}
                      fill="none"
                      stroke="#168640"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
                <div className="history-x-axis">
                  <span>{data.timeline[0]?.label}</span>
                  <span>{data.timeline.at(-1)?.label}</span>
                </div>
              </div>
              <p className="history-note">Gaps in the line indicate days without ranking data.</p>
            </>
          ) : null}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
