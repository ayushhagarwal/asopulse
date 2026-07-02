import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ASOpulse",
        short_name: "ASOpulse",
        description: "Open-source App Store keyword research and rank monitoring.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/pulse",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: { navigateFallback: "/index.html", globPatterns: ["**/*.{js,css,html,svg,woff2}"] },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4100",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
