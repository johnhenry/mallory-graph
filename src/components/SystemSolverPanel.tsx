import { NonLinearSystemError, Symbolic } from "mallory-math";
import { useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsSystem } from "../lib/cell-ids.ts";
import { equationToImplicitZero } from "../lib/equation-to-zero.ts";
import { useCellGraphTools } from "../hooks/use-cell-graph-tools.ts";
import { preprocessImplicitMultiplication } from "../lib/implicit-mult.ts";
import { useCell } from "../lib/use-cell.ts";

type SolutionResult =
  | { ok: true; values: Record<string, number>; method: "exact" | "numeric" }
  | { ok: false; message: string };

const DEFAULT_EQUATIONS = ["2*x + 3*y = 12", "x - y = 1"];
const DEFAULT_VARIABLES = "x,y";

/**
 * Sets up a system-solver pane's reactive cells on its own private
 * CellGraph -- a different input shape entirely from GraphCanvas's single
 * expression + axis variable (N equation strings + a variable-name list), so
 * it isn't woven into `cellIds`/`useExpressionGraph` at all.
 */
function useSystemGraph(cellId: string): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    const ids = cellIdsSystem(cellId);
    if (!graph.has(ids.equations)) {
      graph.set(ids.equations, DEFAULT_EQUATIONS);
      graph.set(ids.variables, DEFAULT_VARIABLES);

      // Deliberate deviation from the "keep last good value on error" pattern
      // used by GraphCanvas's sampling cells: this surfaces the actual thrown
      // error message (NonLinearSystemError/SingularSystemError/etc.) rather
      // than a stale solution. Solving is a discrete action, not a continuous
      // typing target -- *why* it failed is the useful output here, not a
      // flicker-free canvas.
      graph.define(ids.solution, (): SolutionResult => {
        const equations = graph.get<string[]>(ids.equations);
        const variablesText = graph.get<string>(ids.variables);
        const variables = variablesText
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        const exprs = equations.map((eq) => preprocessImplicitMultiplication(equationToImplicitZero(eq)));
        try {
          const values = Symbolic.solveSystem(exprs, variables);
          return { ok: true, values, method: "exact" };
        } catch (e) {
          if (!(e instanceof NonLinearSystemError)) {
            return { ok: false, message: e instanceof Error ? e.message : String(e) };
          }
        }
        // Nonlinear -- fall back to the damped-Newton numeric solver (never
        // throws NonLinearSystemError itself; only finds one root near its
        // default initial guess, so a genuinely bad guess or a system with
        // multiple solutions can still fail/pick an unexpected root).
        try {
          const values = Symbolic.solveSystemNumeric(exprs, variables);
          return { ok: true, values, method: "numeric" };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });
    }
    ref.current = graph;
  }
  return ref.current;
}

export interface SystemSolverPanelProps {
  cellId?: string;
}

/** N equations in N variables -- Symbolic.solveSystem itself is already N-safe; this just adds add/remove-row UI on top. */
export function SystemSolverPanel({ cellId = "system-1" }: SystemSolverPanelProps = {}) {
  const graph = useSystemGraph(cellId);
  useCellGraphTools("data_systems", graph);
  const ids = cellIdsSystem(cellId);
  const equations = useCell<string[]>(graph, ids.equations);
  const variablesText = useCell<string>(graph, ids.variables);
  const solution = useCell<SolutionResult>(graph, ids.solution);
  const [equationInputs, setEquationInputs] = useState(equations);
  const [variablesInput, setVariablesInput] = useState(variablesText);

  function updateEquation(i: number, value: string) {
    const next = equationInputs.map((eq, idx) => (idx === i ? value : eq));
    setEquationInputs(next);
    graph.set(ids.equations, next);
  }

  function addEquation() {
    const next = [...equationInputs, ""];
    setEquationInputs(next);
    graph.set(ids.equations, next);
  }

  function removeEquation(i: number) {
    const next = equationInputs.filter((_, idx) => idx !== i);
    setEquationInputs(next);
    graph.set(ids.equations, next);
  }

  function updateVariables(value: string) {
    setVariablesInput(value);
    graph.set(ids.variables, value);
  }

  return (
    <div>
      {equationInputs.map((eq, i) => (
        <div key={i} style={{ margin: "0.25rem 0", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <label>
            Equation {i + 1} (= 0 implicitly, or write "= value"):{" "}
            <input
              value={eq}
              onChange={(e) => updateEquation(i, e.target.value)}
              style={{ font: "inherit", width: "28ch" }}
            />
          </label>
          <button
            type="button"
            onClick={() => removeEquation(i)}
            disabled={equationInputs.length <= 1}
            aria-label="Remove equation"
            title="Remove equation"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={addEquation} style={{ margin: "0.25rem 0" }}>
        + Add equation
      </button>
      <div style={{ margin: "0.25rem 0" }}>
        <label>
          Variables (comma-separated):{" "}
          <input
            value={variablesInput}
            onChange={(e) => updateVariables(e.target.value)}
            style={{ font: "inherit", width: "12ch" }}
          />
        </label>
      </div>
      <div style={{ margin: "0.5rem 0" }}>
        {solution.ok ? (
          <>
            <ul>
              {Object.entries(solution.values).map(([name, value]) => (
                <li key={name}>
                  {name} = {value.toFixed(4)}
                </li>
              ))}
            </ul>
            {solution.method === "numeric" && (
              <p style={{ fontSize: "0.85rem", color: "#5b6b8c" }}>
                Solved numerically (the system isn't linear) -- finds one nearby root, not necessarily every solution.
              </p>
            )}
          </>
        ) : (
          <p style={{ color: "crimson" }}>{solution.message}</p>
        )}
      </div>
    </div>
  );
}
