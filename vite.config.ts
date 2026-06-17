import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const isRender = process.env.RENDER === "true";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper)
// for Cloudflare, but use the default Node.js server entry on Render.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(
      isRender
        ? {}
        : {
            server: { entry: "server" },
          }
    ),
    (!isRender && process.env.NODE_ENV === "production") ? cloudflare() : null,
  ].filter(Boolean) as any,
});

