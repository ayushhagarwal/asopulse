import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

const enablePwa = process.env.VITE_ENABLE_PWA === "true";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      selfDestroying: !enablePwa,
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
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        ...(enablePwa
          ? {
              navigateFallback: "/index.html",
              globPatterns: ["**/*.{js,css,html,svg,woff2}"],
            }
          : {}),
      },
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
