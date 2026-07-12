import type { Path2D } from "mallory-math";
import { useEffect, useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { useServerFn } from "@tanstack/react-start";
import { cellIdsOde } from "../lib/cell-ids.ts";
import { startOdeExportJob } from "../lib/export-ode-video.ts";
import { VideoExportControls } from "./VideoExportControls.tsx";
import { drawPath, drawSlopeField, type Viewport } from "../lib/render-path.ts";
import { attemptOdeClosedForm, type OdeClosedFormAttempt, sampleOdeSolution, sampleSlopeField, type SlopeFieldPoint } from "../lib/sample-ode.ts";
import { useCellGraphTools } from "../hooks/use-cell-graph-tools.ts";
import { useCell } from "../lib/use-cell.ts";
import { CopyableTex } from "./CopyableTex.tsx";

type SolutionResult = { ok: true; path: Path2D } | { ok: false; message: string };
type SlopeFieldResult = { ok: true; points: SlopeFieldPoint[] } | { ok: false; message: string };

const WIDTH = 500;
const HEIGHT = 500;

const DEFAULTS = { expr: "x - y", x0: "0", y0: "1", xMin: "-5", xMax: "5", yMin: "-5", yMax: "5" };

/**
 * Sets up the ODE panel's reactive cells on its own private CellGraph -- an
 * f(x,y) expression plus an initial condition and a rectangular domain, a
 * different input shape from GraphCanvas's single expression + axis
 * variable, so (like SystemSolverPanel/StatisticsPanel) it isn't woven into
 * `cellIds`/`useExpressionGraph`.
 */
function useOdeGraph(cellId: string): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    const ids = cellIdsOde(cellId);
    if (!graph.has(ids.expr)) {
      graph.set(ids.expr, DEFAULTS.expr);
      graph.set(ids.x0, DEFAULTS.x0);
      graph.set(ids.y0, DEFAULTS.y0);
      graph.set(ids.xMin, DEFAULTS.xMin);
      graph.set(ids.xMax, DEFAULTS.xMax);
      graph.set(ids.yMin, DEFAULTS.yMin);
      graph.set(ids.yMax, DEFAULTS.yMax);

      const domain = () => ({
        xMin: Number(graph.get<string>(ids.xMin)),
        xMax: Number(graph.get<string>(ids.xMax)),
        yMin: Number(graph.get<string>(ids.yMin)),
        yMax: Number(graph.get<string>(ids.yMax)),
      });

      graph.define(ids.solution, (): SolutionResult => {
        try {
          const expr = graph.get<string>(ids.expr);
          const x0 = Number(graph.get<string>(ids.x0));
          const y0 = Number(graph.get<string>(ids.y0));
          const { xMin, xMax } = domain();
          if ([x0, y0, xMin, xMax].some(Number.isNaN)) throw new Error("Every field must be a number.");
          if (xMin >= xMax) throw new Error("x-min must be less than x-max.");
          const path = sampleOdeSolution(expr, x0, y0, { min: xMin, max: xMax });
          return { ok: true, path };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });

      graph.define(ids.slopeField, (): SlopeFieldResult => {
        try {
          const expr = graph.get<string>(ids.expr);
          const { xMin, xMax, yMin, yMax } = domain();
          if ([xMin, xMax, yMin, yMax].some(Number.isNaN)) throw new Error("Every field must be a number.");
          if (xMin >= xMax || yMin >= yMax) throw new Error("min must be less than max for both x and y.");
          return { ok: true, points: sampleSlopeField(expr, { min: xMin, max: xMax }, { min: yMin, max: yMax }) };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });

      graph.define(ids.closedForm, (): OdeClosedFormAttempt => {
        const expr = graph.get<string>(ids.expr);
        const x0 = Number(graph.get<string>(ids.x0));
        const y0 = Number(graph.get<string>(ids.y0));
        if ([x0, y0].some(Number.isNaN)) return { found: false };
        return attemptOdeClosedForm(expr, x0, y0);
      });
    }
    ref.current = graph;
  }
  return ref.current;
}

export interface OdePanelProps {
  cellId?: string;
}

/** v1: a single first-order IVP dy/dx = f(x,y), y(x0) = y0, plotted against its slope field. No animation/dragging. */
export function OdePanel({ cellId = "ode-1" }: OdePanelProps = {}) {
  const graph = useOdeGraph(cellId);
  useCellGraphTools("calculus_ode", graph);
  const ids = cellIdsOde(cellId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const expr = useCell<string>(graph, ids.expr);
  const x0 = useCell<string>(graph, ids.x0);
  const y0 = useCell<string>(graph, ids.y0);
  const xMin = useCell<string>(graph, ids.xMin);
  const xMax = useCell<string>(graph, ids.xMax);
  const yMin = useCell<string>(graph, ids.yMin);
  const yMax = useCell<string>(graph, ids.yMax);
  const solution = useCell<SolutionResult>(graph, ids.solution);
  const slopeField = useCell<SlopeFieldResult>(graph, ids.slopeField);
  const closedForm = useCell<OdeClosedFormAttempt>(graph, ids.closedForm);

  const [exprInput, setExprInput] = useState(expr);
  const startOdeExportJobFn = useServerFn(startOdeExportJob);

  function updateExpr(value: string) {
    setExprInput(value);
    graph.set(ids.expr, value);
  }

  const viewport: Viewport = {
    xMin: Number(xMin) || -5,
    xMax: Number(xMax) || 5,
    yMin: Number(yMin) || -5,
    yMax: Number(yMax) || 5,
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (slopeField.ok) drawSlopeField(ctx, slopeField.points, viewport, WIDTH, HEIGHT);
    if (solution.ok) drawPath(ctx, solution.path, viewport, WIDTH, HEIGHT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solution, slopeField, xMin, xMax, yMin, yMax]);

  return (
    <div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          dy/dx ={" "}
          <input value={exprInput} onChange={(e) => updateExpr(e.target.value)} style={{ font: "inherit", width: "20ch" }} />
        </label>
      </div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          y(
          <input value={x0} onChange={(e) => graph.set(ids.x0, e.target.value)} style={{ font: "inherit", width: "6ch" }} />
          ) ={" "}
          <input value={y0} onChange={(e) => graph.set(ids.y0, e.target.value)} style={{ font: "inherit", width: "6ch" }} />
        </label>
      </div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          x: [<input value={xMin} onChange={(e) => graph.set(ids.xMin, e.target.value)} style={{ font: "inherit", width: "6ch" }} />
          ,{" "}
          <input value={xMax} onChange={(e) => graph.set(ids.xMax, e.target.value)} style={{ font: "inherit", width: "6ch" }} />]
        </label>{" "}
        <label>
          y: [<input value={yMin} onChange={(e) => graph.set(ids.yMin, e.target.value)} style={{ font: "inherit", width: "6ch" }} />
          ,{" "}
          <input value={yMax} onChange={(e) => graph.set(ids.yMax, e.target.value)} style={{ font: "inherit", width: "6ch" }} />]
        </label>
      </div>
      {closedForm.found && (
        <p style={{ margin: "0.25rem 0" }}>
          Closed form: <CopyableTex tex={closedForm.explicit ? `y = ${closedForm.latex}` : `${closedForm.latex} = 0`} />
        </p>
      )}
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ border: "1px solid #ccc" }} />
      {(!solution.ok || !slopeField.ok) && (
        <p style={{ color: "crimson" }}>{!solution.ok ? solution.message : !slopeField.ok ? slopeField.message : ""}</p>
      )}
      {/* Server-side ecmanim export: the slope field as a vector field plus
          the RK4 solution progressively traced out from the initial
          condition (johnhenry/mallory-graph#3, pass 2). */}
      <VideoExportControls
        filenameStem="mallory-graph-ode"
        start={(format, duration) =>
          startOdeExportJobFn({
            data: {
              source: expr,
              x0: Number(x0) || 0,
              y0: Number(y0) || 0,
              viewport,
              duration,
              format,
            },
          })
        }
      />
    </div>
  );
}
