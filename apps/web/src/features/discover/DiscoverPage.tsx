import { motion } from "motion/react";
import { useDeferredValue, useState } from "react";
import { CheckIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { keywordRows } from "../../data/fixtures";

export function DiscoverPage() {
  const [query, setQuery] = useState("journal");
  const deferredQuery = useDeferredValue(query);
  const [tracked, setTracked] = useState(
    () => new Set(keywordRows.filter((row) => row.tracked).map((row) => row.id)),
  );
  const results = keywordRows.filter((row) => row.keyword.includes(deferredQuery.toLowerCase()));

  return (
    <motion.div className="page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-intro compact">
        <div>
          <h1>Find the opening.</h1>
          <p>Explore observable App Store results—without imaginary volume numbers.</p>
        </div>
      </div>
      <label className="hero-search">
        <SearchIcon size={22} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “daily journal”"
          autoFocus
        />
        <kbd>↵</kbd>
      </label>
      <div className="method-note">
        <span>Opportunity v1.0</span>
        <p>
          Balances metadata saturation, result concentration, and your observed position. Every
          input is inspectable.
        </p>
        <button>How it works</button>
      </div>
      <section className="discover-results">
        <div className="section-heading-row">
          <div>
            <h2>Related opportunities</h2>
            <p>{results.length} observable keyword patterns</p>
          </div>
        </div>
        <div className="keyword-list">
          {results.map((row, index) => {
            const isTracked = tracked.has(row.id);
            return (
              <motion.div
                className="keyword-result"
                key={row.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div>
                  <strong>{row.keyword}</strong>
                  <span>{row.rank ? `Currently #${row.rank}` : "Outside top 200"}</span>
                </div>
                <dl>
                  <div>
                    <dt>Opportunity</dt>
                    <dd>{row.opportunity}</dd>
                  </div>
                  <div>
                    <dt>Competition</dt>
                    <dd>{row.competition}</dd>
                  </div>
                  <div>
                    <dt>Movement</dt>
                    <dd
                      className={row.movement > 0 ? "positive" : row.movement < 0 ? "negative" : ""}
                    >
                      {row.movement > 0 ? "+" : ""}
                      {row.movement}
                    </dd>
                  </div>
                </dl>
                <button
                  className={isTracked ? "tracked-button" : "secondary-button"}
                  onClick={() =>
                    setTracked((current) => {
                      const next = new Set(current);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      return next;
                    })
                  }
                >
                  {isTracked ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                  {isTracked ? "Tracking" : "Track"}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}
