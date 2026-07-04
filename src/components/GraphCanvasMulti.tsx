import type { Path2D } from "mallory-math";
import { useServerFn } from "@tanstack/react-start";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsMultiRow, EXPRESSION_LIST_CELL, VIEWPORT_CELL } from "../lib/cell-ids.ts";
import {
  DEFAULT_MULTI_GRAPH_STATE,
  decodeMultiGraphState,
  encodeMultiGraphState,
  type MultiGraphAnnotation,
  type MultiGraphState,
} from "../lib/multi-graph-state.ts";
import { drawExpressionLayer, drawScatter, type Viewport } from "../lib/render-path.ts";
import { saveGraph } from "../lib/saved-graphs.ts";
import { canvasEventPoint, toDataX, toDataY, toScreenX, toScreenY } from "../lib/viewport.ts";
import { ExpressionRow } from "./ExpressionRow.tsx";
import { useCell } from "../lib/use-cell.ts";

const WIDTH = 600;
const HEIGHT = 600;
const ANNOTATION_HIT_RADIUS_PX = 10;

// Not namespaced by any row id -- one shared annotation list per view,
// mirroring EXPRESSION_LIST_CELL's own "one shared, unnamespaced list" shape.
const ANNOTATIONS_CELL = "annotations";

// Cycled by index (mod length) as rows are added -- not meant to be a large
// or exhaustive palette, just enough that a handful of curves stay visually
// distinguishable before a user reaches for the color picker themselves.
const PALETTE = [0x2563eb, 0xdc2626, 0x16a34a, 0xd97706, 0x9333ea, 0x0891b2];

/** Builds the full serializable state of a multi-graph -- shared by the URL-sync effect and the save-to-gallery handler. */
function getCurrentMultiGraphState(graph: CellGraph): MultiGraphState {
  const rowIds = graph.get<string[]>(EXPRESSION_LIST_CELL);
  const rows = rowIds.map((id) => {
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
  return {
    v: 1,
    rows,
    viewport: graph.get<Viewport>(VIEWPORT_CELL),
    annotations: graph.get<MultiGraphAnnotation[]>(ANNOTATIONS_CELL),
  };
}

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
    graph.set(ANNOTATIONS_CELL, state.annotations ?? [], { auxiliary: true });
    ref.current = graph;
  }
  return ref.current;
}

