import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { STOREFRONTS, storefrontName } from "../lib/storefronts";
import type { WorkspaceProject } from "../lib/workspace";
import { CheckIcon, CloseIcon, PlusIcon } from "./icons";

export function MarketPickerDialog({
  open,
  projects,
  currentProject,
  creating,
  onClose,
  onSelect,
  onCreate,
}: {
  open: boolean;
  projects: WorkspaceProject[];
  currentProject: WorkspaceProject;
  creating: boolean;
  onClose: () => void;
  onSelect: (projectId: string) => void;
  onCreate: (storefront: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  const siblings = new Map(
    projects
      .filter((project) => project.appId === currentProject.appId)
      .map((project) => [project.storefront, project]),
  );

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
            className="market-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-picker-title"
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="picker-heading">
              <div>
                <h2 id="market-picker-title">App Store market</h2>
                <p>Each market keeps an independent ranking history.</p>
              </div>
              <button ref={closeRef} type="button" className="icon-button" onClick={onClose}>
                <CloseIcon />
                <span className="sr-only">Close market picker</span>
              </button>
            </div>
            <div className="market-list">
              {STOREFRONTS.map((market) => {
                const saved = siblings.get(market.code);
                const current = saved?.id === currentProject.id;
                return (
                  <button
                    type="button"
                    key={market.code}
                    className={current ? "market-option is-current" : "market-option"}
                    onClick={() => (saved ? onSelect(saved.id) : onCreate(market.code))}
                    disabled={creating}
                  >
                    <span>
                      <strong>{storefrontName(market.code)}</strong>
                      <small>{saved ? "History saved" : "Copy keywords into this market"}</small>
                    </span>
                    {current ? (
                      <CheckIcon size={17} />
                    ) : saved ? (
                      <span>Open</span>
                    ) : (
                      <PlusIcon size={17} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
