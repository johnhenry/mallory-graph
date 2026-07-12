import { createFileRoute } from "@tanstack/react-router";
import { GeometryPanel } from "~/components/GeometryPanel.tsx";

export const Route = createFileRoute("/_app/geo")({
  component: GeometryPage,
});

function GeometryPage() {
  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Geometry</p>
        <h1>Construct and reason.</h1>
        <p className="lede">Points, lines, circles, and their dependents.</p>
      </div>
      <GeometryPanel />
    </div>
  );
}
