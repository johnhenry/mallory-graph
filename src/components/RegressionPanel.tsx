import { GraphUtils, Numerical, Statistics, Symbolic, Vector } from "mallory-math";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsRegression } from "../lib/cell-ids.ts";
import { collectFreeVars } from "../lib/free-vars.ts";
import { preprocessImplicitMultiplication } from "../lib/implicit-mult.ts";
import { drawPath, drawScatter, type Viewport } from "../lib/render-path.ts";
import { useCell } from "../lib/use-cell.ts";

const WIDTH = 500;
const HEIGHT = 500;
const CURVE_SAMPLES = 200;

interface RegressionRow {
  id: string;
  x: string;
  y: string;
}

type FitType = "linear" | "nonlinear";

type FitResult =
  | { ok: true; kind: "linear"; slope: number; intercept: number; r: number; points: { x: number; y: number }[] }
  | {
      ok: true;
      kind: "nonlinear";
      paramOrder: string[];
      params: Record<string, number>;
      residualNorm: number;
      points: { x: number; y: number }[];
    }
  | { ok: false; message: string };

const DEFAULT_ROW_VALUES: Array<[string, string]> = [
  ["1", "2.1"],
  ["2", "3.9"],
  ["3", "6.2"],
  ["4", "7.8"],
  ["5", "10.1"],
];

const DEFAULT_MODEL_EXPR = "a*exp(b*x)";

/** Free variables of `modelText` besides `x` -- the nonlinear model's fit parameters. Empty (not thrown) on a mid-typing parse error. */
function modelParams(modelText: string): string[] {
  try {
    return collectFreeVars(Symbolic.parse(preprocessImplicitMultiplication(modelText)), "x");
  } catch {
    return [];
  }
}

/**
 * Sets up the regression panel's reactive cells -- one ordered row list (a
 * shape distinct enough from every other panel's that, like
 * SystemSolverPanel/StatisticsPanel/OdePanel/ImplicitPanel/ParametricPanel,
 * it gets its own small private CellGraph), plus a fit-type toggle between
 * `Statistics.linearRegression`/`correlation` (already existed upstream,
 * unused anywhere in the UI before this) and `Numerical.levenbergMarquardt`
 * for an arbitrary user-supplied nonlinear model.
 */
