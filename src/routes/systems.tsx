import { createFileRoute, Link } from "@tanstack/react-router";
import { SystemSolverPanel } from "../components/SystemSolverPanel.tsx";

export const Route = createFileRoute("/systems")({
  component: SystemsPage,
});

function SystemsPage() {
  return (
    <div>
      <h1>mallory-graph — system of equations</h1>
      <details>
        <summary>Solves a system of linear equations via Symbolic.solveSystem.</summary>
        <p>
          Bridging to <code>MatrixMath</code>'s LU-based solver. Throws on a genuinely nonlinear or singular system
          rather than returning a wrong answer. v1 is fixed at 2 equations/2 variables.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      <SystemSolverPanel />
    </div>
  );
}
