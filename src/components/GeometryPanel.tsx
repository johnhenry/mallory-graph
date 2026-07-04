import { type MouseEvent, useEffect, useRef, useState } from "react";
import { AlgebraView } from "./AlgebraView.tsx";
import { CellGraph } from "../lib/cell-graph.ts";
import { canvasEventPoint, toDataX, toDataY, toScreenX, toScreenY, type Viewport } from "../lib/viewport.ts";
import { useCell } from "../lib/use-cell.ts";

const WIDTH = 500;
const HEIGHT = 500;
const VIEWPORT: Viewport = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const HIT_RADIUS_PX = 14;

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

type Tool = "point" | "line" | "circle";

/**
 * v1 GeoGebra-style construction tools built directly on Wave 1's free/
 * dependent object model: a point is a free `PointRecord` cell created by
 * clicking with the Point tool; a Line/Circle is a free record naming which
 * two point ids it connects, *plus* a genuinely dependent companion cell
 * (its length/radius) that reads those points' current coordinates --
 * demonstrating the actual cascading-recompute mechanism Wave 1 added, even
 * though v1 has no point-dragging yet to make the cascade user-visible.
 * Once dragging is added (a later extension), every length/radius here
 * updates for free, with no change to this file.
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

function nearestPointId(graph: CellGraph, x: number, y: number, maxDistance: number): string | null {
  let best: string | null = null;
  let bestDist = maxDistance;
  for (const id of graph.get<string[]>(OBJECT_LIST_CELL)) {
    if (!graph.has(pointCellId(id))) continue;
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
  const objectIds = useCell<string[]>(graph, OBJECT_LIST_CELL);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("point");
  const [pending, setPending] = useState<string | null>(null);

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

  function handleClick(e: MouseEvent<HTMLCanvasElement>) {
    const { sx, sy } = canvasEventPoint(e, e.currentTarget, WIDTH, HEIGHT);
    const x = toDataX(sx, VIEWPORT, WIDTH);
    const y = toDataY(sy, VIEWPORT, HEIGHT);

    if (tool === "point") {
      addPoint(x, y);
      return;
    }

    const hitDataRadius = (HIT_RADIUS_PX / WIDTH) * (VIEWPORT.xMax - VIEWPORT.xMin);
    const hit = nearestPointId(graph, x, y, hitDataRadius);
    if (!hit) return; // line/circle tools only connect existing points -- clicking empty space is a no-op
    if (!pending) {
      setPending(hit);
      return;
    }
    if (pending === hit) {
      setPending(null); // clicked the same point twice -- cancel the pending selection
      return;
    }
    if (tool === "line") addLine(pending, hit);
    else addCircle(pending, hit);
    setPending(null);
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const id of objectIds) {
      if (graph.has(pointCellId(id))) {
        const p = graph.get<PointRecord>(pointCellId(id));
        drawDot(ctx, p.x, p.y, id === pending ? "#dc2626" : "#2563eb");
      } else if (graph.has(lineCellId(id))) {
        const { a, b } = graph.get<LineRecord>(lineCellId(id));
        const pa = graph.get<PointRecord>(pointCellId(a));
        const pb = graph.get<PointRecord>(pointCellId(b));
        drawLine(ctx, pa, pb);
      } else if (graph.has(circleCellId(id))) {
        const { center, radiusPoint } = graph.get<CircleRecord>(circleCellId(id));
        const pc = graph.get<PointRecord>(pointCellId(center));
        const pr = graph.get<PointRecord>(pointCellId(radiusPoint));
        drawCircle(ctx, pc, Math.hypot(pc.x - pr.x, pc.y - pr.y));
      }
    }
  }, [graph, objectIds, pending]);

  return (
    <div>
      <div style={{ margin: "0.25rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(["point", "line", "circle"] as const).map((t) => (
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
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ border: "1px solid #ccc", cursor: "crosshair" }}
        onClick={handleClick}
      />
      <p style={{ fontSize: "0.85rem", color: "#5b6b8c" }}>
        {tool === "point"
          ? "Click the canvas to place a point."
          : pending
            ? `Click the ${tool === "line" ? "second" : "radius"} point (highlighted point selected).`
            : `Click a point to start a ${tool}.`}
      </p>
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

function drawLine(ctx: CanvasRenderingContext2D, a: PointRecord, b: PointRecord): void {
  ctx.save();
  ctx.strokeStyle = "#142033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(toScreenX(a.x, VIEWPORT, WIDTH), toScreenY(a.y, VIEWPORT, HEIGHT));
  ctx.lineTo(toScreenX(b.x, VIEWPORT, WIDTH), toScreenY(b.y, VIEWPORT, HEIGHT));
  ctx.stroke();
  ctx.restore();
}

function drawCircle(ctx: CanvasRenderingContext2D, center: PointRecord, radius: number): void {
  const sx = toScreenX(center.x, VIEWPORT, WIDTH);
  const sy = toScreenY(center.y, VIEWPORT, HEIGHT);
  const screenRadius = (radius / (VIEWPORT.xMax - VIEWPORT.xMin)) * WIDTH;
  ctx.save();
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
