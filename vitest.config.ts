import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [preact()],
  // One preact only: @testing-library/preact can pull its own copy, and
  // duplicate preact breaks hooks in ways that look like flaky state.
  resolve: {
    dedupe: ["preact"],
  },
  test: {
    environment: "jsdom",
    // Globals expose afterEach to @testing-library/preact, which is how its
    // automatic DOM cleanup between tests registers itself.
    globals: true,
  },
});
