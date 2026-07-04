import type { Path2D } from "mallory-math";
import { useEffect, useRef } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsMultiRow, EXPRESSION_LIST_CELL, VIEWPORT_CELL } from "../lib/cell-ids.ts";
import { drawExpressionLayer, type Viewport } from "../lib/render-path.ts";
import { useCell } from "../lib/use-cell.ts";
import { ExpressionRow } from "./ExpressionRow.tsx";

const WIDTH = 400;
const HEIGHT = 400;
const DEFAULT_VIEWPORT: Viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
const PALETTE = [0x2563eb, 0xdc2626, 0x16a34a];

/**
 * A self-contained graph cell for the notebook surface (NotebookPanel.tsx):
 * its own private CellGraph, not the shared/URL-synced one GraphCanvasMulti
 * uses -- several independent notebook blocks on one page would otherwise
 * fight over window.location.hash. Reuses ExpressionRow/drawExpressionLayer
 * directly, the same reactive core as everywhere else in the app.
 *
 * NON-GOALS (v1): no URL persistence, fork, save, or annotations for an
 * individual block (a notebook *document* could still be saved as a whole
 * -- see NotebookPanel's own doc comment); no cross-block cell references
 * (a later block reading an earlier block's value), which is the actual
 * defining feature of an Observable-style notebook -- each block here is
 * fully independent.
 */
export function NotebookGraphBlock({ initialSource = "x" }: { initialSource?: string }) {
  const graphRef = useRef<CellGraph | null>(null);
  if (!graphRef.current) {
    const graph = new CellGraph();
    graph.set(VIEWPORT_CELL, DEFAULT_VIEWPORT, { auxiliary: true });
    const id = crypto.randomUUID();
    const ids = cellIdsMultiRow(id);
    graph.set(ids.expr, initialSource);
    graph.set(ids.color, PALETTE[0] as number);
    graph.set(ids.visible, true);
    graph.set(EXPRESSION_LIST_CELL, [id], { auxiliary: true });
    graphRef.current = graph;
  }
  const graph = graphRef.current;
  const rowIds = useCell<string[]>(graph, EXPRESSION_LIST_CELL);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function addRow() {
    const current = graph.get<string[]>(EXPRESSION_LIST_CELL);
    const id = crypto.randomUUID();
    const ids = cellIdsMultiRow(id);
    graph.set(ids.expr, "x");
    graph.set(ids.color, PALETTE[current.length % PALETTE.length] as number);
    graph.set(ids.visible, true);
    graph.set(EXPRESSION_LIST_CELL, [...current, id]);
  }

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
        } catch {
          // A row whose cells haven't registered yet -- skip this frame.
        }
      }
    }
    redraw();
    return graph.subscribeAll(redraw);
  }, [graph]);

  return (
    <div>
      {rowIds.map((id) => (
        <ExpressionRow key={id} graph={graph} rowId={id} />
      ))}
      <button type="button" onClick={addRow} style={{ fontSize: "0.8rem" }}>
        + Add expression
      </button>
      <div>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ border: "1px solid #ccc" }} />
      </div>
    </div>
  );
}
