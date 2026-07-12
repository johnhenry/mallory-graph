import { useEffect, useRef, useState } from "react";
import {
  EMPTY_CALCULATOR_STATE,
  submitCalculatorLine,
  type CalculatorMode,
  type CalculatorState,
} from "../lib/calculator-eval.ts";

const STORAGE_KEY = "mallory-graph:calculator";

const STRUCTURE_OPTIONS: Array<{ label: string; modulus: number | null }> = [
  { label: "Real numbers", modulus: null },
  { label: "Z/2Z (GF(2))", modulus: 2 },
  { label: "Z/5Z", modulus: 5 },
  { label: "Z/7Z (GF(7))", modulus: 7 },
  { label: "Z/11Z", modulus: 11 },
];

function loadStoredState(): CalculatorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CALCULATOR_STATE;
    const parsed = JSON.parse(raw);
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      variables: parsed.variables && typeof parsed.variables === "object" ? parsed.variables : {},
    };
  } catch {
    return EMPTY_CALCULATOR_STATE;
  }
}

/**
 * A REPL-style "just an answer" tool: type an expression, get a result, or
 * `name = expr` to name a value and reuse it in later lines. No plot/
 * viewport (that's what Graphing is for) -- unlike every other panel in
 * this app, it needs no CellGraph (nothing else derives from its state) and
 * persists to `localStorage` rather than a URL hash or the server-backed
 * Gallery, since a scratch calculation isn't the kind of thing worth a
 * shareable link (mallory-graph's SPA-shell pass).
 */
export function CalculatorPanel() {
  const [state, setState] = useState<CalculatorState>(loadStoredState);
  const [mode, setMode] = useState<CalculatorMode>("float");
  const [modulus, setModulus] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.history.length]);

  function handleSubmit() {
    if (!input.trim()) return;
    setState((s) => submitCalculatorLine(input, s, mode, modulus));
    setInput("");
  }

  const variableNames = Object.keys(state.variables);

  return (
    <div>
      <label style={{ display: "block", margin: "0.5rem 0" }}>
        Structure:{" "}
        <select
          value={modulus === null ? "real" : String(modulus)}
          onChange={(e) => {
            const v = e.target.value;
            setModulus(v === "real" ? null : Number(v));
          }}
        >
          {STRUCTURE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.modulus === null ? "real" : String(opt.modulus)}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {modulus === null && (
        <div role="radiogroup" aria-label="Arithmetic mode" style={{ margin: "0.5rem 0" }}>
          <label>
            <input type="radio" name="calc-mode" checked={mode === "float"} onChange={() => setMode("float")} /> Float
          </label>{" "}
          <label>
            <input type="radio" name="calc-mode" checked={mode === "exact"} onChange={() => setMode("exact")} /> Exact
          </label>
        </div>
      )}

      <div
        ref={historyRef}
        style={{
          border: "1px solid #ccc",
          borderRadius: "6px",
          padding: "0.5rem 0.75rem",
          minHeight: "8rem",
          maxHeight: "20rem",
          overflowY: "auto",
          margin: "0.5rem 0",
          font: "0.9rem ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      >
        {state.history.length === 0 && <p style={{ color: "#888", margin: 0 }}>Type an expression below, or "name = expr" to save a value.</p>}
        {state.history.map((entry, i) => (
          <div
            key={i}
            style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.15rem 0" }}
          >
            <span style={{ color: "#555" }}>{entry.input}</span>
            <span style={{ color: entry.isError ? "crimson" : entry.isAssignment ? "#2563eb" : "inherit", fontWeight: entry.isAssignment ? 600 : 400 }}>
              {entry.display}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ color: "#2563eb" }}>{"›"}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder='log(100) + r, or  k = 3*r'
          style={{ flex: 1, font: "inherit", padding: "0.3rem 0.4rem" }}
          autoComplete="off"
        />
      </div>

      {variableNames.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.5rem" }}>
          Defined: {variableNames.map((name) => `${name} = ${state.variables[name]}`).join(", ")}
        </p>
      )}
    </div>
  );
}
