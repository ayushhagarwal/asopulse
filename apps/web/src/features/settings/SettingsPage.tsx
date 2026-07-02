import { motion } from "motion/react";
import { useState } from "react";
import { CheckIcon, DownloadIcon } from "../../components/icons";

export function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [retention, setRetention] = useState("forever");
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
          <button type="button" className="secondary-button">
            <DownloadIcon size={16} /> Download backup
          </button>
        </section>
        <section className="settings-section">
          <div>
            <h2>Diagnostics</h2>
            <p>API healthy · Worker ready · Last observation 4 hours ago</p>
          </div>
          <span className="health">
            <i /> All systems calm
          </span>
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
