import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createApiMiddleware } from "./server/steamProxy.mjs";
import { fetchWikiCatalogItems } from "./server/wikiCatalog.mjs";

function apiProxyPlugin(): Plugin {
  const apiMiddleware = createApiMiddleware(fetchWikiCatalogItems);
  return {
    name: "api-proxy",
    configureServer(server) {
      server.middlewares.use(apiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiMiddleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiProxyPlugin()],
});
