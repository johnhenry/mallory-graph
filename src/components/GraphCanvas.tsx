import type { Path2D } from "mallory-ts";
import { useEffect, useRef } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { DEFAULT_GRAPH_STATE } from "../lib/graph-state.ts";
import { drawPath, type Viewport } from "../lib/render-path.ts";
import { sampleExpr } from "../lib/sample-function.ts";
import { useCell } from "../lib/use-cell.ts";

const WIDTH = 600;
const HEIGHT = 600;
const RESOLUTION = 400;
const CELL_ID = DEFAULT_GRAPH_STATE.cells[0].id;
const EXPR_CELL = `expr:${CELL_ID}`;
const PATH_CELL = `path:${CELL_ID}`;

/** Sets up the reactive graph once (source expr cell -> derived sampled-path cell). */
function useExpressionGraph(source: string, viewport: Viewport): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    graph.set(EXPR_CELL, source);
    graph.define(PATH_CELL, () => sampleExpr(graph.get<string>(EXPR_CELL), { min: viewport.xMin, max: viewport.xMax }, RESOLUTION));
    ref.current = graph;
  }
  return ref.current;
}

export function GraphCanvas() {
  const viewport = DEFAULT_GRAPH_STATE.viewport;
  const graph = useExpressionGraph(DEFAULT_GRAPH_STATE.cells[0].source, viewport);
  const path = useCell<Path2D>(graph, PATH_CELL);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawPath(ctx, path, viewport, WIDTH, HEIGHT);
  }, [path, viewport]);

  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ border: "1px solid #ccc" }} />;
}
