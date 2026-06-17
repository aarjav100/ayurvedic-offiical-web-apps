import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const isRender = process.env.RENDER === "true";

// Cloudflare: use custom server.ts entry + cloudflare() plugin
// Render:     use node-server preset → produces .output/server/index.mjs
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(
      isRender
        ? { server: { preset: "node-server" } }
        : { server: { entry: "server" } }
    ),
    (!isRender && process.env.NODE_ENV === "production") ? cloudflare() : null,
  ].filter(Boolean) as any,
});
