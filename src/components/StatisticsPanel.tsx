import { Distributions, Statistics, Vector } from "mallory-math";
import { useRef, useState } from "react";
import { cellIdsStatistics } from "../lib/cell-ids.ts";
import { CellGraph } from "../lib/cell-graph.ts";
import { useCell } from "../lib/use-cell.ts";

type SummaryResult =
  | {
      ok: true;
      count: number;
      mean: number;
      median: number;
      standardDeviation: number;
      variance: number;
      min: number;
      max: number;
      fiveNumberSummary: number[];
    }
  | { ok: false; message: string };

type QueryResult = { ok: true; lowerCdf: number; upperCdf: number; intervalProbability: number } | { ok: false; message: string };

const DEFAULT_DATA = "2, 4, 4, 4, 5, 5, 7, 9";

function parseData(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

/**
 * Sets up the statistics panel's reactive cells on its own private
 * CellGraph -- a raw data-value list plus separate distribution-query
 * parameters, a different input shape from GraphCanvas's single expression +
 * axis variable, so (like SystemSolverPanel) it isn't woven into
 * `cellIds`/`useExpressionGraph` at all.
 */
function useStatisticsGraph(cellId: string): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    const ids = cellIdsStatistics(cellId);
    if (!graph.has(ids.data)) {
      graph.set(ids.data, DEFAULT_DATA);
      graph.set(ids.distMean, "0");
      graph.set(ids.distSd, "1");
      graph.set(ids.queryLower, "-1");
      graph.set(ids.queryUpper, "1");

      // Same "surface the real error" deviation SystemSolverPanel uses:
      // this is a discrete action on typed-in text, not a continuous
      // sampling target, so a thrown message is more useful than a stale
      // last-good summary.
      graph.define(ids.summary, (): SummaryResult => {
        try {
          const parsed = parseData(graph.get<string>(ids.data));
          if (parsed.length === 0) throw new Error("Enter at least one number.");
          if (parsed.some(Number.isNaN)) throw new Error("Every entry must be a number.");
          const values = new Vector<number>(...parsed);
          return {
            ok: true,
            count: values.length,
            mean: Statistics.mean(values),
            median: Statistics.median(values),
            standardDeviation: values.length > 1 ? Statistics.standardDeviation(values) : Number.NaN,
            variance: values.length > 1 ? Statistics.variance(values) : Number.NaN,
            min: Statistics.minimum(values),
            max: Statistics.maximum(values),
            fiveNumberSummary: [...Statistics.fiveNumberSummary(values)],
          };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });

      // v1 is a Normal-distribution calculator only -- PDF/CDF at a point
      // isn't shown separately since the interval query below subsumes it
      // (a degenerate [x, x] interval), and no interactive draggable-marker
      // axis widget yet (GeoGebra's Probability Calculator UX) -- that's a
      // later extension once this basic numeric-input version is in place.
      graph.define(ids.query, (): QueryResult => {
        try {
          const mean = Number(graph.get<string>(ids.distMean));
          const sd = Number(graph.get<string>(ids.distSd));
          const lower = Number(graph.get<string>(ids.queryLower));
          const upper = Number(graph.get<string>(ids.queryUpper));
          if ([mean, sd, lower, upper].some(Number.isNaN)) throw new Error("Every field must be a number.");
          if (sd <= 0) throw new Error("Standard deviation must be positive.");
          const dist = Distributions.normal(mean, sd);
          const lowerCdf = dist.cdf(lower);
          const upperCdf = dist.cdf(upper);
          return { ok: true, lowerCdf, upperCdf, intervalProbability: Math.max(0, upperCdf - lowerCdf) };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });
    }
    ref.current = graph;
  }
  return ref.current;
}

export interface StatisticsPanelProps {
  cellId?: string;
}

/** v1: descriptive statistics for an entered dataset, plus a Normal-distribution interval-probability calculator. */
export function StatisticsPanel({ cellId = "statistics-1" }: StatisticsPanelProps = {}) {
  const graph = useStatisticsGraph(cellId);
  const ids = cellIdsStatistics(cellId);
  const data = useCell<string>(graph, ids.data);
  const summary = useCell<SummaryResult>(graph, ids.summary);
  const distMean = useCell<string>(graph, ids.distMean);
  const distSd = useCell<string>(graph, ids.distSd);
  const queryLower = useCell<string>(graph, ids.queryLower);
  const queryUpper = useCell<string>(graph, ids.queryUpper);
  const query = useCell<QueryResult>(graph, ids.query);

  const [dataInput, setDataInput] = useState(data);

  function updateData(value: string) {
    setDataInput(value);
    graph.set(ids.data, value);
  }

  return (
    <div>
      <h2>Descriptive statistics</h2>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          Data (comma or space separated):{" "}
          <input value={dataInput} onChange={(e) => updateData(e.target.value)} style={{ font: "inherit", width: "40ch" }} />
        </label>
      </div>
      <div style={{ margin: "0.5rem 0" }}>
        {summary.ok ? (
          <ul>
            <li>n = {summary.count}</li>
            <li>mean = {summary.mean.toFixed(4)}</li>
            <li>median = {summary.median.toFixed(4)}</li>
            <li>standard deviation = {Number.isNaN(summary.standardDeviation) ? "n/a (n<2)" : summary.standardDeviation.toFixed(4)}</li>
            <li>variance = {Number.isNaN(summary.variance) ? "n/a (n<2)" : summary.variance.toFixed(4)}</li>
            <li>min / max = {summary.min.toFixed(4)} / {summary.max.toFixed(4)}</li>
            <li>five-number summary = [{summary.fiveNumberSummary.map((v) => v.toFixed(4)).join(", ")}]</li>
          </ul>
        ) : (
          <p style={{ color: "crimson" }}>{summary.message}</p>
        )}
      </div>

      <h2>Normal distribution</h2>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          mean:{" "}
          <input
            value={distMean}
            onChange={(e) => graph.set(ids.distMean, e.target.value)}
            style={{ font: "inherit", width: "8ch" }}
          />
        </label>{" "}
        <label>
          sd:{" "}
          <input
            value={distSd}
            onChange={(e) => graph.set(ids.distSd, e.target.value)}
            style={{ font: "inherit", width: "8ch" }}
          />
        </label>
      </div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          P(
          <input
            value={queryLower}
            onChange={(e) => graph.set(ids.queryLower, e.target.value)}
            style={{ font: "inherit", width: "6ch" }}
          />{" "}
          ≤ X ≤{" "}
          <input
            value={queryUpper}
            onChange={(e) => graph.set(ids.queryUpper, e.target.value)}
            style={{ font: "inherit", width: "6ch" }}
          />
          )
        </label>
      </div>
      <div style={{ margin: "0.5rem 0" }}>
        {query.ok ? (
          <p>
            = {query.intervalProbability.toFixed(6)} (CDF({queryUpper}) = {query.upperCdf.toFixed(6)}, CDF({queryLower}) ={" "}
            {query.lowerCdf.toFixed(6)})
          </p>
        ) : (
          <p style={{ color: "crimson" }}>{query.message}</p>
        )}
      </div>
    </div>
  );
}
