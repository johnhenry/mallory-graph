import { createFileRoute, Link } from "@tanstack/react-router";
import { StatisticsPanel } from "../components/StatisticsPanel.tsx";

export const Route = createFileRoute("/statistics")({
  component: StatisticsPage,
});

function StatisticsPage() {
  return (
    <div>
      <h1>mallory-graph — statistics &amp; probability</h1>
      <p>
        Descriptive statistics (mean, median, standard deviation, five-number summary) via <code>mallory-math</code>
        's <code>Statistics</code> module, plus a Normal-distribution interval-probability calculator via{" "}
        <code>Distributions.normal</code>. v1 covers the Normal distribution only — more distributions
        (<code>Distributions.binomial</code>/<code>poisson</code>/<code>studentT</code>/<code>chiSquare</code>/etc.
        already exist upstream) and an interactive draggable-marker axis are later extensions.
      </p>
      <p>
        <Link to="/">← back</Link>
      </p>
      <StatisticsPanel />
    </div>
  );
}
