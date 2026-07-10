import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { CheckIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { apiRequest } from "../../lib/api";
import { storefrontName } from "../../lib/storefronts";
import { useWorkspace } from "../../lib/workspace";

type StoreResult = {
  appId: string;
  name: string;
  developer: string;
  iconUrl: string;
  ratingCount: number;
  averageRating: number;
};
type DiscoveryResponse = {
  data: {
    keyword: string;
    rank: number | null;
    competition: number;
    opportunity: number;
    resultCount: number;
    provenance: { observedAt: string; confidence: string; methodVersion: string };
  };
  results: StoreResult[];
};

export function DiscoverPage() {
  const { selectedProject } = useWorkspace();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [methodOpen, setMethodOpen] = useState(false);
  const watchlist = useQuery({
    queryKey: ["watchlist", selectedProject.id, "7d"],
    queryFn: () =>
      apiRequest<{ data: Array<{ keyword: string }> }>(
        `/projects/${selectedProject.id}/watchlist?range=7d`,
      ),
  });
  const discovery = useQuery({
    queryKey: ["keyword-discovery", selectedProject.id, submittedQuery],
    queryFn: () =>
      apiRequest<DiscoveryResponse>(
        `/keywords/discover?term=${encodeURIComponent(submittedQuery)}&country=${selectedProject.storefront}&appId=${selectedProject.appId}`,
      ),
    enabled: submittedQuery.length >= 2,
    staleTime: 15 * 60 * 1000,
  });
  const trackKeyword = useMutation({
    mutationFn: (keyword: string) =>
      apiRequest(`/projects/${selectedProject.id}/watchlist`, {
        method: "POST",
        body: JSON.stringify({ keyword }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["watchlist", selectedProject.id] }),
        queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] }),
      ]);
    },
  });
  const tracked = useMemo(
    () => new Set((watchlist.data?.data ?? []).map((row) => row.keyword)),
    [watchlist.data?.data],
  );
  const isTracked = discovery.data ? tracked.has(discovery.data.data.keyword) : false;

  return (
    <motion.div
      className="page discover-page"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="discover-heading">
        <h1>Discover</h1>
        <p>
          Check one keyword against live {storefrontName(selectedProject.storefront)} App Store
          results before tracking it.
        </p>
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
          placeholder="Search a keyword, such as daily journal"
        />
        <button className="primary-button" type="submit" disabled={query.trim().length < 2}>
          Observe
        </button>
      </form>
      <div className="method-note">
        <span>Opportunity v1.0</span>
        <p>
          Uses observable result saturation, authority, and the app’s current position. It does not
          claim search volume.
        </p>
        <button
          type="button"
          onClick={() => setMethodOpen((value) => !value)}
          aria-expanded={methodOpen}
        >
          {methodOpen ? "Hide method" : "How it works"}
        </button>
        {methodOpen ? (
          <div className="method-details">
            <strong>Transparent inputs</strong>
            <p>
              Competition increases when titles closely match the term and highly rated apps
              dominate the results. Opportunity combines that competition score with the app’s
              observed position. Every score retains its observation time, confidence, and method
              version.
            </p>
          </div>
        ) : null}
      </div>
      {discovery.isLoading ? (
        <div className="track-state">Observing live App Store results…</div>
      ) : null}
      {discovery.isError ? (
        <div className="track-state">
          <strong>Live observation failed.</strong>
          <button type="button" className="text-link" onClick={() => discovery.refetch()}>
            Try again
          </button>
        </div>
      ) : null}
      {discovery.data ? (
        <>
          <section className="discovery-observation" aria-labelledby="observation-title">
            <div>
              <span>Live observation</span>
              <h2 id="observation-title">{discovery.data.data.keyword}</h2>
              <small>
                {discovery.data.data.provenance.confidence} confidence ·{" "}
                {new Date(discovery.data.data.provenance.observedAt).toLocaleString()}
              </small>
            </div>
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
            <button
              type="button"
              className={isTracked ? "tracked-button" : "primary-button"}
              disabled={isTracked || trackKeyword.isPending}
              onClick={() => trackKeyword.mutate(discovery.data.data.keyword)}
            >
              {isTracked ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
              {isTracked ? "Tracking" : trackKeyword.isPending ? "Queuing…" : "Track keyword"}
            </button>
          </section>
          <section className="evidence-results">
            <div className="section-heading-row">
              <div>
                <h2>Result evidence</h2>
                <p>The first {discovery.data.results.length} apps returned for this term.</p>
              </div>
            </div>
            <div className="evidence-list">
              {discovery.data.results.map((app, index) => (
                <a
                  key={app.appId}
                  className={
                    app.appId === selectedProject.appId ? "evidence-row is-target" : "evidence-row"
                  }
                  href={`https://apps.apple.com/app/id${app.appId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{index + 1}</span>
                  <span className="result-icon">
                    {app.iconUrl ? <img src={app.iconUrl} alt="" /> : app.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{app.name}</strong>
                    <small>{app.developer}</small>
                  </span>
                  <span>
                    <strong>{app.averageRating.toFixed(1)}</strong>
                    <small>{app.ratingCount.toLocaleString()} ratings</small>
                  </span>
                </a>
              ))}
            </div>
          </section>
        </>
      ) : submittedQuery.length === 0 ? (
        <div className="discover-empty">
          <strong>Research a term before adding it.</strong>
          <p>
            ASOpulse will show the exact store result evidence behind its rank and opportunity
            score.
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}
