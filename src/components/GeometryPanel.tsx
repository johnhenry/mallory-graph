import { type PointerEvent, useEffect, useRef, useState } from "react";
import { AlgebraView } from "./AlgebraView.tsx";
import { CellGraph } from "../lib/cell-graph.ts";
import { canvasEventPoint, toDataX, toDataY, toScreenX, toScreenY, type Viewport } from "../lib/viewport.ts";

const WIDTH = 500;
const HEIGHT = 500;
const VIEWPORT: Viewport = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const HIT_RADIUS_PX = 14;
// Below this, a Line/Circle's defining points are close enough to be
// considered coincident -- a degenerate construction (zero length/radius)
// flagged in a warning color, the same declarative "condition read off the
// object's own dependent cell, decoupled from drawing" pattern
// findRootCrossings/findDiscontinuities use for curves. Deliberately much
// looser than an exact-zero check: a mouse/touch drag can realistically land
// within a few hundredths of a data unit of another point (at this
// viewport/canvas scale, ~2-3 screen pixels) but essentially never closer
// than 1e-6, so that threshold would never fire for a real user.
const DEGENERATE_EPSILON = 0.05;
const DEGENERATE_COLOR = "#d97706";

// Not namespaced by any cellId -- this is a single-instance panel, unlike
// GraphCanvasMulti's rows.
const OBJECT_LIST_CELL = "geomObjects";
const pointCellId = (id: string) => `geomPoint:${id}`;
const lineCellId = (id: string) => `geomLine:${id}`;
const circleCellId = (id: string) => `geomCircle:${id}`;
const lengthCellId = (id: string) => `geomLength:${id}`;
const radiusCellId = (id: string) => `geomRadius:${id}`;

interface PointRecord {
  x: number;
  y: number;
}
interface LineRecord {
  a: string;
  b: string;
}
interface CircleRecord {
  center: string;
  radiusPoint: string;
}

type Tool = "point" | "line" | "circle" | "reflect" | "rotate" | "translate";

/**
 * v1 GeoGebra-style construction tools built directly on Wave 1's free/
 * dependent object model: a point is a free `PointRecord` cell created by
 * clicking with the Point tool; a Line/Circle is a free record naming which
 * two point ids it connects, plus a genuinely dependent companion cell (its
 * length/radius) that reads those points' current coordinates. Reflect/
 * Rotate/Translate go one step further: each produces a new *point* that is
 * itself a dependent cell (under the same `pointCellId` namespace a free
 * point uses, so it draws/selects identically and can feed further
 * construction), reading its source point(s) live -- dragging a free point
 * cascades through every line/circle/transform built from it, for free.
 */
function useGeometryGraph(): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    graph.set(OBJECT_LIST_CELL, [] as string[], { auxiliary: true });
    ref.current = graph;
  }
  return ref.current;
}

function pushObject(graph: CellGraph, id: string): void {
  graph.set(OBJECT_LIST_CELL, [...graph.get<string[]>(OBJECT_LIST_CELL), id], { auxiliary: true });
}

