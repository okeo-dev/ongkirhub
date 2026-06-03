import { defineConfig } from "vite";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  server: {
    proxy: {
      "/health": "http://localhost:3000",
      "/v0": "http://localhost:3000",
    },
  },
});
