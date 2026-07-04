import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { CheckIcon, DownloadIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { apiRequest } from "../../lib/api";
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
  const [adding, setAdding] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const queryClient = useQueryClient();
  const watchlist = useQuery({
    queryKey: ["watchlist", selectedProject.id],
    queryFn: () => apiRequest<WatchlistResponse>(`/projects/${selectedProject.id}/watchlist`),
    staleTime: 60_000,
  });
  const addKeyword = useMutation({
    mutationFn: (keyword: string) =>
      apiRequest<{ data: WatchlistItem }>(`/projects/${selectedProject.id}/watchlist`, {
        method: "POST",
        body: JSON.stringify({ keyword }),
      }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<WatchlistResponse>(["watchlist", selectedProject.id], (current) => ({
        data: [...(current?.data ?? []), data],
        nextObservationAt: current?.nextObservationAt ?? null,
      }));
      queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] });
      setNewKeyword("");
      setAdding(false);
    },
  });
  const rows = useMemo(
    () => (watchlist.data?.data ?? []).filter((row) => row.keyword.includes(query.toLowerCase())),
    [query, watchlist.data?.data],
  );

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
          <h1>Watchlist</h1>
          <p>A deliberate set of terms, observed daily.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button" onClick={downloadCsv}>
            <DownloadIcon size={16} /> Export CSV
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => setAdding((value) => !value)}
          >
            <PlusIcon size={16} /> Add keywords
          </button>
        </div>
      </div>
      {adding ? (
        <motion.form
          className="add-keyword-row"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={(event) => {
            event.preventDefault();
            if (newKeyword.trim().length >= 2) addKeyword.mutate(newKeyword.trim());
          }}
        >
          <SearchIcon size={18} />
          <input
            value={newKeyword}
            onChange={(event) => setNewKeyword(event.target.value)}
            placeholder="Keyword to observe"
          />
          <button className="primary-button" type="submit" disabled={addKeyword.isPending}>
            {addKeyword.isPending ? "Observing…" : "Add to watchlist"}
          </button>
        </motion.form>
      ) : null}
      {addKeyword.isSuccess ? (
        <p className="success-message">
          <CheckIcon size={15} /> Keyword added with a fresh App Store observation.
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
        <div className="empty-table">Add a keyword to begin your persistent watchlist.</div>
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
              <span className="plain-tag">{row.tags[0] ?? "untagged"}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
