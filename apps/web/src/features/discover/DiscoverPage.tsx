import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useDeferredValue, useMemo, useState } from "react";
import { CheckIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { keywordRows } from "../../data/fixtures";
import { apiRequest } from "../../lib/api";
import { useWorkspace } from "../../lib/workspace";

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
  const { selectedProject } = useWorkspace();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("journal");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const results = keywordRows.filter((row) => row.keyword.includes(deferredQuery.toLowerCase()));
  const watchlist = useQuery({
    queryKey: ["watchlist", selectedProject.id],
    queryFn: () =>
      apiRequest<{ data: Array<{ id: string; keyword: string }> }>(
        `/projects/${selectedProject.id}/watchlist`,
      ),
    staleTime: 60_000,
  });
  const discovery = useQuery({
    queryKey: ["keyword-discovery", selectedProject.id, submittedQuery],
    queryFn: () =>
      apiRequest<DiscoveryResponse>(
        `/keywords/discover?term=${encodeURIComponent(submittedQuery)}&country=${selectedProject.storefront}&appId=${selectedProject.appId}`,
      ),
    enabled: submittedQuery.length >= 2,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });
  const trackKeyword = useMutation({
    mutationFn: (keyword: string) =>
      apiRequest(`/projects/${selectedProject.id}/watchlist`, {
        method: "POST",
        body: JSON.stringify({ keyword }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist", selectedProject.id] });
      await queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] });
    },
  });
  const trackedKeywords = useMemo(
    () => new Set((watchlist.data?.data ?? []).map((row) => row.keyword)),
    [watchlist.data?.data],
  );

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
        />
        <kbd>↵</kbd>
      </form>
      <div className="method-note">
        <span>Opportunity v1.0</span>
        <p>
          Balances metadata saturation, result concentration, and your observed position. Every
          input is inspectable.
        </p>
        <button type="button">How it works</button>
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
            const isTracked = trackedKeywords.has(row.keyword);
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
                  type="button"
                  className={isTracked ? "tracked-button" : "secondary-button"}
                  onClick={() => trackKeyword.mutate(row.keyword)}
                  disabled={isTracked || trackKeyword.isPending}
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
