import { Symbolic } from "mallory-math";
import { useEffect, useRef, useState } from "react";
import type { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsMultiRow, VIEWPORT_CELL } from "../lib/cell-ids.ts";
import { collectFreeVars, defaultSliderRange } from "../lib/free-vars.ts";
import { preprocessImplicitMultiplication } from "../lib/implicit-mult.ts";
import type { Viewport } from "../lib/render-path.ts";
import { sampleExpr } from "../lib/sample-function.ts";
import { useCell } from "../lib/use-cell.ts";

const RESOLUTION = 400;
const AXIS_VARIABLE = "x";

/**
 * Sets up one row's reactive cells: expr -> freeVars -> per-variable slider
 * params -> a path sampled against the shared VIEWPORT_CELL, colored per the
 * row's own color cell. A much smaller cell family than single-pane
 * GraphCanvas's `useExpressionGraph` -- see `cellIdsMultiRow`'s doc comment
 * for what's deliberately not ported here yet (point-drag, exact mode,
 * derivative steps, area/region shading, finite-structure scatter).
 *
 * Guarded by `!graph.has(ids.path)` (not just the mount ref) so mounting a
 * second ExpressionRow pointed at an already-populated row id is a safe
 * no-op, matching `useExpressionGraph`'s own convention in GraphCanvas.tsx.
 */
function useRowCells(graph: CellGraph, rowId: string): ReturnType<typeof cellIdsMultiRow> {
  const ids = cellIdsMultiRow(rowId);
  const ref = useRef(false);
  if (!ref.current) {
    ref.current = true;
    if (!graph.has(ids.path)) {
      graph.define(
        ids.freeVars,
        () => {
          try {
            const expr = Symbolic.parse(preprocessImplicitMultiplication(graph.get<string>(ids.expr)));
            return collectFreeVars(expr, AXIS_VARIABLE);
          } catch {
            return [];
          }
        },
        { auxiliary: true },
      );

      graph.define(
        ids.params,
        () => {
          const names = graph.get<string[]>(ids.freeVars);
          const params: Record<string, number> = {};
          for (const name of names) params[name] = graph.get<number>(ids.param(name));
          return params;
        },
        { auxiliary: true },
      );

      let lastGoodPath: ReturnType<typeof sampleExpr> | null = null;
      graph.define(
        ids.path,
        () => {
          try {
            const viewport = graph.get<Viewport>(VIEWPORT_CELL);
            const params = graph.get<Record<string, number>>(ids.params);
            const color = graph.get<number>(ids.color);
            lastGoodPath = sampleExpr(
              graph.get<string>(ids.expr),
              { min: viewport.xMin, max: viewport.xMax },
              RESOLUTION,
              AXIS_VARIABLE,
              params,
              color,
            );
          } catch {
            if (!lastGoodPath) throw new Error(`Row "${rowId}" initial expression failed to parse`);
          }
          return lastGoodPath;
        },
        { auxiliary: true },
      );
    }
  }
  return ids;
}

export interface ExpressionRowProps {
  graph: CellGraph;
  rowId: string;
  onRemove?: () => void;
}

/** One row of a GraphCanvasMulti: a color swatch, a visibility toggle, the y= input, and any free-variable sliders it discovers. */
export function ExpressionRow({ graph, rowId, onRemove }: ExpressionRowProps) {
  const ids = useRowCells(graph, rowId);
  const expr = useCell<string>(graph, ids.expr);
  const color = useCell<number>(graph, ids.color);
  const visible = useCell<boolean>(graph, ids.visible);
  const freeVars = useCell<string[]>(graph, ids.freeVars);
  const [exprInput, setExprInput] = useState(expr);

  // Same reasoning as GraphCanvas's own slider-seeding effect: freeVars is
  // read synchronously during render via useCell, so seeding a newly
  // discovered variable's slider cell must happen in an effect, not inline,
  // or the write trips React's "Cannot update a component while rendering a
  // different component" guard and silently gets dropped.
  useEffect(() => {
    for (const name of freeVars) {
      const id = ids.param(name);
      if (!graph.hasValue(id)) graph.set(id, defaultSliderRange(name).default);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, freeVars, rowId]);

  function updateExpr(value: string) {
    setExprInput(value);
    graph.set(ids.expr, value);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", margin: "0.25rem 0" }}>
      <input
        type="checkbox"
        checked={visible}
        onChange={(e) => graph.set(ids.visible, e.target.checked)}
        title="Show/hide this curve"
      />
      <input
        type="color"
        value={`#${color.toString(16).padStart(6, "0")}`}
        onChange={(e) => graph.set(ids.color, Number.parseInt(e.target.value.slice(1), 16))}
      />
      <label>
        y ={" "}
        <input value={exprInput} onChange={(e) => updateExpr(e.target.value)} style={{ font: "inherit", width: "18ch" }} />
      </label>
      {freeVars.map((name) => (
        <ParamSlider key={name} graph={graph} paramId={ids.param(name)} name={name} />
      ))}
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove this expression">
          ✕
        </button>
      )}
    </div>
  );
}

function ParamSlider({ graph, paramId, name }: { graph: CellGraph; paramId: string; name: string }) {
  const range = defaultSliderRange(name);
  const value = useCell<number>(graph, paramId) ?? range.default;
  return (
    <label style={{ fontSize: "0.85rem" }}>
      {name} ={" "}
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => graph.set(paramId, Number(e.target.value))}
      />{" "}
      {value.toFixed(2)}
    </label>
  );
}
