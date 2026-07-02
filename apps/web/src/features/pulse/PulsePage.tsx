import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "../../components/icons";
import { signals } from "../../data/fixtures";
import { OpportunityTable } from "./OpportunityTable";
import { RankChart } from "./RankChart";

export function PulsePage() {
  return (
    <motion.div
      className="page pulse-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="page-intro">
        <div>
          <p className="date-mobile">Thursday, July 2</p>
          <h1>Your market, in motion.</h1>
          <p>The signals worth acting on, distilled from today’s movement.</p>
        </div>
        <time dateTime="2026-07-02">Thursday, July 2</time>
      </div>
      <div className="pulse-grid">
        <RankChart />
        <aside className="signals" aria-labelledby="signals-heading">
          <h2 id="signals-heading">Signals</h2>
          {signals.map((signal, index) => (
            <motion.button
              key={signal.id}
              className="signal-row"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.06 }}
            >
              <span className="signal-icon">
                {signal.kind === "up" ? <ArrowUpIcon /> : <ArrowDownIcon />}
              </span>
              <span className="signal-copy">
                <strong>{signal.title}</strong>
                <small>{signal.detail}</small>
              </span>
              <em className={signal.kind === "up" ? "positive" : "negative"}>{signal.value}</em>
            </motion.button>
          ))}
          <Link to="/watchlist" className="text-link">
            Review watchlist <span>→</span>
          </Link>
        </aside>
      </div>
      <section className="opportunity-section" aria-labelledby="opportunity-heading">
        <div className="section-heading-row">
          <div>
            <h2 id="opportunity-heading">Opportunity field</h2>
            <p>Observed rankings and explainable result competition.</p>
          </div>
          <Link className="primary-button" to="/discover">
            <SearchIcon size={17} /> Find keywords
          </Link>
        </div>
        <OpportunityTable />
      </section>
    </motion.div>
  );
}
