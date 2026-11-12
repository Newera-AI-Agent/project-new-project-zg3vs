/**
 * Assessment-only vitest config for the monorepo-root tier.
 *
 * Covers `packages/**`, `operations/**` and `apps/**` code, which are plain
 * Node/browser packages (no workerd bindings) and therefore cannot run in the
 * Workers pool. PoCs live under `target/pollinations/poc/**`.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    root: fileURLToPath(new URL("./", import.meta.url)),
    resolve: {
        alias: {
            "@shared": fileURLToPath(new URL("./shared/", import.meta.url)),
        },
    },
    test: {
        include: ["poc/**/*.test.ts"],
        environment: "node",
        reporters: ["default"],
    },
});
