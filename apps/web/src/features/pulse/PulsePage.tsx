import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, RefreshIcon } from "../../components/icons";
import { KeywordComposerDialog } from "../../components/KeywordComposerDialog";
import { apiRequest } from "../../lib/api";
import { parseKeywordInput } from "../../lib/keywords";
import { useWorkspace } from "../../lib/workspace";
import { RankSparkline } from "../watchlist/RankSparkline";

type PulseResponse = {
  project: { id: string; name: string; storefront: string };
  keywords: Array<{
    id: string;
    keyword: string;
    rank: number | null;
    competition: number;
    opportunity: number;
    movement: number | null;
    tags: string[];
    provenance: { observedAt: string; confidence: string; methodVersion: string };
    sparkline: Array<{ date: string; rank: number | null; observed: boolean }>;
    refreshState: "pending" | "fresh";
  }>;
  signals: Array<{
    id: string;
    kind: "gain" | "loss" | "entered" | "left";
    keyword: string;
    previousRank: number | null;
    currentRank: number | null;
    movement: number;
    createdAt: string;
  }>;
  nextObservationAt: string | null;
};

function relativeTime(value?: string) {
  if (!value) return "No observations yet";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h ago`;
  return new Date(value).toLocaleDateString();
}

export function PulsePage() {
  const { selectedProject } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [composerOpen, setComposerOpen] = useState(false);
  const pulse = useQuery({
    queryKey: ["pulse", selectedProject.id],
    queryFn: () => apiRequest<PulseResponse>(`/projects/${selectedProject.id}/pulse`),
  });
  const refresh = useMutation({
    mutationFn: () =>
      apiRequest(`/projects/${selectedProject.id}/observation-runs`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["observation-run", selectedProject.id] });
    },
  });
  const addKeywords = useMutation({
    mutationFn: (input: string) => {
      const keywords = parseKeywordInput(input);
      if (keywords.length === 0) throw new Error("Add at least one keyword");
      return apiRequest(`/projects/${selectedProject.id}/watchlist/batch`, {
        method: "POST",
        body: JSON.stringify({ keywords }),
      });
    },
    onSuccess: async () => {
      setComposerOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] }),
        queryClient.invalidateQueries({ queryKey: ["watchlist", selectedProject.id] }),
      ]);
    },
  });

  const keywords = pulse.data?.keywords ?? [];
  const signals = pulse.data?.signals ?? [];
  const observed = keywords.filter((keyword) => keyword.refreshState === "fresh");
  const gains = observed.filter((keyword) => (keyword.movement ?? 0) > 0).length;
  const losses = observed.filter((keyword) => (keyword.movement ?? 0) < 0).length;
  const outside = observed.filter((keyword) => keyword.rank === null).length;
  const latestObservedAt = observed
    .map((keyword) => keyword.provenance.observedAt)
    .sort()
    .at(-1);
  const topMovers = keywords
    .toSorted((left, right) => Math.abs(right.movement ?? 0) - Math.abs(left.movement ?? 0))
    .slice(0, 6);

  return (
    <motion.div
      className="page pulse-overview"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="pulse-heading">
        <div>
          <h1>Pulse</h1>
          <p>
            {new Intl.DateTimeFormat(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(new Date())}{" "}
            · Last refreshed {relativeTime(latestObservedAt)}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button" onClick={() => setComposerOpen(true)}>
            <PlusIcon size={17} /> Add keywords
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={refresh.isPending || keywords.length === 0}
            onClick={() => refresh.mutate()}
          >
            <RefreshIcon size={17} /> {refresh.isPending ? "Queuing…" : "Refresh all"}
          </button>
        </div>
      </div>
      {pulse.isError ? (
        <div className="track-state">
          <strong>Pulse could not be loaded.</strong>
          <button type="button" className="text-link" onClick={() => pulse.refetch()}>
            Try again
          </button>
        </div>
      ) : null}
      {pulse.isLoading ? <div className="track-state">Loading today’s movement…</div> : null}
      {!pulse.isLoading && !pulse.isError ? (
        <>
          <dl className="pulse-metric-strip">
            <div>
              <dt>Tracked</dt>
              <dd>{keywords.length}</dd>
            </div>
            <div>
              <dt>Gaining</dt>
              <dd className="positive">{gains}</dd>
            </div>
            <div>
              <dt>Slipping</dt>
              <dd className="negative">{losses}</dd>
            </div>
            <div>
              <dt>Outside top 200</dt>
              <dd>{outside}</dd>
            </div>
            <div>
              <dt>Next refresh</dt>
              <dd className="metric-copy">
                {pulse.data?.nextObservationAt
                  ? new Date(pulse.data.nextObservationAt).toLocaleString()
                  : "Schedule off"}
              </dd>
            </div>
          </dl>
          <div className="pulse-overview-grid">
            <section className="top-movers" aria-labelledby="top-movers-heading">
              <div className="section-heading-row">
                <div>
                  <h2 id="top-movers-heading">Top movers</h2>
                  <p>Seven-day movement with compact, daily history.</p>
                </div>
                <Link to="/watchlist" className="text-link">
                  Open tracking →
                </Link>
              </div>
              {topMovers.length === 0 ? (
                <div className="track-state">Add keywords to begin building movement history.</div>
              ) : (
                <div className="movers-table">
                  {topMovers.map((keyword) => (
                    <button
                      type="button"
                      key={keyword.id}
                      className="mover-row"
                      onClick={() => void navigate({ to: "/watchlist" })}
                    >
                      <span>
                        <strong>{keyword.keyword}</strong>
                        <small>
                          {keyword.refreshState === "pending"
                            ? "First observation queued"
                            : `Rank ${keyword.rank ?? ">200"}`}
                        </small>
                      </span>
                      <span
                        className={
                          keyword.movement === null
                            ? ""
                            : keyword.movement > 0
                              ? "positive"
                              : keyword.movement < 0
                                ? "negative"
                                : ""
                        }
                      >
                        {keyword.movement === null
                          ? "—"
                          : `${keyword.movement > 0 ? "↑" : keyword.movement < 0 ? "↓" : "→"} ${Math.abs(keyword.movement)}`}
                      </span>
                      <RankSparkline
                        points={keyword.sparkline}
                        movement={keyword.movement}
                        label={`${keyword.keyword} seven day rank trend`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="pulse-signals" aria-labelledby="signals-heading">
              <div className="section-heading-row">
                <div>
                  <h2 id="signals-heading">Signals</h2>
                  <p>Changes worth reviewing.</p>
                </div>
              </div>
              {signals.length === 0 ? (
                <div className="track-state">No movement signals yet.</div>
              ) : (
                signals.map((signal) => (
                  <button
                    type="button"
                    className="pulse-signal-row"
                    key={signal.id}
                    onClick={() => void navigate({ to: "/watchlist" })}
                  >
                    <span className="signal-icon">
                      {signal.movement > 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                    </span>
                    <span>
                      <strong>{signal.keyword}</strong>
                      <small>
                        {signal.previousRank ?? ">200"} → {signal.currentRank ?? ">200"}
                      </small>
                    </span>
                    <em className={signal.movement > 0 ? "positive" : "negative"}>
                      {signal.movement > 0 ? "+" : ""}
                      {signal.movement}
                    </em>
                  </button>
                ))
              )}
            </section>
          </div>
        </>
      ) : null}
      <KeywordComposerDialog
        open={composerOpen}
        title="Add keywords"
        description="Paste up to 100 terms. Observations run in the background."
        submitLabel="Add to tracking"
        submitting={addKeywords.isPending}
        onClose={() => setComposerOpen(false)}
        onSubmit={(value) => addKeywords.mutateAsync(value).then(() => undefined)}
      />
    </motion.div>
  );
}
