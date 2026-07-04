import { createFileRoute, Link } from "@tanstack/react-router";
import { GeometryPanel } from "../components/GeometryPanel.tsx";

export const Route = createFileRoute("/geometry")({
  component: GeometryPage,
});

function GeometryPage() {
  return (
    <div>
      <h1>mallory-graph — geometry construction</h1>
      <details>
        <summary>Compass-and-straightedge construction tools, built on CellGraph's free/dependent object model.</summary>
        <p>
          Click with the Point tool to place a free point, then Line/Circle to connect existing points. Each
          Line/Circle also gets a genuinely <em>dependent</em> length/radius cell reading its points' live
          coordinates — the Objects list below shows both kinds side by side. v1 has no point-dragging yet (so the
          dependent recompute isn't user-visible today), no transformations, and no measurement tools beyond
          length/radius — all natural next steps once this core model is in place.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      <GeometryPanel />
    </div>
  );
}
