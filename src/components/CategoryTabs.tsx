import { useState, type ReactNode } from "react";

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
 */
export function CategoryTabs({ tabs }: { tabs: CategoryTab[] }) {
  const [active, setActive] = useState(0);
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