function useRegressionGraph(cellId: string): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    const ids = cellIdsRegression(cellId);
    if (!graph.has(ids.rows)) {
      const rows: RegressionRow[] = DEFAULT_ROW_VALUES.map(([x, y]) => ({ id: crypto.randomUUID(), x, y }));
      graph.set(ids.rows, rows);
      graph.set(ids.fitType, "linear" as FitType);
      graph.set(ids.modelExpr, DEFAULT_MODEL_EXPR);
      graph.set(ids.paramGuesses, { a: "1", b: "0.1" } as Record<string, string>);

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

          const fitType = graph.get<FitType>(ids.fitType);
          if (fitType === "linear") {
            const xVec = new Vector<number>(...points.map((p) => p.x));
            const yVec = new Vector<number>(...points.map((p) => p.y));
            const [slope, intercept] = Statistics.linearRegression(xVec, yVec);
            const r = Statistics.correlation(xVec, yVec);
            return { ok: true, kind: "linear", slope: slope as number, intercept: intercept as number, r, points };
          }

          const modelText = graph.get<string>(ids.modelExpr);
          const parsed = Symbolic.parse(preprocessImplicitMultiplication(modelText));
          const paramOrder = collectFreeVars(parsed, "x");
          if (paramOrder.length === 0) throw new Error("Model must reference at least one parameter besides x.");
          const compiled = Symbolic.compile(parsed);
          const model = (x: number, p: number[]): number => {
            const env: Record<string, number> = { x };
            paramOrder.forEach((name, i) => {
              env[name] = p[i] as number;
            });
            return compiled(env);
          };
          const guesses = graph.get<Record<string, string>>(ids.paramGuesses);
          const params0 = paramOrder.map((name) => {
            const g = Number(guesses[name] ?? "1");
            return Number.isNaN(g) ? 1 : g;
          });
          const result = Numerical.levenbergMarquardt(
            model,
            params0,
            points.map((p) => p.x),
            points.map((p) => p.y),
          );
          if (!result.converged) {
            throw new Error(
              `Fit did not converge (residual norm ${result.residualNorm.toFixed(4)}) -- try different initial guesses.`,
            );
          }
          const params: Record<string, number> = {};
          paramOrder.forEach((name, i) => {
            params[name] = result.params[i] as number;
          });
          return { ok: true, kind: "nonlinear", paramOrder, params, residualNorm: result.residualNorm, points };
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

/** Linear regression (least squares) or a nonlinear (Levenberg-Marquardt) fit to a custom model, over a spreadsheet-style (x, y) row list. */
export function RegressionPanel({ cellId = "regression-1" }: RegressionPanelProps = {}) {
  const graph = useRegressionGraph(cellId);
  const ids = cellIdsRegression(cellId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rows = useCell<RegressionRow[]>(graph, ids.rows);
  const fitType = useCell<FitType>(graph, ids.fitType);
  const modelExpr = useCell<string>(graph, ids.modelExpr);
  const paramGuesses = useCell<Record<string, string>>(graph, ids.paramGuesses);
  const fit = useCell<FitResult>(graph, ids.fit);

  const [modelExprInput, setModelExprInput] = useState(modelExpr);

  const viewport: Viewport = fit.ok ? autoViewport(fit.points) : { xMin: -1, xMax: 10, yMin: -1, yMax: 10 };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (!fit.ok) return;
    drawScatter(ctx, fit.points, viewport, WIDTH, HEIGHT);
    let curvePoints: Vector<number>[];
    if (fit.kind === "linear") {
      curvePoints = [
        Vector.fromArray([viewport.xMin, fit.slope * viewport.xMin + fit.intercept]),
        Vector.fromArray([viewport.xMax, fit.slope * viewport.xMax + fit.intercept]),
      ];
    } else {
      const compiled = Symbolic.compile(preprocessImplicitMultiplication(modelExpr));
      curvePoints = [];
      for (let i = 0; i < CURVE_SAMPLES; i++) {
        const x = viewport.xMin + (i / (CURVE_SAMPLES - 1)) * (viewport.xMax - viewport.xMin);
        const y = compiled({ x, ...fit.params });
        if (Number.isFinite(y)) curvePoints.push(Vector.fromArray([x, y]));
      }
    }
    if (curvePoints.length > 1) {
      const line = GraphUtils.vectorToCurve(Vector.fromArray(curvePoints), 2, 0xdc2626);
      drawPath(ctx, line, viewport, WIDTH, HEIGHT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, modelExpr]);

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

  function updateModelExpr(value: string) {
    setModelExprInput(value);
    graph.set(ids.modelExpr, value);
  }

  function updateGuess(name: string, value: string) {
    graph.set(ids.paramGuesses, { ...paramGuesses, [name]: value });
  }

  const currentParams = modelParams(modelExprInput);

  return (
    <div>
      <div style={{ margin: "0.25rem 0", display: "flex", gap: "1rem" }}>
        <label>
          <input
            type="radio"
            checked={fitType === "linear"}
            onChange={() => graph.set(ids.fitType, "linear" as FitType)}
          />{" "}
          Linear
        </label>
        <label>
          <input
            type="radio"
            checked={fitType === "nonlinear"}
            onChange={() => graph.set(ids.fitType, "nonlinear" as FitType)}
          />{" "}
          Nonlinear (custom model)
        </label>
      </div>
      {fitType === "nonlinear" && (
        <div style={{ margin: "0.25rem 0" }}>
          <label>
            y ={" "}
            <input
              value={modelExprInput}
              onChange={(e) => updateModelExpr(e.target.value)}
              style={{ font: "inherit", width: "18ch" }}
            />
          </label>{" "}
          {currentParams.map((name) => (
            <label key={name} style={{ marginLeft: "0.5rem" }}>
              {name}₀ ={" "}
              <input
                value={paramGuesses[name] ?? "1"}
                onChange={(e) => updateGuess(name, e.target.value)}
                style={{ font: "inherit", width: "5ch" }}
              />
            </label>
          ))}
        </div>
      )}
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
        fit.kind === "linear" ? (
          <p>
            y = {fit.slope.toFixed(4)}x + {fit.intercept.toFixed(4)} (r = {fit.r.toFixed(4)}, r² ={" "}
            {(fit.r * fit.r).toFixed(4)})
          </p>
        ) : (
          <p>
            {fit.paramOrder.map((name, i) => (
              <span key={name}>
                {i > 0 ? ", " : ""}
                {name} = {(fit.params[name] as number).toFixed(4)}
              </span>
            ))}{" "}
            (residual norm = {fit.residualNorm.toFixed(6)})
          </p>
        )
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
