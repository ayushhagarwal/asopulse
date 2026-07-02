import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowUpIcon, PulseIcon, SearchIcon } from "../../components/icons";
import { Logo } from "../../components/Logo";

const featureRows = [
  ["Observe", "Know where every tracked term actually ranks, by storefront and day."],
  [
    "Understand",
    "See competition and opportunity calculated only from inspectable result metadata.",
  ],
  ["Act", "Catch meaningful movement without turning your morning into a spreadsheet ritual."],
] as const;

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#method">Method</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link className="nav-cta" to="/pulse">
            Open ASOpulse
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1>
              See the signal.
              <br />
              Skip the noise.
            </h1>
            <p>
              Open-source App Store keyword research that shows its work. Track rankings, find
              openings, and keep every observation on infrastructure you control.
            </p>
            <div className="hero-actions">
              <Link className="landing-primary" to="/pulse">
                Open the workspace <span>→</span>
              </Link>
              <a className="landing-secondary" href="#method">
                See the method
              </a>
            </div>
          </motion.div>
          <ProductPreview />
        </section>
        <section className="landing-statement" id="method">
          <p>Most ASO tools hand you a score and ask for trust.</p>
          <h2>ASOpulse gives every number a source, a timestamp, and a method.</h2>
        </section>
        <section className="landing-features">
          {featureRows.map(([title, copy], index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.08 }}
            >
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </motion.article>
          ))}
        </section>
        <section className="open-section">
          <div>
            <PulseIcon size={29} />
            <h2>Open by design.</h2>
          </div>
          <p>
            Self-host the whole stack. Inspect the scoring. Export everything. Telemetry stays off
            unless you decide otherwise.
          </p>
          <Link to="/pulse">
            Explore ASOpulse <span>→</span>
          </Link>
        </section>
      </main>
      <footer>
        <Logo />
        <p>Built in the open for people who care how the answer was made.</p>
        <span>AGPL-3.0 · 2026</span>
      </footer>
    </div>
  );
}

function ProductPreview() {
  return (
    <motion.div
      className="product-preview"
      initial={{ opacity: 0, y: 24, rotateX: 4 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="preview-top">
        <span>
          <i /> Clarity — Daily Journal
        </span>
        <SearchIcon size={14} />
      </div>
      <div className="preview-body">
        <aside>
          <PulseIcon size={16} />
          <SearchIcon size={16} />
        </aside>
        <section>
          <small>Thursday, July 2</small>
          <h3>Your market, in motion.</h3>
          <div className="preview-chart">
            <svg viewBox="0 0 620 190" aria-hidden="true">
              <path d="M0 135 C80 129 115 128 170 110 S275 118 335 82 S445 70 620 38" />
              <path d="M0 170 C75 160 115 134 180 145 S275 125 350 119 S480 73 620 67" />
              <line x1="620" y1="18" x2="620" y2="175" />
              <circle cx="620" cy="38" r="6" />
            </svg>
          </div>
          <div className="preview-row">
            <span>daily journal</span>
            <strong>#12</strong>
            <em>
              <ArrowUpIcon size={13} /> 8
            </em>
          </div>
          <div className="preview-row">
            <span>journal prompts</span>
            <strong>#18</strong>
            <em>
              <ArrowUpIcon size={13} /> 3
            </em>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
