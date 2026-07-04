import { createFileRoute, Link } from "@tanstack/react-router";
import { OdePanel } from "../components/OdePanel.tsx";

export const Route = createFileRoute("/ode")({
  component: OdePage,
});

function OdePage() {
  return (
    <div>
      <h1>mallory-graph — differential equations</h1>
      <details>
        <summary>Numerically solves a first-order IVP dy/dx = f(x, y), plotted against its slope field.</summary>
        <p>
          Via <code>Numerical.rk4</code>. v1 is a single first-order equation with a fixed (non-pannable) domain —
          symbolic (closed-form) ODE solving is a later extension. Coupled systems of ODEs now have their own{" "}
          <Link to="/ode-system">phase-portrait view</Link>.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      <OdePanel />
    </div>
  );
}
