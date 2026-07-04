import { useSyncExternalStore } from "react";
import type { CellGraph } from "../lib/cell-graph.ts";

function formatValue(value: unknown): string {
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(4).replace(/\.?0+$/, "") : String(value);
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * GeoGebra-style "Algebra view": lists every non-auxiliary cell in `graph`
 * (see CellGraph.list/role/isAuxiliary), tagging each as a free object
 * (directly settable, e.g. a slider or the typed expression itself) or a
 * dependent one (computed from other cells). Internal sampling/UI-state
 * cells (path, derivative trace, drag-handle position, etc.) are marked
 * `auxiliary` by their owning component and hidden here by default, so this
 * reads as a short, meaningful object list rather than sampling-resolution
 * noise.
 *
 * Subscribes to the whole graph (`subscribeAll`) rather than one cell,
 * since the *set* of cells can change (a new free variable's slider cell
 * appears) as much as any individual value does.
 */
export function AlgebraView({ graph, showAuxiliary = false }: { graph: CellGraph; showAuxiliary?: boolean }) {
  const entries = useSyncExternalStore(
    (onChange) => graph.subscribeAll(onChange),
    () => graph.list(),
    () => graph.list(),
  );

  const visible = entries
    .filter((e) => e.hasValue && e.role !== "unknown" && (showAuxiliary || !e.auxiliary))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (visible.length === 0) return null;

  return (
    <div style={{ fontSize: "0.9rem", border: "1px solid #ccc", borderRadius: 4, padding: "0.5rem 0.75rem" }}>
      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Objects</div>
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {visible.map((e) => (
          <li key={e.id} style={{ fontFamily: "monospace" }}>
            <span style={{ color: e.role === "free" ? "#2563eb" : "#5b6b8c" }}>{e.role === "free" ? "○" : "●"}</span>{" "}
            {e.id} = {formatValue(graph.get(e.id))}
          </li>
        ))}
      </ul>
    </div>
  );
}
