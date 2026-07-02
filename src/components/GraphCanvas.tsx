import { Symbolic, type Path2D } from "mallory-ts";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { collectFreeVars, defaultSliderRange } from "../lib/free-vars.ts";
import { DEFAULT_GRAPH_STATE } from "../lib/graph-state.ts";
import { preprocessImplicitMultiplication } from "../lib/implicit-mult.ts";
import { drawPath, drawPoint, type Viewport } from "../lib/render-path.ts";
import { sampleExpr } from "../lib/sample-function.ts";
import { useCell } from "../lib/use-cell.ts";
import { toDataX, toScreenX, toScreenY } from "../lib/viewport.ts";

const WIDTH = 600;
const HEIGHT = 600;
const RESOLUTION = 400;
const AXIS_VARIABLE = "x";
const HANDLE_HIT_RADIUS = 12;
const CELL_ID = DEFAULT_GRAPH_STATE.cells[0].id;
const EXPR_CELL = `expr:${CELL_ID}`;
const FREE_VARS_CELL = `freeVars:${CELL_ID}`;
const PARAMS_CELL = `params:${CELL_ID}`;
const PATH_CELL = `path:${CELL_ID}`;
const POINT_X_CELL = `pointX:${CELL_ID}`;
const POINT_CELL = `point:${CELL_ID}`;
const paramCellId = (name: string) => `param:${CELL_ID}:${name}`;

interface CurvePoint {
  x: number;
  y: number;
}

/**
 * Sets up the reactive graph once: source expr cell -> free-var list ->
 * per-variable slider cells (seeded lazily, so re-parsing on every keystroke
 * doesn't clobber a value the user already dragged) -> params snapshot ->
 * derived sampled-path cell. PATH_CELL falls back to the last successfully
 * sampled path on a parse/eval error, so a mid-typing invalid expression
 * (e.g. "2x sin(") leaves the last good curve on screen instead of blanking
 * the canvas.
 */
function useExpressionGraph(source: string, viewport: Viewport): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    graph.set(EXPR_CELL, source);

    graph.define(FREE_VARS_CELL, () => {
      let names: string[] = [];
      try {
        const expr = Symbolic.parse(preprocessImplicitMultiplication(graph.get<string>(EXPR_CELL)));
        names = collectFreeVars(expr, AXIS_VARIABLE);
      } catch {
        // Leave `names` empty on a mid-typing parse error; sliders just don't update.
      }
      for (const name of names) {
        const id = paramCellId(name);
        if (!graph.has(id)) graph.set(id, defaultSliderRange(name).default);
      }
      return names;
    });

    graph.define(PARAMS_CELL, () => {
      const names = graph.get<string[]>(FREE_VARS_CELL);
      const params: Record<string, number> = {};
      for (const name of names) params[name] = graph.get<number>(paramCellId(name));
      return params;
    });

    let lastGoodPath: Path2D | null = null;
    graph.define(PATH_CELL, () => {
      try {
        const params = graph.get<Record<string, number>>(PARAMS_CELL);
        lastGoodPath = sampleExpr(
          graph.get<string>(EXPR_CELL),
          { min: viewport.xMin, max: viewport.xMax },
          RESOLUTION,
          AXIS_VARIABLE,
          params,
        );
      } catch {
        if (!lastGoodPath) throw new Error(`Initial expression "${source}" failed to parse`);
      }
      return lastGoodPath;
    });

    graph.set(POINT_X_CELL, (viewport.xMin + viewport.xMax) / 2);

    // A handle dragged along the curve: x follows the pointer, y is
    // re-derived from the current expression/params, so it stays
    // curve-constrained through any edit or slider drag.
    let lastGoodPoint: CurvePoint | null = null;
    graph.define(POINT_CELL, () => {
      try {
        const x = graph.get<number>(POINT_X_CELL);
        const params = graph.get<Record<string, number>>(PARAMS_CELL);
        const compiled = Symbolic.compile(preprocessImplicitMultiplication(graph.get<string>(EXPR_CELL)));
        lastGoodPoint = { x, y: compiled({ ...params, [AXIS_VARIABLE]: x }) };
      } catch {
        // Leave the handle at its last good position on a mid-typing parse error.
      }
      return lastGoodPoint;
    });

    ref.current = graph;
  }
  return ref.current;
}

export function GraphCanvas() {
  const viewport = DEFAULT_GRAPH_STATE.viewport;
  const graph = useExpressionGraph(DEFAULT_GRAPH_STATE.cells[0].source, viewport);
  const path = useCell<Path2D>(graph, PATH_CELL);
  const point = useCell<CurvePoint | null>(graph, POINT_CELL);
  const freeVars = useCell<string[]>(graph, FREE_VARS_CELL);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);
  const [source, setSource] = useState(DEFAULT_GRAPH_STATE.cells[0].source);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawPath(ctx, path, viewport, WIDTH, HEIGHT);
    if (point) drawPoint(ctx, point, viewport, WIDTH, HEIGHT);
  }, [path, point, viewport]);

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!point) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const handleSx = toScreenX(point.x, viewport, WIDTH);
    const handleSy = toScreenY(point.y, viewport, HEIGHT);
    if (Math.hypot(sx - handleSx, sy - handleSy) > HANDLE_HIT_RADIUS) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const x = Math.min(viewport.xMax, Math.max(viewport.xMin, toDataX(sx, viewport, WIDTH)));
    graph.set(POINT_X_CELL, x);
  }

  function handlePointerUp(e: PointerEvent<HTMLCanvasElement>) {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div>
      <label>
        y ={" "}
        <input
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            graph.set(EXPR_CELL, e.target.value);
          }}
          style={{ font: "inherit", width: "20ch" }}
        />
      </label>
      {freeVars.length > 0 && (
        <div style={{ display: "flex", gap: "1rem", margin: "0.5rem 0" }}>
          {freeVars.map((name) => (
            <SliderControl key={name} graph={graph} name={name} />
          ))}
        </div>
      )}
      <div>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ border: "1px solid #ccc", touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
    </div>
  );
}

function SliderControl({ graph, name }: { graph: CellGraph; name: string }) {
  const id = paramCellId(name);
  const value = useCell<number>(graph, id);
  const range = defaultSliderRange(name);
  return (
    <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
      {name} = {value.toFixed(2)}
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => graph.set(id, Number(e.target.value))}
      />
    </label>
  );
}