export function GraphCanvasMulti() {
  const graph = useMultiGraph();
  const rowIds = useCell<string[]>(graph, EXPRESSION_LIST_CELL);
  const annotations = useCell<MultiGraphAnnotation[]>(graph, ANNOTATIONS_CELL);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const draggingAnnotationId = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const saveGraphFn = useServerFn(saveGraph);

  async function handleSave() {
    const title = window.prompt("Title for this saved graph:", "Untitled");
    if (title === null) return;
    setSaveStatus("Saving…");
    try {
      await saveGraphFn({ data: { title, state: getCurrentMultiGraphState(graph) } });
      setSaveStatus(`Saved as "${title || "Untitled"}" — see the gallery to reopen it.`);
    } catch (e) {
      setSaveStatus(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

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

  function canvasToDataCoords(e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const viewport = graph.get<Viewport>(VIEWPORT_CELL);
    const { sx, sy } = canvasEventPoint(e, e.currentTarget, WIDTH, HEIGHT);
    return {
      x: toDataX(sx, viewport, WIDTH),
      y: toDataY(sy, viewport, HEIGHT),
    };
  }

  /** Nearest annotation within a fixed pixel hit radius, or null if none is close enough. */
  function hitTestAnnotation(x: number, y: number): MultiGraphAnnotation | null {
    const viewport = graph.get<Viewport>(VIEWPORT_CELL);
    const hitDataRadius = (ANNOTATION_HIT_RADIUS_PX / WIDTH) * (viewport.xMax - viewport.xMin);
    let closest: MultiGraphAnnotation | null = null;
    let bestDist = hitDataRadius;
    for (const a of annotations) {
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < bestDist) {
        bestDist = d;
        closest = a;
      }
    }
    return closest;
  }

  function handleCanvasPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const { x, y } = canvasToDataCoords(e);
    if (annotating) {
      const label = window.prompt("Label this point:", `Note ${annotations.length + 1}`);
      if (label === null) return; // cancelled
      graph.set(ANNOTATIONS_CELL, [...annotations, { id: crypto.randomUUID(), x, y, label }]);
      setAnnotating(false);
      return;
    }
    const hit = hitTestAnnotation(x, y);
    if (hit) {
      setSelectedAnnotationId(hit.id);
      draggingAnnotationId.current = hit.id;
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      setSelectedAnnotationId(null);
    }
  }

  function handleCanvasPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const id = draggingAnnotationId.current;
    if (!id) return;
    const { x, y } = canvasToDataCoords(e);
    graph.set(
      ANNOTATIONS_CELL,
      annotations.map((a) => (a.id === id ? { ...a, x, y } : a)),
    );
  }

  function handleCanvasPointerUp() {
    draggingAnnotationId.current = null;
  }

  function updateAnnotationLabel(id: string, label: string) {
    graph.set(
      ANNOTATIONS_CELL,
      annotations.map((a) => (a.id === id ? { ...a, label } : a)),
    );
  }

  function removeAnnotation(id: string) {
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
    graph.set(
      ANNOTATIONS_CELL,
      graph.get<MultiGraphAnnotation[]>(ANNOTATIONS_CELL).filter((a) => a.id !== id),
    );
  }

  // "Jump to" a point/range annotation (Open MCT-inspired, per the research
  // roadmap): re-centers the shared viewport on the annotation, keeping its
  // current width/height -- v1 has no pan/zoom UI, so this is the one way
  // the viewport ever moves, but it's real: every curve visibly recenters,
  // since all rows already read VIEWPORT_CELL.
  function jumpToAnnotation(a: MultiGraphAnnotation) {
    const current = graph.get<Viewport>(VIEWPORT_CELL);
    const halfWidth = (current.xMax - current.xMin) / 2;
    const halfHeight = (current.yMax - current.yMin) / 2;
    graph.set(VIEWPORT_CELL, {
      xMin: a.x - halfWidth,
      xMax: a.x + halfWidth,
      yMin: a.y - halfHeight,
      yMax: a.y + halfHeight,
    });
  }

  // Mirrors GraphCanvas's own writeUrl/subscribeAll pattern: keeps the URL
  // hash live-updated with the full row list + viewport, so reload restores
  // the session and "fork" (above) is just opening the current URL anew.
  useEffect(() => {
    function writeUrl() {
      window.history.replaceState(null, "", `#${encodeMultiGraphState(getCurrentMultiGraphState(graph))}`);
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
      for (const a of graph.get<MultiGraphAnnotation[]>(ANNOTATIONS_CELL)) {
        const selected = a.id === selectedAnnotationId;
        const sx = toScreenX(a.x, viewport, WIDTH);
        const sy = toScreenY(a.y, viewport, HEIGHT);
        ctx.save();
        ctx.fillStyle = selected ? "#dc2626" : "#b8752e";
        ctx.beginPath();
        ctx.arc(sx, sy, selected ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        if (selected) {
          ctx.strokeStyle = "#dc2626";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.font = selected ? "bold 12px sans-serif" : "12px sans-serif";
        ctx.fillStyle = selected ? "#dc2626" : "#142033";
        ctx.fillText(a.label, sx + 8, sy - 8);
        ctx.restore();
      }
    }
    redraw();
    return graph.subscribeAll(redraw);
    // selectedAnnotationId isn't graph state, so it can't trigger a redraw via
    // subscribeAll -- re-running this effect (which calls redraw() once
    // immediately) on selection change is what keeps the highlight in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, selectedAnnotationId]);

  return (
    <div>
      {rowIds.map((id) => (
        <ExpressionRow key={id} graph={graph} rowId={id} onRemove={rowIds.length > 1 ? () => removeRow(id) : undefined} />
      ))}
      <div style={{ margin: "0.5rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={addRow}>
          + Add expression
        </button>
        <button type="button" onClick={forkView} title="Open this exact view in a new tab to explore an alternate path">
          Fork this view
        </button>
        <button
          type="button"
          onClick={() => setAnnotating((a) => !a)}
          style={annotating ? { background: "#b8752e", color: "white" } : undefined}
        >
          {annotating ? "Click the canvas to place a note…" : "+ Annotate"}
        </button>
        <button type="button" onClick={handleSave}>
          Save to gallery
        </button>
      </div>
      {saveStatus && <p style={{ fontSize: "0.85rem", color: "#5b6b8c" }}>{saveStatus}</p>}
      <div>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{
            border: "1px solid #ccc",
            cursor: annotating ? "crosshair" : selectedAnnotationId ? "move" : "default",
            touchAction: "none",
          }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        />
      </div>
      {annotations.length > 0 && (
        <div style={{ margin: "0.5rem 0" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Annotations</div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {annotations.map((a) => {
              const selected = a.id === selectedAnnotationId;
              return (
                <li key={a.id} style={{ margin: "0.15rem 0", background: selected ? "#fef2f2" : undefined }}>
                  {selected ? (
                    <input
                      // biome-ignore lint: autoFocus is intentional here -- selecting an annotation should let you rename it immediately
                      autoFocus
                      value={a.label}
                      onChange={(e) => updateAnnotationLabel(a.id, e.target.value)}
                      style={{ font: "inherit", fontWeight: 600, width: "14ch" }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedAnnotationId(a.id)}
                      style={{ font: "inherit", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      title="Select (then drag its marker on the canvas to move it, or edit its label here)"
                    >
                      {a.label}
                    </button>
                  )}{" "}
                  ({a.x.toFixed(2)}, {a.y.toFixed(2)}){" "}
                  <button type="button" onClick={() => jumpToAnnotation(a)}>
                    Jump
                  </button>{" "}
                  <button type="button" onClick={() => removeAnnotation(a.id)}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <p style={{ fontSize: "0.78rem", color: "#5b6b8c" }}>
            Click a marker or its label above to select it — drag a selected marker on the canvas to move it, or edit
            its label in the list.
          </p>
        </div>
      )}
    </div>
  );
}
