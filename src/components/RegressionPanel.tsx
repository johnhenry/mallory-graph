import { GraphUtils, Statistics, Vector } from "mallory-math";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsRegression } from "../lib/cell-ids.ts";
import { drawPath, drawScatter, type Viewport } from "../lib/render-path.ts";
import { useCell } from "../lib/use-cell.ts";

const WIDTH = 500;
const HEIGHT = 500;

interface RegressionRow {
  id: string;
  x: string;
  y: string;
}

type FitResult =
  | { ok: true; slope: number; intercept: number; r: number; points: { x: number; y: number }[] }
  | { ok: false; message: string };

const DEFAULT_ROW_VALUES: Array<[string, string]> = [
  ["1", "2.1"],
  ["2", "3.9"],
  ["3", "6.2"],
  ["4", "7.8"],
  ["5", "10.1"],
];

/**
 * Sets up the regression panel's reactive cells -- one ordered row list (a
 * shape distinct enough from every other panel's that, like
 * SystemSolverPanel/StatisticsPanel/OdePanel/ImplicitPanel/ParametricPanel,
 * it gets its own small private CellGraph). Linear regression only for v1 --
 * `Statistics.linearRegression`/`correlation` already existed upstream and
 * were unused anywhere in the UI before this; a nonlinear (Levenberg-
 * Marquardt) fit is a later CAS-side addition (see the roadmap's Wave 4/5
 * split), not needed to expose what's already built.
 */
function useRegressionGraph(cellId: string): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    const ids = cellIdsRegression(cellId);
    if (!graph.has(ids.rows)) {
      const rows: RegressionRow[] = DEFAULT_ROW_VALUES.map(([x, y]) => ({ id: crypto.randomUUID(), x, y }));
      graph.set(ids.rows, rows);

      graph.define(ids.fit, (): FitResult => {
        try {
          const currentRows = graph.get<RegressionRow[]>(ids.rows);
          const points = currentRows
            .filter((row) => row.x.trim() !== "" || row.y.trim() !== "")
            .map((row) => ({ x: Number(row.x), y: Number(row.y) }));
          if (points.length < 2) throw new Error("Enter at least two (x, y) rows.");
          if (points.some((p) => Number.isNaN(p.x) || Number.isNaN(p.y))) {
            throw new Error("Every row needs both x and y filled in as numbers.");
          }
          const xVec = new Vector<number>(...points.map((p) => p.x));
          const yVec = new Vector<number>(...points.map((p) => p.y));
          const [slope, intercept] = Statistics.linearRegression(xVec, yVec);
          const r = Statistics.correlation(xVec, yVec);
          return { ok: true, slope: slope as number, intercept: intercept as number, r, points };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });
    }
    ref.current = graph;
  }
  return ref.current;
}

export interface RegressionPanelProps {
  cellId?: string;
}

/** v1: linear regression (y = slope*x + intercept) over a spreadsheet-style (x, y) row list, plotted as a scatter + fit line. */
export function RegressionPanel({ cellId = "regression-1" }: RegressionPanelProps = {}) {
  const graph = useRegressionGraph(cellId);
  const ids = cellIdsRegression(cellId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rows = useCell<RegressionRow[]>(graph, ids.rows);
  const fit = useCell<FitResult>(graph, ids.fit);

  const viewport: Viewport = fit.ok ? autoViewport(fit.points) : { xMin: -1, xMax: 10, yMin: -1, yMax: 10 };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (!fit.ok) return;
    drawScatter(ctx, fit.points, viewport, WIDTH, HEIGHT);
    const line = GraphUtils.vectorToCurve(
      Vector.fromArray([
        Vector.fromArray([viewport.xMin, fit.slope * viewport.xMin + fit.intercept]),
        Vector.fromArray([viewport.xMax, fit.slope * viewport.xMax + fit.intercept]),
      ]),
      2,
      0xdc2626,
    );
    drawPath(ctx, line, viewport, WIDTH, HEIGHT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);

  function updateCell(rowId: string, field: "x" | "y", value: string) {
    graph.set(
      ids.rows,
      rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    graph.set(ids.rows, [...rows, { id: crypto.randomUUID(), x: "", y: "" }]);
  }

  function removeRow(rowId: string) {
    graph.set(
      ids.rows,
      rows.filter((row) => row.id !== rowId),
    );
  }

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={headerCellStyle}>x</th>
              <th style={headerCellStyle}>y</th>
              <th style={headerCellStyle} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={dataCellStyle}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={row.x}
                    onChange={(e) => updateCell(row.id, "x", e.target.value)}
                    style={{ font: "inherit", width: "8ch", maxWidth: "100%" }}
                  />
                </td>
                <td style={dataCellStyle}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={row.y}
                    onChange={(e) => updateCell(row.id, "y", e.target.value)}
                    style={{ font: "inherit", width: "8ch", maxWidth: "100%" }}
                  />
                </td>
                <td style={dataCellStyle}>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    aria-label="Remove row"
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} style={{ margin: "0.5rem 0" }}>
        + Add row
      </button>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ border: "1px solid #ccc" }} />
      {fit.ok ? (
        <p>
          y = {fit.slope.toFixed(4)}x + {fit.intercept.toFixed(4)} (r = {fit.r.toFixed(4)}, r² = {(fit.r * fit.r).toFixed(4)})
        </p>
      ) : (
        <p style={{ color: "crimson" }}>{fit.message}</p>
      )}
    </div>
  );
}

const headerCellStyle: CSSProperties = { textAlign: "left", padding: "0.15rem 0.6rem", borderBottom: "1px solid #ccc", fontWeight: 600 };
const dataCellStyle: CSSProperties = { padding: "0.15rem 0.6rem" };

function autoViewport(points: { x: number; y: number }[]): Viewport {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xPad = (xMax - xMin || 1) * 0.15;
  const yPad = (yMax - yMin || 1) * 0.15;
  return { xMin: xMin - xPad, xMax: xMax + xPad, yMin: yMin - yPad, yMax: yMax + yPad };
}
