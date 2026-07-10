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
          Via <code>Numerical.rk4</code>. v1 is a single first-order equation with a fixed (non-pannable) domain.
          Before falling back to that numeric plot, it also tries <code>Symbolic.solveOdeClosedForm</code> --
          separable and linear-first-order equations with an elementary antiderivative get an exact "Closed form:"
          line above the plot, with a small button to copy its LaTeX source (most equations have no elementary
          closed form, so this is silently absent rather than an error). Coupled systems of ODEs now have their own{" "}
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
