import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // maximum-scale/user-scalable are deliberately left unset -- pinch-zoom
      // stays available; a fixed layout width is what actually needs fixing
      // per-page (canvas/table overflow), not disabling zoom.
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "mallory-graph" },
      { name: "description", content: "An interactive graphing calculator built on mallory-math." },
      // iOS home-screen install (Android reads the manifest below instead).
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "mallory-graph" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "/styles.css",
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Rendered directly (not via head()'s `meta` array) -- TanStack
            Router's head merge dedupes by `name` alone, ignoring `media`, so
            two same-named theme-color entries there collapse to just the
            last one. Mirrors the same tokens the SPA shell's own CSS media
            query uses, so mobile browser chrome / PWA title bar matches
            whichever theme is actually rendering. */}
        <meta name="theme-color" content="#fafbfd" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
