import { createFileRoute, Link } from "@tanstack/react-router";
import { SystemSolverPanel } from "../components/SystemSolverPanel.tsx";

export const Route = createFileRoute("/systems")({
  component: SystemsPage,
});

function SystemsPage() {
  return (
    <div>
      <h1>mallory-graph — system of equations</h1>
      <p>
        Solves a system of linear equations via <code>Symbolic.solveSystem</code>, bridging to{" "}
        <code>MatrixMath</code>'s LU-based solver. Throws on a genuinely nonlinear or singular system rather than
        returning a wrong answer. v1 is fixed at 2 equations/2 variables.
      </p>
      <p>
        <Link to="/">← back</Link>
      </p>
      <SystemSolverPanel />
    </div>
  );
}
