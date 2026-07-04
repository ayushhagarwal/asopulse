import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CloseIcon, DownloadIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { KeywordComposerDialog } from "../../components/KeywordComposerDialog";
import { apiRequest } from "../../lib/api";
import { parseKeywordInput } from "../../lib/keywords";
import { useWorkspace } from "../../lib/workspace";

type WatchlistItem = {
  id: string;
  keyword: string;
  rank: number | null;
  competition: number;
  opportunity: number;
  movement: number;
  tags: string[];
};
type WatchlistResponse = { data: WatchlistItem[]; nextObservationAt: string | null };

export function WatchlistPage() {
  const { selectedProject } = useWorkspace();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("7D");
  const [composerOpen, setComposerOpen] = useState(false);
  const queryClient = useQueryClient();
  const watchlist = useQuery({
    queryKey: ["watchlist", selectedProject.id],
    queryFn: () => apiRequest<WatchlistResponse>(`/projects/${selectedProject.id}/watchlist`),
    staleTime: 60_000,
  });
  const addKeyword = useMutation({
    mutationFn: async (keywordInput: string) => {
      const keywords = parseKeywordInput(keywordInput);
      const created: WatchlistItem[] = [];

      for (const keyword of keywords) {
        const response = await apiRequest<{ data: WatchlistItem }>(
          `/projects/${selectedProject.id}/watchlist`,
          {
            method: "POST",
            body: JSON.stringify({ keyword }),
          },
        );
        created.push(response.data);
      }

      return created;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<WatchlistResponse>(["watchlist", selectedProject.id], (current) => {
        const existing = current?.data ?? [];
        const merged = new Map(existing.map((item) => [item.id, item]));
        for (const item of created) merged.set(item.id, item);
        return {
          data: [...merged.values()],
          nextObservationAt: current?.nextObservationAt ?? null,
        };
      });
      queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] });
      setComposerOpen(false);
    },
  });
  const deleteKeyword = useMutation({
    mutationFn: (trackedKeywordId: string) =>
      apiRequest<{ deleted: true; id: string }>(
        `/projects/${selectedProject.id}/watchlist/${trackedKeywordId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<WatchlistResponse>(["watchlist", selectedProject.id], (current) => ({
        data: (current?.data ?? []).filter((item) => item.id !== id),
        nextObservationAt: current?.nextObservationAt ?? null,
      }));
      queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] });
    },
  });
  const rows = useMemo(
    () => (watchlist.data?.data ?? []).filter((row) => row.keyword.includes(query.toLowerCase())),
    [query, watchlist.data?.data],
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("add") === "1") {
      setComposerOpen(true);
      searchParams.delete("add");
      const nextSearch = searchParams.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

  function downloadCsv() {
    const anchor = document.createElement("a");
    anchor.href = `/api/v1/projects/${selectedProject.id}/export.csv`;
    anchor.download = "asopulse-watchlist.csv";
    anchor.click();
  }

  return (
    <motion.div className="page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-intro compact">
        <div>
          <h1>Track keywords</h1>
          <p>Your current keywords for this app, observed daily.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button" onClick={downloadCsv}>
            <DownloadIcon size={16} /> Export CSV
          </button>
          <button type="button" className="primary-button" onClick={() => setComposerOpen(true)}>
            <PlusIcon size={16} /> Add keywords
          </button>
        </div>
      </div>
      {addKeyword.isSuccess ? (
        <p className="success-message">
          <CheckIcon size={15} /> Keywords added with fresh App Store observations.
        </p>
      ) : null}
      {addKeyword.isError ? (
        <p className="inline-error">
          The keyword could not be observed. Check that the API and worker services are running.
        </p>
      ) : null}
      <div className="watch-toolbar">
        <label>
          <SearchIcon size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter keywords"
          />
        </label>
        <div className="range-switch">
          {["7D", "30D", "90D"].map((item) => (
            <button
              type="button"
              key={item}
              className={period === item ? "is-active" : ""}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span>
          {watchlist.data?.nextObservationAt
            ? `Next observation · ${new Date(watchlist.data.nextObservationAt).toLocaleString()}`
            : "Next observation follows your daily schedule"}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-table">Add a keyword to begin tracking for this app.</div>
      ) : (
        <div className="watchlist-table">
          <div className="watchlist-head">
            <span>Keyword</span>
            <span>Rank</span>
            <span>{period} movement</span>
            <span>Opportunity</span>
            <span>Tag</span>
          </div>
          {rows.map((row, index) => (
            <motion.div
              className="watchlist-row"
              key={row.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.04 }}
            >
              <div>
                <strong>{row.keyword}</strong>
                <small>{selectedProject.storefront} · App Store</small>
              </div>
              <strong className="rank-number">{row.rank ?? ">200"}</strong>
              <span className={row.movement > 0 ? "positive" : row.movement < 0 ? "negative" : ""}>
                {row.movement > 0 ? "↑" : row.movement < 0 ? "↓" : "→"} {Math.abs(row.movement)}
              </span>
              <span>{row.opportunity}</span>
              <div className="watchlist-row-actions">
                <span className="plain-tag">{row.tags[0] ?? "untagged"}</span>
                <button
                  type="button"
                  className="row-delete-button"
                  aria-label={`Delete ${row.keyword}`}
                  onClick={() => deleteKeyword.mutate(row.id)}
                  disabled={deleteKeyword.isPending}
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <KeywordComposerDialog
        open={composerOpen}
        title="Add keywords"
        description="Paste one or more terms for this app’s tracking list."
        submitLabel="Add to tracking"
        submitting={addKeyword.isPending}
        onClose={() => setComposerOpen(false)}
        onSubmit={async (value) => {
          await addKeyword.mutateAsync(value);
        }}
      />
    </motion.div>
  );
}
