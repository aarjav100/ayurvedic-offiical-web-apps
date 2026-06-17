import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const isRender = process.env.RENDER === "true";

// Both Cloudflare and Render use the same server entry (src/server.ts).
// Cloudflare runs the Worker natively; Render uses render-entry.mjs to adapt it to Node.js HTTP.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    (!isRender && process.env.NODE_ENV === "production") ? cloudflare() : null,
  ].filter(Boolean) as any,
});
