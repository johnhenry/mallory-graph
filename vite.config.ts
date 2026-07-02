import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), tanstackStart(), react()],
  // manim-js/node (used only inside a server-only createServerFn in
  // export-video.ts) transitively requires @napi-rs/canvas's native .node
  // binary. The production build already excludes it from the client
  // bundle, but Vite dev's dependency scanner doesn't respect that
  // server/client split and tries to pre-bundle it for the browser.
  optimizeDeps: {
    exclude: ["manim-js", "@napi-rs/canvas"],
  },
});
