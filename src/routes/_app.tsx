import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

const NAV_ITEMS: Array<{ to: string; label: string; icon: string }> = [
  {
    to: "/",
    label: "Dashboard",
    icon: '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>',
  },
  {
    to: "/calculator",
    label: "Calculator",
    icon: '<rect x="3" y="1.5" width="10" height="13" rx="1.3"/><rect x="4.7" y="3.3" width="6.6" height="2.6" rx="0.5" stroke-width="1.2"/><circle cx="5.4" cy="9" r="0.75" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="0.75" fill="currentColor" stroke="none"/><circle cx="10.6" cy="9" r="0.75" fill="currentColor" stroke="none"/><circle cx="5.4" cy="11.8" r="0.75" fill="currentColor" stroke="none"/><circle cx="8" cy="11.8" r="0.75" fill="currentColor" stroke="none"/><circle cx="10.6" cy="11.8" r="0.75" fill="currentColor" stroke="none"/>',
  },
  {
    to: "/graphing",
    label: "Graphing",
    icon: '<path d="M1.5 8.5C3 5 4 12 5.5 8.5S8 3 9.5 8.5s2.5 3.5 5-1" stroke-linecap="round"/>',
  },
  {
    to: "/3d",
    label: "3D & Surfaces",
    icon: '<path d="M8 1.5 14 4.5v7L8 14.5 2 11.5v-7L8 1.5Z" stroke-linejoin="round"/><path d="M2 4.5 8 7.5m0 0 6-3M8 7.5v7" stroke-linejoin="round"/>',
  },
  {
    to: "/geo",
    label: "Geometry",
    icon: '<path d="M8 2.2 3 13h10L8 2.2Z" stroke-linejoin="round"/><circle cx="8" cy="6.3" r="0.9" fill="currentColor" stroke="none"/>',
  },
  {
    to: "/calculus",
    label: "Calculus",
    icon: '<path d="M6.4 2.3c-1.6 0-2 1.3-2 2.6v6c0 1.3-.4 2.6-2 2.6M6.9 6.4h3.6" stroke-linecap="round"/><path d="M11 10.5c.6.8 1.2.8 1.6 0" stroke-linecap="round"/>',
  },
  {
    to: "/data",
    label: "Data & Algebra",
    icon: '<path d="M2.5 13.5v-4M6.5 13.5v-8M10.5 13.5v-6M14 13.5V4" stroke-linecap="round"/>',
  },
  {
    to: "/notes",
    label: "Notebook",
    icon: '<rect x="2.5" y="1.8" width="11" height="12.4" rx="1.2"/><path d="M5 5.2h6M5 8h6M5 10.8h3.6" stroke-linecap="round"/>',
  },
  {
    to: "/gallery",
    label: "Gallery",
    icon: '<path d="M8 2.2 9.6 5.6l3.7.5-2.7 2.6.6 3.7L8 10.6l-3.2 1.8.6-3.7-2.7-2.6 3.7-.5L8 2.2Z" stroke-linejoin="round"/>',
  },
];

function NavIcon({ path }: { path: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" dangerouslySetInnerHTML={{ __html: path }} />
  );
}

function AppShell() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="wordmark">
          <span className="mono">
            <span className="wordmark-accent">{"›"}</span> mallory<span className="wordmark-accent">.</span>
            graph
          </span>
          <button
            type="button"
            className="theme-toggle"
            aria-label="Toggle theme"
            title="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {"◐"}
          </button>
        </div>

        <nav className="primary-nav">
          <div className="nav-eyebrow">Tools</div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="nav-item"
              activeProps={{ className: "nav-item active" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              <NavIcon path={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/demos" className="legacy-link">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M4 3.5h8M4 8h8M4 12.5h5" strokeLinecap="round" />
            </svg>
            Legacy / all demos
          </Link>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