/** Nearest point within `maxDistance`, optionally restricted to free (draggable) points -- a dependent/transformed point is still a valid line/circle/transform endpoint, just not draggable itself. */
function nearestPointId(graph: CellGraph, x: number, y: number, maxDistance: number, freeOnly = false): string | null {
  let best: string | null = null;
  let bestDist = maxDistance;
  for (const id of graph.get<string[]>(OBJECT_LIST_CELL)) {
    if (!graph.has(pointCellId(id))) continue;
    if (freeOnly && graph.role(pointCellId(id)) !== "free") continue;
    const p = graph.get<PointRecord>(pointCellId(id));
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

export function GeometryPanel() {
  const graph = useGeometryGraph();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("point");
  const [pending, setPending] = useState<string | null>(null);
  const [angleInput, setAngleInput] = useState("90");
  const [dxInput, setDxInput] = useState("1");
  const [dyInput, setDyInput] = useState("0");
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  function addPoint(x: number, y: number): string {
    const id = crypto.randomUUID();
    graph.set(pointCellId(id), { x, y });
    pushObject(graph, id);
    return id;
  }

  function addLine(a: string, b: string): void {
    const id = crypto.randomUUID();
    graph.set(lineCellId(id), { a, b });
    graph.define(lengthCellId(id), () => {
      const pa = graph.get<PointRecord>(pointCellId(a));
      const pb = graph.get<PointRecord>(pointCellId(b));
      return Math.hypot(pa.x - pb.x, pa.y - pb.y);
    });
    pushObject(graph, id);
  }

  function addCircle(center: string, radiusPoint: string): void {
    const id = crypto.randomUUID();
    graph.set(circleCellId(id), { center, radiusPoint });
    graph.define(radiusCellId(id), () => {
      const pc = graph.get<PointRecord>(pointCellId(center));
      const pr = graph.get<PointRecord>(pointCellId(radiusPoint));
      return Math.hypot(pc.x - pr.x, pc.y - pr.y);
    });
    pushObject(graph, id);
  }

  /** Point reflection: the new point is as far past `center` as `source` is before it. */
  function addReflection(source: string, center: string): void {
    const id = crypto.randomUUID();
    graph.define(pointCellId(id), (): PointRecord => {
      const s = graph.get<PointRecord>(pointCellId(source));
      const c = graph.get<PointRecord>(pointCellId(center));
      return { x: 2 * c.x - s.x, y: 2 * c.y - s.y };
    });
    pushObject(graph, id);
  }

  /** Rotates `source` around `center` by a fixed angle, captured at construction time (the source/center dependency stays live; the angle itself does not). */
  function addRotation(source: string, center: string, angleDegrees: number): void {
    const id = crypto.randomUUID();
    const theta = (angleDegrees * Math.PI) / 180;
    graph.define(pointCellId(id), (): PointRecord => {
      const s = graph.get<PointRecord>(pointCellId(source));
      const c = graph.get<PointRecord>(pointCellId(center));
      const dx = s.x - c.x;
      const dy = s.y - c.y;
      return {
        x: c.x + dx * Math.cos(theta) - dy * Math.sin(theta),
        y: c.y + dx * Math.sin(theta) + dy * Math.cos(theta),
      };
    });
    pushObject(graph, id);
  }

  /** Translates `source` by a fixed (dx, dy), captured at construction time -- the source dependency stays live. */
  function addTranslation(source: string, dx: number, dy: number): void {
    const id = crypto.randomUUID();
    graph.define(pointCellId(id), (): PointRecord => {
      const s = graph.get<PointRecord>(pointCellId(source));
      return { x: s.x + dx, y: s.y + dy };
    });
    pushObject(graph, id);
  }

  function dataCoordsFromEvent(e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const { sx, sy } = canvasEventPoint(e, e.currentTarget, WIDTH, HEIGHT);
    return { x: toDataX(sx, VIEWPORT, WIDTH), y: toDataY(sy, VIEWPORT, HEIGHT) };
  }

  /** A plain (no-drag) click landing on an existing point -- free or dependent. */
  function handlePointClick(hitId: string) {
    if (tool === "point") return; // clicking an existing point with the Point tool is a no-op; drag it instead
    if (tool === "translate") {
      addTranslation(hitId, Number(dxInput) || 0, Number(dyInput) || 0);
      return;
    }
    if (!pending) {
      setPending(hitId);
      return;
    }
    if (pending === hitId) {
      setPending(null); // clicked the same point twice -- cancel the pending selection
      return;
    }
    if (tool === "line") addLine(pending, hitId);
    else if (tool === "circle") addCircle(pending, hitId);
    else if (tool === "reflect") addReflection(pending, hitId);
    else if (tool === "rotate") addRotation(pending, hitId, Number(angleInput) || 90);
    setPending(null);
  }

  function handleEmptyClick(x: number, y: number) {
    if (tool === "point") addPoint(x, y);
    // line/circle/reflect/rotate/translate only connect existing points -- clicking empty space is a no-op
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const { x, y } = dataCoordsFromEvent(e);
    const hitDataRadius = (HIT_RADIUS_PX / WIDTH) * (VIEWPORT.xMax - VIEWPORT.xMin);
    const freeHit = nearestPointId(graph, x, y, hitDataRadius, true);
    if (freeHit) {
      dragRef.current = { id: freeHit, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.moved = true;
    const { x, y } = dataCoordsFromEvent(e);
    graph.set(pointCellId(drag.id), { x, y });
  }

  function handlePointerUp(e: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (!drag.moved) handlePointClick(drag.id);
      return;
    }
    const { x, y } = dataCoordsFromEvent(e);
    const hitDataRadius = (HIT_RADIUS_PX / WIDTH) * (VIEWPORT.xMax - VIEWPORT.xMin);
    const hit = nearestPointId(graph, x, y, hitDataRadius);
    if (hit) handlePointClick(hit);
    else handleEmptyClick(x, y);
  }

  // graph.subscribeAll (not the OBJECT_LIST_CELL/pending values as a
  // dependency array) is what makes a dragged point's dependents (lines,
  // circles, reflect/rotate/translate results) visibly redraw -- the one
  // real gap this panel had: every cell already recomputed correctly on a
  // drag, but nothing had told the canvas to repaint. Matches
  // GraphCanvasMulti's identical redraw pattern.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    function redraw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      for (const id of graph.get<string[]>(OBJECT_LIST_CELL)) {
        if (graph.has(pointCellId(id))) {
          const p = graph.get<PointRecord>(pointCellId(id));
          const isFree = graph.role(pointCellId(id)) === "free";
          const color = id === pending ? "#dc2626" : isFree ? "#2563eb" : "#5b6b8c";
          drawDot(ctx, p.x, p.y, color);
        } else if (graph.has(lineCellId(id))) {
          const { a, b } = graph.get<LineRecord>(lineCellId(id));
          const pa = graph.get<PointRecord>(pointCellId(a));
          const pb = graph.get<PointRecord>(pointCellId(b));
          // Reads (not just draws) the dependent length cell -- a lazily-
          // defined cell only reports hasValue:true, and so only appears in
          // AlgebraView's Objects list, once something actually calls
          // get() on it. Nothing else ever did.
          const length = graph.get<number>(lengthCellId(id));
          drawLine(ctx, pa, pb, length < DEGENERATE_EPSILON);
        } else if (graph.has(circleCellId(id))) {
          const { center, radiusPoint } = graph.get<CircleRecord>(circleCellId(id));
          const pc = graph.get<PointRecord>(pointCellId(center));
          // Same reasoning as the line's length above -- reuse the
          // dependent radius cell's own value instead of recomputing it
          // inline, which also makes it appear in the Objects list.
          const radius = graph.get<number>(radiusCellId(id));
          drawCircle(ctx, pc, radius, radius < DEGENERATE_EPSILON);
        }
      }
    }
    redraw();
    return graph.subscribeAll(redraw);
    // `pending` isn't graph state, so it can't trigger a redraw via
    // subscribeAll -- re-running this effect (which calls redraw() once
    // immediately) on selection change is what keeps the highlight in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, pending]);

  const hint =
    tool === "point"
      ? "Click empty space to place a point, or drag an existing one."
      : tool === "translate"
        ? "Click a point to translate it by (dx, dy)."
        : pending
          ? `Click the ${tool === "line" ? "second" : tool === "circle" ? "radius" : "reference"} point (highlighted point selected).`
          : `Click a point to start a ${tool}.`;

  return (
    <div>
      <div style={{ margin: "0.25rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(["point", "line", "circle", "reflect", "rotate", "translate"] as const).map((t) => (
          <label key={t}>
            <input
              type="radio"
              checked={tool === t}
              onChange={() => {
                setTool(t);
                setPending(null);
              }}
            />{" "}
            {t}
          </label>
        ))}
        {tool === "rotate" && (
          <label>
            angle (°):{" "}
            <input value={angleInput} onChange={(e) => setAngleInput(e.target.value)} style={{ font: "inherit", width: "5ch" }} />
          </label>
        )}
        {tool === "translate" && (
          <>
            <label>
              dx: <input value={dxInput} onChange={(e) => setDxInput(e.target.value)} style={{ font: "inherit", width: "5ch" }} />
            </label>
            <label>
              dy: <input value={dyInput} onChange={(e) => setDyInput(e.target.value)} style={{ font: "inherit", width: "5ch" }} />
            </label>
          </>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ border: "1px solid #ccc", cursor: "crosshair", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <p style={{ fontSize: "0.85rem", color: "#5b6b8c" }}>{hint}</p>
      <div style={{ margin: "0.5rem 0" }}>
        <AlgebraView graph={graph} />
      </div>
    </div>
  );
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const sx = toScreenX(x, VIEWPORT, WIDTH);
  const sy = toScreenY(y, VIEWPORT, HEIGHT);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, a: PointRecord, b: PointRecord, degenerate = false): void {
  ctx.save();
  ctx.strokeStyle = degenerate ? DEGENERATE_COLOR : "#142033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(toScreenX(a.x, VIEWPORT, WIDTH), toScreenY(a.y, VIEWPORT, HEIGHT));
  ctx.lineTo(toScreenX(b.x, VIEWPORT, WIDTH), toScreenY(b.y, VIEWPORT, HEIGHT));
  ctx.stroke();
  ctx.restore();
}

function drawCircle(ctx: CanvasRenderingContext2D, center: PointRecord, radius: number, degenerate = false): void {
  const sx = toScreenX(center.x, VIEWPORT, WIDTH);
  const sy = toScreenY(center.y, VIEWPORT, HEIGHT);
  const screenRadius = (radius / (VIEWPORT.xMax - VIEWPORT.xMin)) * WIDTH;
  ctx.save();
  ctx.strokeStyle = degenerate ? DEGENERATE_COLOR : "#16a34a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
