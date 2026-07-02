import type { Path2D } from "mallory-ts";
import { useEffect, useRef, useState } from "react";
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

/**
 * Sets up the reactive graph once (source expr cell -> derived sampled-path
 * cell). PATH_CELL falls back to the last successfully sampled path on a
 * parse/eval error, so a mid-typing invalid expression (e.g. "2x sin(")
 * leaves the last good curve on screen instead of blanking the canvas.
 */
function useExpressionGraph(source: string, viewport: Viewport): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    graph.set(EXPR_CELL, source);
    let lastGoodPath: Path2D | null = null;
    graph.define(PATH_CELL, () => {
      try {
        lastGoodPath = sampleExpr(graph.get<string>(EXPR_CELL), { min: viewport.xMin, max: viewport.xMax }, RESOLUTION);
      } catch {
        if (!lastGoodPath) throw new Error(`Initial expression "${source}" failed to parse`);
      }
      return lastGoodPath;
    });
    ref.current = graph;
  }
  return ref.current;
}

export function GraphCanvas() {
  const viewport = DEFAULT_GRAPH_STATE.viewport;
  const graph = useExpressionGraph(DEFAULT_GRAPH_STATE.cells[0].source, viewport);
  const path = useCell<Path2D>(graph, PATH_CELL);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState(DEFAULT_GRAPH_STATE.cells[0].source);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawPath(ctx, path, viewport, WIDTH, HEIGHT);
  }, [path, viewport]);

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
      <div>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ border: "1px solid #ccc" }} />
      </div>
    </div>
  );
}
