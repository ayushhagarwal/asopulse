import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState } from "react";
import { CheckIcon, DownloadIcon } from "../../components/icons";
import { apiRequest } from "../../lib/api";
import { useWorkspace } from "../../lib/workspace";

type Diagnostics = {
  api: string;
  worker: string;
  database: string;
  telemetry: boolean;
  lastObservationAt: string;
};

export function SettingsPage() {
  const { selectedProject } = useWorkspace();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [retention, setRetention] = useState("forever");
  const [importMessage, setImportMessage] = useState("");
  const diagnostics = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => apiRequest<Diagnostics>("/diagnostics"),
    retry: false,
    refetchInterval: 30_000,
  });
  const logout = useMutation({
    mutationFn: () => apiRequest<{ loggedOut: true }>("/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  function downloadBackup() {
    const anchor = document.createElement("a");
    anchor.href = `/api/v1/projects/${selectedProject.id}/backup`;
    anchor.download = `${selectedProject.name.toLowerCase().replaceAll(/\s+/g, "-")}-backup.json`;
    anchor.click();
  }

  return (
    <motion.div
      className="page settings-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="page-intro compact">
        <div>
          <h1>Settings</h1>
          <p>Quiet defaults, explicit control.</p>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1800);
        }}
      >
        <section className="settings-section">
          <div>
            <h2>Observation schedule</h2>
            <p>Rank checks run once daily and use a shared request budget.</p>
          </div>
          <div className="settings-controls">
            <label>
              Time
              <select defaultValue="06:00">
                <option value="06:00">06:00</option>
                <option value="12:00">12:00</option>
                <option value="18:00">18:00</option>
              </select>
            </label>
            <label>
              Timezone
              <select defaultValue="local">
                <option value="local">Asia/Kolkata</option>
                <option value="utc">UTC</option>
              </select>
            </label>
          </div>
        </section>
        <section className="settings-section">
          <div>
            <h2>Data retention</h2>
            <p>Rank history stays on your infrastructure.</p>
          </div>
          <div className="choice-list">
            {[
              ["90", "90 days"],
              ["365", "One year"],
              ["forever", "Keep forever"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="retention"
                  value={value}
                  checked={retention === value}
                  onChange={() => setRetention(value ?? "forever")}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>
        <section className="settings-section">
          <div>
            <h2>Backup</h2>
            <p>Export a portable snapshot of projects, keywords, and observations.</p>
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
                    await queryClient.invalidateQueries({
                      queryKey: ["watchlist", selectedProject.id],
                    });
                    await queryClient.invalidateQueries({
                      queryKey: ["pulse", selectedProject.id],
                    });
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
          </div>
          <span className="health">
            <i /> {diagnostics.isError ? "API currently offline" : "All systems calm"}
          </span>
        </section>
        <section className="settings-section">
          <div>
            <h2>Session</h2>
            <p>Log out of the current owner workspace.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
        </section>
        <div className="settings-submit">
          <button className="primary-button" type="submit">
            {saved ? <CheckIcon size={16} /> : null}
            {saved ? "Saved" : "Save changes"}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
