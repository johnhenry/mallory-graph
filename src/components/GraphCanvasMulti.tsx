import type { Path2D } from "mallory-math";
import { useEffect, useRef } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsMultiRow, EXPRESSION_LIST_CELL, VIEWPORT_CELL } from "../lib/cell-ids.ts";
import {
  DEFAULT_MULTI_GRAPH_STATE,
  decodeMultiGraphState,
  encodeMultiGraphState,
  type MultiGraphState,
} from "../lib/multi-graph-state.ts";
import { drawExpressionLayer, drawScatter, type Viewport } from "../lib/render-path.ts";
import { ExpressionRow } from "./ExpressionRow.tsx";
import { useCell } from "../lib/use-cell.ts";

const WIDTH = 600;
const HEIGHT = 600;

// Cycled by index (mod length) as rows are added -- not meant to be a large
// or exhaustive palette, just enough that a handful of curves stay visually
// distinguishable before a user reaches for the color picker themselves.
const PALETTE = [0x2563eb, 0xdc2626, 0x16a34a, 0xd97706, 0x9333ea, 0x0891b2];

function seedRow(
  graph: CellGraph,
  rowId: string,
  source: string,
  color: number,
  visible: boolean,
  params: Record<string, number> = {},
): void {
  const ids = cellIdsMultiRow(rowId);
  graph.set(ids.expr, source);
  graph.set(ids.color, color);
  graph.set(ids.visible, visible);
  for (const [name, value] of Object.entries(params)) graph.set(ids.param(name), value);
}

/**
 * One shared CellGraph, one shared VIEWPORT_CELL, and an ordered
 * EXPRESSION_LIST_CELL of row ids -- each row's own cells (see
 * ExpressionRow.tsx's `useRowCells`) read the shared viewport, so panning it
 * would move every curve at once (v1 has no pan/zoom UI yet, but the wiring
 * already supports it -- see the Wave 2 design's shared-conductor framing).
 * This is the actual "multiple curves, one graph" capability that
 * GraphCanvas/LinkedGraphPanes don't have: LinkedGraphPanes shares one
 * CellGraph too, but each pane still owns its own separate `<canvas>` and
 * viewport.
 *
 * Hydrates from the URL hash (multi-graph-state.ts) when present, the same
 * "no server round-trip" convention GraphCanvas's own single-pane state
 * uses -- which also makes "fork this view" (see `forkView` below) trivial:
 * since the current state is always live in the URL, opening that same URL
 * in a new tab *is* the fork.
 */
function useMultiGraph(): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    const decoded = typeof window !== "undefined" ? decodeMultiGraphState(window.location.hash.slice(1)) : null;
    const state = decoded ?? DEFAULT_MULTI_GRAPH_STATE;
    graph.set(VIEWPORT_CELL, state.viewport, { auxiliary: true });
    const initialIds = state.rows.map(() => crypto.randomUUID());
    initialIds.forEach((id, i) => {
      const row = state.rows[i] as MultiGraphState["rows"][number];
      seedRow(graph, id, row.source, row.color, row.visible, row.params);
    });
    graph.set(EXPRESSION_LIST_CELL, initialIds, { auxiliary: true });
    ref.current = graph;
  }
  return ref.current;
}

export function GraphCanvasMulti() {
  const graph = useMultiGraph();
  const rowIds = useCell<string[]>(graph, EXPRESSION_LIST_CELL);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function addRow() {
    const id = crypto.randomUUID();
    const current = graph.get<string[]>(EXPRESSION_LIST_CELL);
    seedRow(graph, id, "x", PALETTE[current.length % PALETTE.length] as number, true);
    graph.set(EXPRESSION_LIST_CELL, [...current, id]);
  }

  function removeRow(id: string) {
    graph.set(
      EXPRESSION_LIST_CELL,
      graph.get<string[]>(EXPRESSION_LIST_CELL).filter((existing) => existing !== id),
    );
  }

  function forkView() {
    window.open(window.location.href, "_blank");
  }

  // Mirrors GraphCanvas's own writeUrl/subscribeAll pattern: keeps the URL
  // hash live-updated with the full row list + viewport, so reload restores
  // the session and "fork" (above) is just opening the current URL anew.
  useEffect(() => {
    function writeUrl() {
      const rowIds2 = graph.get<string[]>(EXPRESSION_LIST_CELL);
      const rows = rowIds2.map((id) => {
        const ids = cellIdsMultiRow(id);
        const freeVars = graph.hasValue(ids.freeVars) ? graph.get<string[]>(ids.freeVars) : [];
        const params: Record<string, number> = {};
        for (const name of freeVars) params[name] = graph.get<number>(ids.param(name));
        return {
          source: graph.get<string>(ids.expr),
          color: graph.get<number>(ids.color),
          visible: graph.get<boolean>(ids.visible),
          params,
        };
      });
      const state: MultiGraphState = { v: 1, rows, viewport: graph.get<Viewport>(VIEWPORT_CELL) };
      window.history.replaceState(null, "", `#${encodeMultiGraphState(state)}`);
    }
    writeUrl();
    return graph.subscribeAll(writeUrl);
  }, [graph]);

  // Redraws whenever the row list changes, or any individual row's own
  // cells do -- graph.subscribeAll rather than per-row useCell hooks, since
  // the *set* of rows to draw changes as much as any one row's path/color/
  // visibility does, and a fixed hook-per-row list can't track a dynamic
  // row count anyway (React's rules of hooks require a static hook list).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    function redraw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      const viewport = graph.get<Viewport>(VIEWPORT_CELL);
      for (const id of graph.get<string[]>(EXPRESSION_LIST_CELL)) {
        const ids = cellIdsMultiRow(id);
        try {
          const path = graph.get<Path2D>(ids.path);
          const visible = graph.get<boolean>(ids.visible);
          drawExpressionLayer(ctx, path, visible, viewport, WIDTH, HEIGHT);
          if (visible) {
            const roots = graph.get<{ x: number; y: number }[]>(ids.roots);
            if (roots.length > 0) drawScatter(ctx, roots, viewport, WIDTH, HEIGHT, 4, "#142033");
          }
        } catch {
          // A row whose cells haven't been registered yet (ExpressionRow
          // hasn't mounted this render pass) -- skip it this frame, it'll
          // draw on the next redraw once mounted.
        }
      }
    }
    redraw();
    return graph.subscribeAll(redraw);
  }, [graph]);

  return (
    <div>
      {rowIds.map((id) => (
        <ExpressionRow key={id} graph={graph} rowId={id} onRemove={rowIds.length > 1 ? () => removeRow(id) : undefined} />
      ))}
      <div style={{ margin: "0.5rem 0", display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={addRow}>
          + Add expression
        </button>
        <button type="button" onClick={forkView} title="Open this exact view in a new tab to explore an alternate path">
          Fork this view
        </button>
      </div>
      <div>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ border: "1px solid #ccc" }} />
      </div>
    </div>
  );
}
