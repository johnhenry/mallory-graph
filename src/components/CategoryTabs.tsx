import { useState, type ReactNode } from "react";
import { useModelContextTool } from "../hooks/use-model-context-tool.ts";

export interface CategoryTab {
  label: string;
  render: () => ReactNode;
}

/**
 * A dependency-free tab switcher for grouping a few related, otherwise
 * unmodified panels under one URL (mallory-graph's SPA-shell pass) -- e.g.
 * Calculus's Single-ODE/ODE-System tabs. Mirrors GeometryPanel's own tool
 * selector idiom (a flat radio row driving a `useState`), the closest prior
 * art in this codebase; deliberately not a general ARIA-tablist component,
 * just enough to swap which unmodified panel is mounted.
 *
 * `prefix` names a WebMCP tool (`${prefix}_switch_tab`) so an agent can move
 * between grouped tools too -- only the active tab's panel is mounted, so
 * only its own tools are registered at any moment; switching tabs is what
 * makes the next set appear (mallory-graph's WebMCP pass).
 */
export function CategoryTabs({ prefix, tabs }: { prefix: string; tabs: CategoryTab[] }) {
  const [active, setActive] = useState(0);

  useModelContextTool({
    name: `${prefix}_switch_tab`,
    description: `Switch the active tab on the ${prefix} section. Available tabs: ${tabs.map((t) => t.label).join(", ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: `One of: ${tabs.map((t) => t.label).join(", ")}` },
      },
      required: ["label"],
    },
    handler: (input: Record<string, unknown>) => {
      const label = String(input.label ?? "");
      const index = tabs.findIndex((t) => t.label === label);
      if (index === -1) {
        throw new Error(`Unknown tab "${label}". Available tabs: ${tabs.map((t) => t.label).join(", ")}.`);
      }
      setActive(index);
      return { ok: true, label };
    },
  });

  return (
    <div>
      <div className="tab-row" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={i === active ? "tab-button active" : "tab-button"}
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tabs[active].render()}</div>
    </div>
  );
}
