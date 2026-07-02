import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { CheckIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { keywordRows } from "../../data/fixtures";
import { apiRequest } from "../../lib/api";

type DiscoveryResponse = {
  data: {
    keyword: string;
    rank: number | null;
    competition: number;
    opportunity: number;
    resultCount: number;
    provenance: { observedAt: string; confidence: string; methodVersion: string };
  };
};

export function DiscoverPage() {
  const [query, setQuery] = useState("journal");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [tracked, setTracked] = useState(
    () => new Set(keywordRows.filter((row) => row.tracked).map((row) => row.id)),
  );
  const results = keywordRows.filter((row) => row.keyword.includes(deferredQuery.toLowerCase()));
  const discovery = useQuery({
    queryKey: ["keyword-discovery", submittedQuery],
    queryFn: () =>
      apiRequest<DiscoveryResponse>(
        `/keywords/discover?term=${encodeURIComponent(submittedQuery)}&country=US`,
      ),
    enabled: submittedQuery.length >= 2,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  return (
    <motion.div className="page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-intro compact">
        <div>
          <h1>Find the opening.</h1>
          <p>Explore observable App Store results—without imaginary volume numbers.</p>
        </div>
      </div>
      <form
        className="hero-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedQuery(query.trim());
        }}
      >
        <SearchIcon size={22} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “daily journal”"
          autoFocus
        />
        <kbd>↵</kbd>
      </form>
      <div className="method-note">
        <span>Opportunity v1.0</span>
        <p>
          Balances metadata saturation, result concentration, and your observed position. Every
          input is inspectable.
        </p>
        <button>How it works</button>
      </div>
      {discovery.data ? (
        <motion.div
          className="live-observation"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span>Live observation</span>
          <strong>{discovery.data.data.keyword}</strong>
          <dl>
            <div>
              <dt>Rank</dt>
              <dd>{discovery.data.data.rank ?? ">200"}</dd>
            </div>
            <div>
              <dt>Competition</dt>
              <dd>{discovery.data.data.competition}</dd>
            </div>
            <div>
              <dt>Opportunity</dt>
              <dd>{discovery.data.data.opportunity}</dd>
            </div>
            <div>
              <dt>Results observed</dt>
              <dd>{discovery.data.data.resultCount}</dd>
            </div>
          </dl>
          <small>
            {discovery.data.data.provenance.confidence} confidence ·{" "}
            {discovery.data.data.provenance.methodVersion}
          </small>
        </motion.div>
      ) : null}
      {discovery.isError ? (
        <p className="inline-error">
          Live observation needs the local API. Fixture exploration remains available below.
        </p>
      ) : null}
      <section className="discover-results">
        <div className="section-heading-row">
          <div>
            <h2>Related opportunities</h2>
            <p>{results.length} observable keyword patterns</p>
          </div>
        </div>
        <div className="keyword-list">
          {results.map((row, index) => {
            const isTracked = tracked.has(row.id);
            return (
              <motion.div
                className="keyword-result"
                key={row.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div>
                  <strong>{row.keyword}</strong>
                  <span>{row.rank ? `Currently #${row.rank}` : "Outside top 200"}</span>
                </div>
                <dl>
                  <div>
                    <dt>Opportunity</dt>
                    <dd>{row.opportunity}</dd>
                  </div>
                  <div>
                    <dt>Competition</dt>
                    <dd>{row.competition}</dd>
                  </div>
                  <div>
                    <dt>Movement</dt>
                    <dd
                      className={row.movement > 0 ? "positive" : row.movement < 0 ? "negative" : ""}
                    >
                      {row.movement > 0 ? "+" : ""}
                      {row.movement}
                    </dd>
                  </div>
                </dl>
                <button
                  className={isTracked ? "tracked-button" : "secondary-button"}
                  onClick={() =>
                    setTracked((current) => {
                      const next = new Set(current);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      return next;
                    })
                  }
                >
                  {isTracked ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                  {isTracked ? "Tracking" : "Track"}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}
