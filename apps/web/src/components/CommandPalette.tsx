import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BookmarkIcon, CloseIcon, PulseIcon, SearchIcon, SettingsIcon } from "./icons";

const actions = [
  { label: "Open Pulse", hint: "Ranking overview", to: "/pulse", icon: PulseIcon },
  {
    label: "Discover keywords",
    hint: "Research an opportunity",
    to: "/discover",
    icon: SearchIcon,
  },
  { label: "Open tracking", hint: "Review tracked terms", to: "/watchlist", icon: BookmarkIcon },
  { label: "Open Settings", hint: "Schedules and data", to: "/settings", icon: SettingsIcon },
] as const;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const filtered = actions.filter((action) =>
    `${action.label} ${action.hint}`.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

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
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="command-input-row">
              <SearchIcon size={19} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search or type a command…"
              />
              <button
                type="button"
                className="icon-button"
                onClick={onClose}
                aria-label="Close command menu"
              >
                <CloseIcon size={17} />
              </button>
            </div>
            <div className="command-results">
              {filtered.map((action) => (
                <button
                  type="button"
                  key={action.to}
                  onClick={() => {
                    void navigate({ to: action.to });
                    onClose();
                  }}
                >
                  <action.icon size={19} />
                  <span>
                    <strong>{action.label}</strong>
                    <small>{action.hint}</small>
                  </span>
                  <kbd>↵</kbd>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
