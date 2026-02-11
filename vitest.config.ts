import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { defineConfig, mergeConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

// Configuration for unit tests (hooks, components, repositories)
const unitTestConfig = defineConfig({
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
    include: ["tests/{hooks,components,repositories}/**/*.{test,spec}.{ts,tsx}"]
  }
});

// Configuration for worker tests (server integration)
const workerTestConfig = defineWorkersConfig({
  test: {
    include: ["tests/index.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" }
      }
    },
    deps: {
      optimizer: {
        ssr: {
          include: ["ajv"]
        }
      }
    }
  }
});

// Export unit test config by default
// To run worker tests, use: npm test -- --config vitest.worker.config.ts
export default unitTestConfig;
