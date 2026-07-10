import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
} from "../../components/icons";
import { KeywordComposerDialog } from "../../components/KeywordComposerDialog";
import { ApiError, apiRequest } from "../../lib/api";
import { parseKeywordInput } from "../../lib/keywords";
import { useWorkspace } from "../../lib/workspace";
import { KeywordHistoryDrawer } from "./KeywordHistoryDrawer";
import { RankSparkline } from "./RankSparkline";

type Range = "7d" | "30d" | "90d";
type WatchlistItem = {
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
};
type WatchlistResponse = { data: WatchlistItem[]; nextObservationAt: string | null };
type ObservationRun = {
  id: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  observedCount: number;
  failedCount: number;
  failures: Array<{ keyword: string; message: string }>;
  startedAt: string;
  finishedAt: string | null;
  nextEligibleManualAt: string | null;
};

function relativeTime(value?: string | null) {
  if (!value) return "Pending";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h ago`;
  return new Date(value).toLocaleDateString();
}

function movementLabel(movement: number | null) {
  if (movement === null) return "—";
  return `${movement > 0 ? "↑" : movement < 0 ? "↓" : "→"} ${Math.abs(movement)}`;
}

export function WatchlistPage() {
  const { selectedProject } = useWorkspace();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [range, setRange] = useState<Range>("7d");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<"keyword" | "rank" | "movement" | "opportunity">("opportunity");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [drawerKeywordId, setDrawerKeywordId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!selectedProject.id) return;
    setSelectedIds(new Set());
    setDrawerKeywordId(null);
  }, [selectedProject.id]);

  const watchlist = useQuery({
    queryKey: ["watchlist", selectedProject.id, range],
    queryFn: () =>
      apiRequest<WatchlistResponse>(`/projects/${selectedProject.id}/watchlist?range=${range}`),
    staleTime: 30_000,
  });
  const latestRun = useQuery({
    queryKey: ["observation-run", selectedProject.id],
    queryFn: () =>
      apiRequest<{ data: ObservationRun | null }>(
        `/projects/${selectedProject.id}/observation-runs/latest`,
      ),
    refetchInterval: 3_000,
  });

  const addKeywords = useMutation({
    mutationFn: (input: string) => {
      const keywords = parseKeywordInput(input);
      if (keywords.length === 0) throw new Error("Add at least one keyword");
      return apiRequest<{ data: WatchlistItem[]; run: ObservationRun }>(
        `/projects/${selectedProject.id}/watchlist/batch`,
        { method: "POST", body: JSON.stringify({ keywords }) },
      );
    },
    onSuccess: async ({ data }) => {
      setComposerOpen(false);
      setNotice(`${data.length} keyword${data.length === 1 ? "" : "s"} added and queued.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["watchlist", selectedProject.id] }),
        queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] }),
        queryClient.invalidateQueries({ queryKey: ["observation-run", selectedProject.id] }),
      ]);
    },
  });
  const refresh = useMutation({
    mutationFn: () =>
      apiRequest<{ data: ObservationRun }>(`/projects/${selectedProject.id}/observation-runs`, {
        method: "POST",
        body: JSON.stringify(selectedIds.size > 0 ? { trackedKeywordIds: [...selectedIds] } : {}),
      }),
    onSuccess: async () => {
      setNotice(
        selectedIds.size > 0
          ? `${selectedIds.size} selected keyword${selectedIds.size === 1 ? "" : "s"} queued.`
          : "All keywords queued for a fresh observation.",
      );
      await queryClient.invalidateQueries({ queryKey: ["observation-run", selectedProject.id] });
    },
  });
  const deleteKeyword = useMutation({
    mutationFn: (trackedKeywordId: string) =>
      apiRequest<{ deleted: true; id: string }>(
        `/projects/${selectedProject.id}/watchlist/${trackedKeywordId}`,
        { method: "DELETE" },
      ),
    onSuccess: async ({ id }) => {
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      if (drawerKeywordId === id) setDrawerKeywordId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["watchlist", selectedProject.id] }),
        queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] }),
      ]);
    },
  });

  const allRows = watchlist.data?.data ?? [];
  const tags = useMemo(
    () => [...new Set(allRows.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b)),
    [allRows],
  );
  const rows = useMemo(() => {
    const filtered = allRows.filter(
      (row) => row.keyword.includes(deferredQuery) && (tag === "all" || row.tags.includes(tag)),
    );
    return filtered.toSorted((left, right) => {
      if (sort === "keyword") return left.keyword.localeCompare(right.keyword);
      if (sort === "rank") return (left.rank ?? 201) - (right.rank ?? 201);
      if (sort === "movement") return (right.movement ?? -999) - (left.movement ?? -999);
      return right.opportunity - left.opportunity;
    });
  }, [allRows, deferredQuery, sort, tag]);
  const latestObservedAt = allRows
    .filter((row) => row.refreshState === "fresh")
    .map((row) => row.provenance.observedAt)
    .toSorted()
    .at(-1);
  const run = latestRun.data?.data;
  const runActive = run?.status === "queued" || run?.status === "running";
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function downloadCsv() {
    const anchor = document.createElement("a");
    anchor.href = `/api/v1/projects/${selectedProject.id}/export.csv`;
    anchor.download = "asopulse-watchlist.csv";
    anchor.click();
  }

  return (
    <motion.div
      className={`page track-page ${drawerKeywordId ? "has-history-drawer" : ""}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="track-main">
        <div className="track-heading">
          <div>
            <h1>Tracked keywords</h1>
            <p>Your current App Store positions, with history you can trust.</p>
          </div>
          <div className="track-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending || runActive || allRows.length === 0}
            >
              <RefreshIcon size={17} />
              {runActive
                ? "Refreshing…"
                : selectedIds.size > 0
                  ? `Refresh ${selectedIds.size}`
                  : "Refresh all"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setComposerOpen(true)}
            >
              <PlusIcon size={17} /> Add keywords
            </button>
          </div>
        </div>

        <div className="freshness-rail">
          <span>
            <i /> Last refreshed {relativeTime(latestObservedAt)}
          </span>
          <span>
            <CalendarIcon size={16} /> Next scheduled refresh ·{" "}
            {watchlist.data?.nextObservationAt
              ? new Date(watchlist.data.nextObservationAt).toLocaleString()
              : "Off"}
          </span>
        </div>

        {notice ? (
          <p className="success-message">
            <CheckIcon size={15} /> {notice}
          </p>
        ) : null}
        {refresh.isError ? (
          <p className="inline-error">
            {refresh.error instanceof ApiError && refresh.error.status === 429
              ? "A fresh observation was requested recently. Try again after the cooldown."
              : "The refresh could not be queued. Check the worker and try again."}
          </p>
        ) : null}
        {run?.status === "partial" ? (
          <p className="inline-error">
            {run.failedCount} keyword observations failed; successful rows were still updated.
          </p>
        ) : null}

        <div className="track-toolbar">
          <label className="track-search">
            <SearchIcon size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search keywords"
            />
          </label>
          <fieldset className="segmented-control">
            <legend className="visually-hidden">Movement range</legend>
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
          <select
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            aria-label="Filter by tag"
          >
            <option value="all">All tags</option>
            {tags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            aria-label="Sort keywords"
          >
            <option value="opportunity">Sort: Opportunity</option>
            <option value="rank">Sort: Rank</option>
            <option value="movement">Sort: Movement</option>
            <option value="keyword">Sort: Keyword</option>
          </select>
          <span className="selection-count">
            {selectedIds.size ? `${selectedIds.size} selected` : `${rows.length} keywords`}
          </span>
          <button
            type="button"
            className="icon-button export-button"
            onClick={downloadCsv}
            aria-label="Export CSV"
          >
            <DownloadIcon size={17} />
          </button>
        </div>

        {watchlist.isLoading ? <div className="track-state">Loading tracked keywords…</div> : null}
        {watchlist.isError ? (
          <div className="track-state">
            <strong>Tracked keywords could not be loaded.</strong>
            <button type="button" className="text-link" onClick={() => watchlist.refetch()}>
              Try again
            </button>
          </div>
        ) : null}
        {!watchlist.isLoading && !watchlist.isError && allRows.length === 0 ? (
          <div className="track-state">
            <strong>No tracked keywords yet.</strong>
            <span>
              Add the terms that matter to this app and ASOpulse will queue their first observation.
            </span>
            <button type="button" className="primary-button" onClick={() => setComposerOpen(true)}>
              Add keywords
            </button>
          </div>
        ) : null}
        {!watchlist.isLoading && allRows.length > 0 && rows.length === 0 ? (
          <div className="track-state">
            <strong>No keywords match these filters.</strong>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setQuery("");
                setTag("all");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <table className="keyword-table">
            <caption className="visually-hidden">Tracked keywords</caption>
            <thead>
              <tr className="keyword-table-head">
                <th scope="col">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() =>
                      setSelectedIds(
                        allVisibleSelected ? new Set() : new Set(rows.map((row) => row.id)),
                      )
                    }
                    aria-label="Select all visible keywords"
                  />
                </th>
                <th scope="col">Keyword</th>
                <th scope="col">Rank</th>
                <th scope="col">{range.toUpperCase()} movement</th>
                <th scope="col">Opportunity</th>
                <th scope="col">Last checked</th>
                <th scope="col">Trend</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`keyword-table-row ${drawerKeywordId === row.id ? "is-open" : ""}`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelection(row.id)}
                      aria-label={`Select ${row.keyword}`}
                    />
                  </td>
                  <td className="keyword-name">
                    <button
                      type="button"
                      className="keyword-open-button"
                      onClick={() => setDrawerKeywordId(row.id)}
                    >
                      <strong>{row.keyword}</strong>
                      <small>{selectedProject.storefront} · App Store</small>
                    </button>
                  </td>
                  <td>
                    <strong className="table-rank">
                      {row.refreshState === "pending" ? "—" : (row.rank ?? ">200")}
                    </strong>
                  </td>
                  <td>
                    <span
                      className={
                        row.movement === null
                          ? ""
                          : row.movement > 0
                            ? "positive"
                            : row.movement < 0
                              ? "negative"
                              : ""
                      }
                    >
                      {movementLabel(row.movement)}
                    </span>
                  </td>
                  <td>{row.refreshState === "pending" ? "Pending" : row.opportunity}</td>
                  <td className="last-checked">
                    {relativeTime(
                      row.refreshState === "pending" ? null : row.provenance.observedAt,
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="sparkline-button"
                      onClick={() => setDrawerKeywordId(row.id)}
                      aria-label={`Open ${row.keyword} rank history`}
                    >
                      <RankSparkline
                        points={row.sparkline}
                        movement={row.movement}
                        label={`${row.keyword} seven day rank trend`}
                      />
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="row-delete-button"
                      onClick={() => deleteKeyword.mutate(row.id)}
                      disabled={deleteKeyword.isPending}
                      aria-label={`Delete ${row.keyword}`}
                    >
                      <CloseIcon size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
      <KeywordHistoryDrawer
        projectId={selectedProject.id}
        keywordId={drawerKeywordId}
        onClose={() => setDrawerKeywordId(null)}
      />
      <KeywordComposerDialog
        open={composerOpen}
        title="Add keywords"
        description="Paste up to 100 terms. Their first observations will run in the background."
        submitLabel="Add to tracking"
        submitting={addKeywords.isPending}
        onClose={() => setComposerOpen(false)}
        onSubmit={(value) => addKeywords.mutateAsync(value).then(() => undefined)}
      />
    </motion.div>
  );
}
