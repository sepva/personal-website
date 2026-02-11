import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

// Configuration for tests
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/index.test.ts", "**/node_modules/**"]
  }
});
