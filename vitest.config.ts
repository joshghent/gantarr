import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Standalone vitest config — deliberately does NOT load the app's
// vite.config.ts (the TanStack Start plugin assumes a full dev/build
// pipeline and isn't needed for unit tests). We only need path-alias
// resolution so `#/` imports work the same way they do in the app.
export default defineConfig({
	plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
	test: {
		// jsdom by default: some tests touch the DOM (export.test.ts), and
		// the env-agnostic lib tests (schema/link) run fine under it too —
		// jsdom still exposes the Node globals we rely on (CompressionStream,
		// btoa/atob, Blob, Response).
		environment: "jsdom",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});
