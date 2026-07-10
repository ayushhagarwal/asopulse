import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { STOREFRONTS, type StorefrontCode, storefrontName } from "../lib/storefronts";
import type { WorkspaceProject } from "../lib/workspace";
import { CloseIcon, SearchIcon } from "./icons";

export type SearchResult = {
  appId: string;
  name: string;
  developer: string;
  iconUrl: string;
  averageRating: number;
  ratingCount: number;
};

export type ProjectSelection = { app: SearchResult; storefront: StorefrontCode };

type SearchResponse = { data: SearchResult[] };

export function AppPickerDialog({
  open,
  onClose,
  projects,
  currentProjectId,
  creating,
  onCreateProject,
  onSelectProject,
}: {
  open: boolean;
  onClose: () => void;
  projects: WorkspaceProject[];
  currentProjectId: string;
  creating: boolean;
  onCreateProject: (selection: ProjectSelection) => void;
  onSelectProject: (projectId: string) => void;
}) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [storefront, setStorefront] = useState<StorefrontCode>("US");
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open]);
  const search = useQuery({
    queryKey: ["app-search", term, storefront],
    queryFn: () =>
      apiRequest<SearchResponse>(
        `/apps/search?term=${encodeURIComponent(term)}&country=${storefront}`,
      ),
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
                <h2>Switch workspace</h2>
                <p>Select a workspace or search another App Store market.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close app picker"
                onClick={onClose}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="existing-projects">
              {projects.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className={`app-result existing-project ${currentProjectId === project.id ? "is-current" : ""}`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <span className="result-icon">{project.name.slice(0, 1)}</span>
                  <span>
                    <strong>{project.name}</strong>
                    <small>{storefrontName(project.storefront)} · App Store</small>
                  </span>
                  <span>
                    <small>{currentProjectId === project.id ? "Current workspace" : "Open"}</small>
                  </span>
                </button>
              ))}
            </div>
            <form
              className="picker-search"
              onSubmit={(event) => {
                event.preventDefault();
                setTerm(input.trim());
              }}
            >
              <label className="storefront-field">
                <span className="sr-only">App Store market</span>
                <select
                  value={storefront}
                  onChange={(event) => setStorefront(event.target.value as StorefrontCode)}
                >
                  {STOREFRONTS.map((market) => (
                    <option key={market.code} value={market.code}>
                      {market.name}
                    </option>
                  ))}
                </select>
              </label>
              <SearchIcon />
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Search App Store to create a workspace"
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
                <div className="picker-message">
                  Search for another app when you’re ready to add a workspace.
                </div>
              ) : null}
              {search.data?.data.map((app) => (
                <button
                  type="button"
                  key={app.appId}
                  className="app-result"
                  onClick={() => onCreateProject({ app, storefront })}
                  disabled={creating}
                >
                  <span className="result-icon">
                    {app.iconUrl ? <img src={app.iconUrl} alt="" /> : app.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{app.name}</strong>
                    <small>{app.developer}</small>
                  </span>
                  <span>
                    {creating ? (
                      <small>Creating…</small>
                    ) : (
                      <>
                        <strong>{app.averageRating.toFixed(1)}</strong>
                        <small>{app.ratingCount.toLocaleString()} ratings</small>
                      </>
                    )}
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
