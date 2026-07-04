import { createFileRoute, Link } from "@tanstack/react-router";
import { Linked3DView } from "../components/Linked3DView.tsx";

export const Route = createFileRoute("/surface-3d")({
  component: ThreeDPage,
});

function ThreeDPage() {
  return (
    <div>
      <h1>mallory-graph — 3D surface</h1>
      <details>
        <summary>A 2D curve and a 3D surface, sharing one reactive core.</summary>
        <p>
          Via <code>CellGraph</code>: sampling (<code>sample-function.ts</code> vs <code>sample-surface.ts</code>)
          and rendering (Canvas2D vs Three.js) differ, but the expression/params/free-var plumbing is the same.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      <Linked3DView />
    </div>
  );
}
