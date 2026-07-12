import type { Path2D } from "mallory-math";
import { useEffect, useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsOdeSystem } from "../lib/cell-ids.ts";
import { drawPath, drawPoint, drawVectorField, type Viewport } from "../lib/render-path.ts";
import {
  odeSystemTrajectoryToPhasePath,
  sampleOdeSystem2D,
  sampleVectorField2D,
  type OdeSystemSpec,
  type VectorFieldPoint,
} from "../lib/sample-ode.ts";
import { useCellGraphTools } from "../hooks/use-cell-graph-tools.ts";
import { useCell } from "../lib/use-cell.ts";

type TrajectoryResult = { ok: true; path: Path2D; final: { t: number; x: number; y: number } } | { ok: false; message: string };
type VectorFieldResult = { ok: true; points: VectorFieldPoint[] } | { ok: false; message: string };

const WIDTH = 500;
const HEIGHT = 500;

// A normalized predator-prey pair (dx/dt = x(1-y), dy/dt = y(x-1)) -- a
// classic closed-orbit phase portrait, a more illustrative default than an
// uncoupled pair for a feature whose whole point is the coupling.
const DEFAULTS = {
  exprX: "x*(1-y)",
  exprY: "y*(x-1)",
  t0: "0",
  x0: "2",
  y0: "1",
  tMin: "0",
  tMax: "15",
  xMin: "0",
  xMax: "3",
  yMin: "0",
  yMax: "3",
};

/**
 * Sets up the ODE-system panel's reactive cells on its own private
 * CellGraph -- two coupled expressions plus an initial condition, a
 * t-domain, and a phase-plane viewport, yet another shape distinct from
 * every other panel's, so (like OdePanel/SystemSolverPanel) it isn't woven
 * into `cellIds`/`useExpressionGraph`.
 */
function useOdeSystemGraph(cellId: string): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    const ids = cellIdsOdeSystem(cellId);
    if (!graph.has(ids.exprX)) {
      graph.set(ids.exprX, DEFAULTS.exprX);
      graph.set(ids.exprY, DEFAULTS.exprY);
      graph.set(ids.t0, DEFAULTS.t0);
      graph.set(ids.x0, DEFAULTS.x0);
      graph.set(ids.y0, DEFAULTS.y0);
      graph.set(ids.tMin, DEFAULTS.tMin);
      graph.set(ids.tMax, DEFAULTS.tMax);
      graph.set(ids.xMin, DEFAULTS.xMin);
      graph.set(ids.xMax, DEFAULTS.xMax);
      graph.set(ids.yMin, DEFAULTS.yMin);
      graph.set(ids.yMax, DEFAULTS.yMax);

      const spec = (): OdeSystemSpec => ({
        stateVars: ["x", "y"],
        independentVar: "t",
        derivatives: [graph.get<string>(ids.exprX), graph.get<string>(ids.exprY)],
      });

      graph.define(ids.trajectory, (): TrajectoryResult => {
        try {
          const t0 = Number(graph.get<string>(ids.t0));
          const x0 = Number(graph.get<string>(ids.x0));
          const y0 = Number(graph.get<string>(ids.y0));
          const tMin = Number(graph.get<string>(ids.tMin));
          const tMax = Number(graph.get<string>(ids.tMax));
          if ([t0, x0, y0, tMin, tMax].some(Number.isNaN)) throw new Error("Every field must be a number.");
          if (tMin >= tMax) throw new Error("t-min must be less than t-max.");
          const trajectory = sampleOdeSystem2D(spec(), { t0, state0: [x0, y0] }, { min: tMin, max: tMax });
          const path = odeSystemTrajectoryToPhasePath(trajectory);
          const last = trajectory[trajectory.length - 1];
          return { ok: true, path, final: last ? { t: last.t, x: last.state[0], y: last.state[1] } : { t: t0, x: x0, y: y0 } };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });

      graph.define(ids.vectorField, (): VectorFieldResult => {
        try {
          const xMin = Number(graph.get<string>(ids.xMin));
          const xMax = Number(graph.get<string>(ids.xMax));
          const yMin = Number(graph.get<string>(ids.yMin));
          const yMax = Number(graph.get<string>(ids.yMax));
          const t0 = Number(graph.get<string>(ids.t0));
          if ([xMin, xMax, yMin, yMax].some(Number.isNaN)) throw new Error("Every field must be a number.");
          if (xMin >= xMax || yMin >= yMax) throw new Error("min must be less than max for both x and y.");
          return { ok: true, points: sampleVectorField2D(spec(), { min: xMin, max: xMax }, { min: yMin, max: yMax }, t0) };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });
    }
    ref.current = graph;
  }
  return ref.current;
}

export interface OdeSystemPanelProps {
  cellId?: string;
}

