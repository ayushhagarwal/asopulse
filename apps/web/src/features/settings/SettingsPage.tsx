import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, DownloadIcon } from "../../components/icons";
import { apiRequest } from "../../lib/api";
import { useWorkspace } from "../../lib/workspace";

type Settings = {
  enabled: boolean;
  frequency: "daily" | "weekdays" | "weekly";
  time: string;
  timezone: string;
  weekday: number;
};
type Diagnostics = {
  api: string;
  worker: string;
  database: string;
  telemetry: boolean;
  lastObservationAt: string | null;
};
const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  frequency: "daily",
  time: "06:00",
  timezone: "UTC",
  weekday: 1,
};

export function SettingsPage() {
  const { projects, selectedProject, setSelectedProjectId } = useWorkspace();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Settings>(selectedProject.settings ?? DEFAULT_SETTINGS);
  const [importMessage, setImportMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const settings = useQuery({
    queryKey: ["project-settings", selectedProject.id],
    queryFn: () => apiRequest<{ data: Settings }>(`/projects/${selectedProject.id}/settings`),
  });
  const diagnostics = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => apiRequest<Diagnostics>("/diagnostics"),
    retry: false,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    setDraft(settings.data?.data ?? selectedProject.settings ?? DEFAULT_SETTINGS);
  }, [selectedProject.settings, settings.data?.data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest<{ data: Settings }>(`/projects/${selectedProject.id}/settings`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      }),
    onSuccess: async ({ data }) => {
      setDraft(data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project-settings", selectedProject.id] }),
        queryClient.invalidateQueries({ queryKey: ["watchlist", selectedProject.id] }),
        queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] }),
      ]);
    },
  });
  const deleteProject = useMutation({
    mutationFn: () =>
      apiRequest<{ deleted: true; id: string }>(`/projects/${selectedProject.id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      const nextProject = projects.find((project) => project.id !== selectedProject.id);
      setDeleteOpen(false);
      setSelectedProjectId(nextProject?.id ?? "");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  useEffect(() => {
    if (!deleteOpen) return;
    const frame = requestAnimationFrame(() => deleteCancelRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleteProject.isPending) setDeleteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [deleteOpen, deleteProject.isPending]);

  function downloadBackup() {
    const anchor = document.createElement("a");
    anchor.href = `/api/v1/projects/${selectedProject.id}/backup`;
    anchor.download = `${selectedProject.name.toLowerCase().replaceAll(/\s+/g, "-")}-backup.json`;
    anchor.click();
  }

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezones = [
    ...new Set([
      browserTimezone,
      draft.timezone,
      "UTC",
      "America/New_York",
      "Europe/London",
      "Asia/Kolkata",
      "Asia/Tokyo",
      "Australia/Sydney",
    ]),
  ];
  const systemHealthy =
    diagnostics.data?.api === "healthy" &&
    diagnostics.data.database === "healthy" &&
    diagnostics.data.worker === "healthy";

  return (
    <motion.div
      className="page settings-page"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="settings-heading">
        <h1>Settings</h1>
        <p>
          Scheduling and data controls for {selectedProject.name} in {selectedProject.storefront}.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <section className="settings-section schedule-settings">
          <div>
            <h2>Observation schedule</h2>
            <p>Run fresh ranking checks in this market on your own local schedule.</p>
          </div>
          <div className="schedule-form">
            <label className="schedule-toggle">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              <span>Automatic observations</span>
            </label>
            <label>
              Frequency
              <select
                value={draft.frequency}
                disabled={!draft.enabled}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    frequency: event.target.value as Settings["frequency"],
                  }))
                }
              >
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Once a week</option>
              </select>
            </label>
            {draft.frequency === "weekly" ? (
              <label>
                Weekday
                <select
                  value={draft.weekday}
                  disabled={!draft.enabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, weekday: Number(event.target.value) }))
                  }
                >
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day, index) => (
                    <option value={index + 1} key={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Time
              <input
                type="time"
                value={draft.time}
                disabled={!draft.enabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, time: event.target.value }))
                }
              />
            </label>
            <label>
              Timezone
              <select
                value={draft.timezone}
                disabled={!draft.enabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, timezone: event.target.value }))
                }
              >
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className="settings-section">
          <div>
            <h2>Backup</h2>
            <p>
              Export a portable version 3 snapshot. Existing version 2 backups remain restorable.
            </p>
          </div>
          <div className="backup-actions">
            <button type="button" className="secondary-button" onClick={downloadBackup}>
              <DownloadIcon size={16} /> Download backup
            </button>
            <label className="secondary-button file-button">
              Restore backup
              <input
                type="file"
                accept="application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const backup = JSON.parse(await file.text()) as unknown;
                    const result = await apiRequest<{
                      importedKeywords: number;
                      importedObservations: number;
                    }>(`/projects/${selectedProject.id}/restore`, {
                      method: "POST",
                      body: JSON.stringify(backup),
                    });
                    await Promise.all([
                      queryClient.invalidateQueries({
                        queryKey: ["watchlist", selectedProject.id],
                      }),
                      queryClient.invalidateQueries({ queryKey: ["pulse", selectedProject.id] }),
                      queryClient.invalidateQueries({
                        queryKey: ["project-settings", selectedProject.id],
                      }),
                    ]);
                    setImportMessage(
                      `${result.importedKeywords} keywords and ${result.importedObservations} observations restored.`,
                    );
                  } catch {
                    setImportMessage("That file is not a valid ASOpulse backup.");
                  }
                }}
              />
            </label>
            {importMessage ? <small>{importMessage}</small> : null}
          </div>
        </section>
        <section className="settings-section">
          <div>
            <h2>Diagnostics</h2>
            <p>
              {diagnostics.data
                ? `API ${diagnostics.data.api} · Worker ${diagnostics.data.worker} · Database ${diagnostics.data.database}`
                : "Checking local services…"}
            </p>
            {diagnostics.data?.lastObservationAt ? (
              <small>
                Last observation {new Date(diagnostics.data.lastObservationAt).toLocaleString()}
              </small>
            ) : null}
          </div>
          <span className={`health ${systemHealthy ? "" : "is-degraded"}`}>
            <i />{" "}
            {diagnostics.isError
              ? "API currently offline"
              : systemHealthy
                ? "All systems healthy"
                : "Worker needs attention"}
          </span>
        </section>
        <section className="settings-section danger-settings">
          <div>
            <h2>Delete app workspace</h2>
            <p>
              Remove {selectedProject.name} from {selectedProject.storefront}, including its
              keywords and ranking history. Other markets remain unchanged.
            </p>
          </div>
          <div className="danger-actions">
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                deleteProject.reset();
                setDeleteOpen(true);
              }}
            >
              Delete app workspace
            </button>
          </div>
        </section>
        {save.isError ? (
          <p className="inline-error">
            The schedule could not be saved. Check the values and try again.
          </p>
        ) : null}
        <div className="settings-submit">
          <button
            className="primary-button"
            type="submit"
            disabled={save.isPending || settings.isLoading}
          >
            {save.isSuccess ? <CheckIcon size={16} /> : null}
            {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : "Save schedule"}
          </button>
        </div>
      </form>
      <AnimatePresence>
        {deleteOpen ? (
          <motion.div
            className="command-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => {
              if (!deleteProject.isPending) setDeleteOpen(false);
            }}
          >
            <motion.div
              className="delete-project-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-project-title"
              aria-describedby="delete-project-description"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <h2 id="delete-project-title">Delete {selectedProject.name}?</h2>
              <p id="delete-project-description">
                This permanently deletes the {selectedProject.storefront} workspace, all tracked
                keywords, ranking observations, signals, and refresh history. This cannot be undone.
              </p>
              {deleteProject.isError ? (
                <p className="inline-error">The app workspace could not be deleted. Try again.</p>
              ) : null}
              <div className="delete-project-actions">
                <button
                  ref={deleteCancelRef}
                  type="button"
                  className="secondary-button"
                  disabled={deleteProject.isPending}
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={deleteProject.isPending}
                  onClick={() => deleteProject.mutate()}
                >
                  {deleteProject.isPending ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
