import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { apiRequest } from "../lib/api";
import { CloseIcon, SearchIcon } from "./icons";

export type SelectedApp = { appId: string; name: string; developer: string; iconUrl: string };
type SearchResponse = { data: Array<SelectedApp & { averageRating: number; ratingCount: number }> };

export function AppPickerDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (app: SelectedApp) => void;
}) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const search = useQuery({
    queryKey: ["app-search", term],
    queryFn: () =>
      apiRequest<SearchResponse>(`/apps/search?term=${encodeURIComponent(term)}&country=US`),
    enabled: term.length >= 2,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="command-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="app-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Choose an App Store app"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="picker-heading">
              <div>
                <h2>Choose your app</h2>
                <p>Search the US App Store. You can change storefronts later.</p>
              </div>
              <button className="icon-button" aria-label="Close app picker" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <form
              className="picker-search"
              onSubmit={(event) => {
                event.preventDefault();
                setTerm(input.trim());
              }}
            >
              <SearchIcon />
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="App name or developer"
                autoFocus
              />
              <button className="primary-button" type="submit">
                Search
              </button>
            </form>
            <div className="picker-results" aria-live="polite">
              {search.isFetching ? (
                <div className="picker-message">
                  <i /> Searching the store…
                </div>
              ) : null}
              {search.isError ? (
                <div className="picker-message error-message">
                  <strong>Couldn’t reach the local ASOpulse API.</strong>
                  <span>Start the API to search live App Store data.</span>
                </div>
              ) : null}
              {!search.isFetching && !search.isError && term.length === 0 ? (
                <div className="picker-message">Search for the app you want to monitor.</div>
              ) : null}
              {search.data?.data.map((app) => (
                <button
                  key={app.appId}
                  className="app-result"
                  onClick={() => {
                    onSelect(app);
                    onClose();
                  }}
                >
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
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
