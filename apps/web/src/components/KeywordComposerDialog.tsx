import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";

export function KeywordComposerDialog({
  open,
  title,
  description,
  submitLabel,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
      const handleKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    } else {
      setValue("");
    }
    return undefined;
  }, [onClose, open]);

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
            className="keyword-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="picker-heading keyword-dialog-heading">
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Close ${title.toLowerCase()}`}
                onClick={onClose}
              >
                <CloseIcon />
              </button>
            </div>
            <form
              className="keyword-dialog-form"
              onSubmit={async (event) => {
                event.preventDefault();
                void onSubmit(value).catch(() => undefined);
              }}
            >
              <SearchIcon size={18} />
              <input
                ref={inputRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Enter comma-separated keywords"
              />
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Adding…" : submitLabel}
              </button>
            </form>
            <p className="keyword-dialog-hint">You can also paste one keyword per line.</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