/**
 * v1: a fixed 2-equation/2-variable coupled first-order system
 * dx/dt = f(x,y,t), dy/dt = g(x,y,t) -- the same "fixed at 2" scope cut
 * SystemSolverPanel already made for algebraic systems -- rendered as a
 * phase portrait (one trajectory from a single initial condition, overlaid
 * on a direction field sampled at t0). No animation/dragging, no
 * multi-trajectory overlay.
 */
export function OdeSystemPanel({ cellId = "ode-system-1" }: OdeSystemPanelProps = {}) {
  const graph = useOdeSystemGraph(cellId);
  useCellGraphTools("calculus_ode_system", graph);
  const ids = cellIdsOdeSystem(cellId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const exprX = useCell<string>(graph, ids.exprX);
  const exprY = useCell<string>(graph, ids.exprY);
  const t0 = useCell<string>(graph, ids.t0);
  const x0 = useCell<string>(graph, ids.x0);
  const y0 = useCell<string>(graph, ids.y0);
  const tMin = useCell<string>(graph, ids.tMin);
  const tMax = useCell<string>(graph, ids.tMax);
  const xMin = useCell<string>(graph, ids.xMin);
  const xMax = useCell<string>(graph, ids.xMax);
  const yMin = useCell<string>(graph, ids.yMin);
  const yMax = useCell<string>(graph, ids.yMax);
  const trajectory = useCell<TrajectoryResult>(graph, ids.trajectory);
  const vectorField = useCell<VectorFieldResult>(graph, ids.vectorField);

  const [exprXInput, setExprXInput] = useState(exprX);
  const [exprYInput, setExprYInput] = useState(exprY);

  function updateExprX(value: string) {
    setExprXInput(value);
    graph.set(ids.exprX, value);
  }
  function updateExprY(value: string) {
    setExprYInput(value);
    graph.set(ids.exprY, value);
  }

  const viewport: Viewport = {
    xMin: Number(xMin) || 0,
    xMax: Number(xMax) || 3,
    yMin: Number(yMin) || 0,
    yMax: Number(yMax) || 3,
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (vectorField.ok) drawVectorField(ctx, vectorField.points, viewport, WIDTH, HEIGHT);
    if (trajectory.ok) {
      drawPath(ctx, trajectory.path, viewport, WIDTH, HEIGHT);
      drawPoint(ctx, { x: Number(x0), y: Number(y0) }, viewport, WIDTH, HEIGHT, 5, "#dc2626");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajectory, vectorField, xMin, xMax, yMin, yMax, x0, y0]);

  return (
    <div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          dx/dt ={" "}
          <input value={exprXInput} onChange={(e) => updateExprX(e.target.value)} style={{ font: "inherit", width: "16ch" }} />
        </label>
      </div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          dy/dt ={" "}
          <input value={exprYInput} onChange={(e) => updateExprY(e.target.value)} style={{ font: "inherit", width: "16ch" }} />
        </label>
      </div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          at t ={" "}
          <input value={t0} onChange={(e) => graph.set(ids.t0, e.target.value)} style={{ font: "inherit", width: "6ch" }} />: x ={" "}
          <input value={x0} onChange={(e) => graph.set(ids.x0, e.target.value)} style={{ font: "inherit", width: "6ch" }} />, y ={" "}
          <input value={y0} onChange={(e) => graph.set(ids.y0, e.target.value)} style={{ font: "inherit", width: "6ch" }} />
        </label>
      </div>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          t: [<input value={tMin} onChange={(e) => graph.set(ids.tMin, e.target.value)} style={{ font: "inherit", width: "6ch" }} />,{" "}
          <input value={tMax} onChange={(e) => graph.set(ids.tMax, e.target.value)} style={{ font: "inherit", width: "6ch" }} />]
        </label>
      </div>
      <div style={{ margin: "0.25rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <label>
          x: [<input value={xMin} onChange={(e) => graph.set(ids.xMin, e.target.value)} style={{ font: "inherit", width: "6ch" }} />,{" "}
          <input value={xMax} onChange={(e) => graph.set(ids.xMax, e.target.value)} style={{ font: "inherit", width: "6ch" }} />]
        </label>
        <label>
          y: [<input value={yMin} onChange={(e) => graph.set(ids.yMin, e.target.value)} style={{ font: "inherit", width: "6ch" }} />,{" "}
          <input value={yMax} onChange={(e) => graph.set(ids.yMax, e.target.value)} style={{ font: "inherit", width: "6ch" }} />]
        </label>
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ border: "1px solid #ccc" }} />
      {trajectory.ok && (
        <p>
          at t = {trajectory.final.t.toFixed(4)}: x = {trajectory.final.x.toFixed(4)}, y = {trajectory.final.y.toFixed(4)}
        </p>
      )}
      {(!trajectory.ok || !vectorField.ok) && (
        <p style={{ color: "crimson" }}>{!trajectory.ok ? trajectory.message : !vectorField.ok ? vectorField.message : ""}</p>
      )}
    </div>
  );
}
