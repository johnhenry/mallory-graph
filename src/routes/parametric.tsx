import { createFileRoute, Link } from "@tanstack/react-router";
import { ParametricPanel } from "../components/ParametricPanel.tsx";

export const Route = createFileRoute("/parametric")({
  component: ParametricPage,
});

function ParametricPage() {
  return (
    <div>
      <h1>mallory-graph — parametric &amp; polar curves</h1>
      <p>
        Plots (x(t), y(t)) directly, or r(θ) reinterpreted as the parametric curve x=r·cosθ, y=r·sinθ. v1 is a single
        curve over a fixed (non-pannable) viewport and domain.
      </p>
      <p>
        <Link to="/">← back</Link>
      </p>
      <ParametricPanel />
    </div>
  );
}
