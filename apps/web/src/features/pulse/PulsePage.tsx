import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "../../components/icons";
import { apiRequest } from "../../lib/api";
import { useWorkspace } from "../../lib/workspace";
import { OpportunityTable } from "./OpportunityTable";
import { RankChart } from "./RankChart";

type PulseResponse = {
  project: {
    id: string;
    name: string;
    appId: string;
    appName: string;
    storefront: string;
    createdAt: string;
  };
  keywords: Array<{
    id: string;
    keyword: string;
    rank: number | null;
    competition: number;
    opportunity: number;
    resultCount: number;
    movement: number;
    tags: string[];
    tracked: true;
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
  series: Array<{ keyword: string; color: string; values: Array<number | null> }>;
  timeline: Array<{ label: string; observedAt: string }>;
  nextObservationAt: string | null;
};

export function PulsePage() {
  const { selectedProject } = useWorkspace();
  const pulse = useQuery({
    queryKey: ["pulse", selectedProject.id],
    queryFn: () => apiRequest<PulseResponse>(`/projects/${selectedProject.id}/pulse`),
  });

  const keywords = pulse.data?.keywords ?? [];
  const signals = pulse.data?.signals ?? [];

  return (
    <motion.div
      className="page pulse-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="page-intro">
        <div>
          <p className="date-mobile">Thursday, July 2</p>
          <h1>Your market, in motion.</h1>
          <p>The signals worth acting on, distilled from today’s movement.</p>
        </div>
        <time dateTime="2026-07-02">Thursday, July 2</time>
      </div>
      <div className="pulse-grid">
        <RankChart series={pulse.data?.series ?? []} timeline={pulse.data?.timeline ?? []} />
        <aside className="signals" aria-labelledby="signals-heading">
          <h2 id="signals-heading">Signals</h2>
          {signals.length === 0 ? (
            <p className="empty-copy">
              No movement signals yet. Add keywords and let observations accumulate.
            </p>
          ) : null}
          {signals.map((signal, index) => (
            <motion.button
              key={signal.id}
              className="signal-row"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.06 }}
            >
              <span className="signal-icon">
                {signal.kind === "gain" || signal.kind === "entered" ? (
                  <ArrowUpIcon />
                ) : (
                  <ArrowDownIcon />
                )}
              </span>
              <span className="signal-copy">
                <strong>
                  {signal.keyword}{" "}
                  {signal.kind === "entered"
                    ? "entered the top 200"
                    : signal.kind === "left"
                      ? "fell outside the top 200"
                      : signal.kind === "gain"
                        ? `gained ${Math.abs(signal.movement)} place${Math.abs(signal.movement) === 1 ? "" : "s"}`
                        : `slipped ${Math.abs(signal.movement)} place${Math.abs(signal.movement) === 1 ? "" : "s"}`}
                </strong>
                <small>
                  Was {signal.previousRank ?? ">200"} · now {signal.currentRank ?? ">200"}
                </small>
              </span>
              <em
                className={
                  signal.kind === "gain" || signal.kind === "entered" ? "positive" : "negative"
                }
              >
                {signal.movement > 0 ? "+" : ""}
                {signal.movement}
              </em>
            </motion.button>
          ))}
          <Link to="/watchlist" className="text-link">
            Review watchlist <span>→</span>
          </Link>
        </aside>
      </div>
      <section className="opportunity-section" aria-labelledby="opportunity-heading">
        <div className="section-heading-row">
          <div>
            <h2 id="opportunity-heading">Opportunity field</h2>
            <p>
              {pulse.isError
                ? "The API is currently unavailable."
                : keywords.length === 0
                  ? "Add tracked keywords to populate your first observation set."
                  : "Observed rankings and explainable result competition."}
            </p>
          </div>
          <Link className="primary-button" to="/discover">
            <SearchIcon size={17} /> Find keywords
          </Link>
        </div>
        <OpportunityTable rows={keywords} />
      </section>
    </motion.div>
  );
}
