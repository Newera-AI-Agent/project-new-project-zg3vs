/**
 * Assessment-only vitest config for shared-tier PoCs.
 *
 * Upstream `shared/vitest.config.ts` hardcodes `include` to two registry tests and
 * sets `root` to the monorepo parent, so assessment PoCs under
 * `shared/test/poc/**` would never be collected. This file is an ADDITION
 * (upstream sources are never modified by the assessment).
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    root: fileURLToPath(new URL("./", import.meta.url)),
    resolve: {
        alias: {
            "@shared": fileURLToPath(new URL("./", import.meta.url)),
        },
    },
    test: {
        include: ["test/poc/**/*.test.ts"],
        environment: "node",
        reporters: ["default"],
    },
});
