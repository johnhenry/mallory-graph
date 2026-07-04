import { createFileRoute, Link } from "@tanstack/react-router";
import { OdePanel } from "../components/OdePanel.tsx";

export const Route = createFileRoute("/ode")({
  component: OdePage,
});

function OdePage() {
  return (
    <div>
      <h1>mallory-graph — differential equations</h1>
      <p>
        Numerically solves a first-order IVP dy/dx = f(x, y), y(x0) = y0 via <code>Numerical.rk4</code>, plotted
        against its slope field. v1 is a single first-order equation with a fixed (non-pannable) domain — symbolic
        (closed-form) ODE solving and higher-order/systems-of-ODEs are later extensions.
      </p>
      <p>
        <Link to="/">← back</Link>
      </p>
      <OdePanel />
    </div>
  );
}
