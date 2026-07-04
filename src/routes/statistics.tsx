import { createFileRoute, Link } from "@tanstack/react-router";
import { StatisticsPanel } from "../components/StatisticsPanel.tsx";

export const Route = createFileRoute("/statistics")({
  component: StatisticsPage,
});

function StatisticsPage() {
  return (
    <div>
      <h1>mallory-graph — statistics &amp; probability</h1>
      <details>
        <summary>Descriptive statistics plus a Normal-distribution interval-probability calculator.</summary>
        <p>
          Via <code>mallory-math</code>'s <code>Statistics</code> module (mean, median, standard deviation,
          five-number summary), plus <code>Distributions.normal</code> for interval probability. v1 covers the Normal
          distribution only — more distributions (<code>Distributions.binomial</code>/<code>poisson</code>/
          <code>studentT</code>/<code>chiSquare</code>/etc. already exist upstream) and an interactive
          draggable-marker axis are later extensions.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      <StatisticsPanel />
    </div>
  );
}
