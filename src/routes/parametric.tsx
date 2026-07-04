import { createFileRoute, Link } from "@tanstack/react-router";
import { ParametricPanel } from "../components/ParametricPanel.tsx";

export const Route = createFileRoute("/parametric")({
  component: ParametricPage,
});

function ParametricPage() {
  return (
    <div>
      <h1>mallory-graph — parametric &amp; polar curves</h1>
      <details>
        <summary>Plots (x(t), y(t)) directly, or r(θ) reinterpreted as a parametric curve.</summary>
        <p>
          r(θ) becomes x=r·cosθ, y=r·sinθ under the hood. v1 is a single curve over a fixed (non-pannable) viewport
          and domain.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      <ParametricPanel />
    </div>
  );
}
