import { GraphUtils, Statistics, Vector } from "mallory-math";
import { useEffect, useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsRegression } from "../lib/cell-ids.ts";
import { drawPath, drawScatter, type Viewport } from "../lib/render-path.ts";
import { useCell } from "../lib/use-cell.ts";

const WIDTH = 500;
const HEIGHT = 500;

type FitResult =
  | { ok: true; slope: number; intercept: number; r: number; points: { x: number; y: number }[] }
  | { ok: false; message: string };

const DEFAULTS = { xData: "1, 2, 3, 4, 5", yData: "2.1, 3.9, 6.2, 7.8, 10.1" };

function parseNumbers(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

/**
 * Sets up the regression panel's reactive cells -- two parallel data lists,
 * a shape distinct enough from every other panel's that (like
 * SystemSolverPanel/StatisticsPanel/OdePanel/ImplicitPanel/ParametricPanel)
 * it gets its own small private CellGraph. Linear regression only for v1 --
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
    if (!graph.has(ids.xData)) {
      graph.set(ids.xData, DEFAULTS.xData);
      graph.set(ids.yData, DEFAULTS.yData);

      graph.define(ids.fit, (): FitResult => {
        try {
          const xs = parseNumbers(graph.get<string>(ids.xData));
          const ys = parseNumbers(graph.get<string>(ids.yData));
          if (xs.length < 2 || ys.length < 2) throw new Error("Enter at least two (x, y) pairs.");
          if (xs.length !== ys.length) throw new Error(`x has ${xs.length} values but y has ${ys.length} -- they must match.`);
          if ([...xs, ...ys].some(Number.isNaN)) throw new Error("Every entry must be a number.");
          const xVec = new Vector<number>(...xs);
          const yVec = new Vector<number>(...ys);
          const [slope, intercept] = Statistics.linearRegression(xVec, yVec);
          const r = Statistics.correlation(xVec, yVec);
          return {
            ok: true,
            slope: slope as number,
            intercept: intercept as number,
            r,
            points: xs.map((x, i) => ({ x, y: ys[i] as number })),
          };
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

/** v1: linear regression (y = slope*x + intercept) over a pasted (x, y) data set, plotted as a scatter + fit line. */
export function RegressionPanel({ cellId = "regression-1" }: RegressionPanelProps = {}) {
  const graph = useRegressionGraph(cellId);
  const ids = cellIdsRegression(cellId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const xData = useCell<string>(graph, ids.xData);
  const yData = useCell<string>(graph, ids.yData);
  const fit = useCell<FitResult>(graph, ids.fit);
  const [xInput, setXInput] = useState(xData);
  const [yInput, setYInput] = useState(yData);

  const viewport: Viewport = fit.ok
    ? autoViewport(fit.points)
    : { xMin: -1, xMax: 10, yMin: -1, yMax: 10 };

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

  function updateX(value: string) {
    setXInput(value);
    graph.set(ids.xData, value);
  }
  function updateY(value: string) {
    setYInput(value);
    graph.set(ids.yData, value);
  }

  return (
    <div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          x data:{" "}
          <input value={xInput} onChange={(e) => updateX(e.target.value)} style={{ font: "inherit", width: "40ch" }} />
        </label>
      </div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          y data:{" "}
          <input value={yInput} onChange={(e) => updateY(e.target.value)} style={{ font: "inherit", width: "40ch" }} />
        </label>
      </div>
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
