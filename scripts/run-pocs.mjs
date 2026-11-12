#!/usr/bin/env node
/**
 * PoC orchestrator for the authorized pollinations/pollinations security assessment.
 *
 * Every PoC lives next to the worker it exercises, in
 * `target/pollinations/<worker>/test/poc/*.test.ts`, so it runs against the
 * REAL upstream Worker code through that worker's own vitest config
 * (`@cloudflare/vitest-plugin` -> workerd pool, real D1/KV/R2 bindings,
 * upstream fetch mocks). No upstream source file is modified by the
 * assessment; only new `test/poc/**` files are added.
 *
 * Usage:
 *   node scripts/run-pocs.mjs                  # every worker
 *   node scripts/run-pocs.mjs enter            # one worker
 *   node scripts/run-pocs.mjs enter gen        # several workers
 *   node scripts/run-pocs.mjs --file <path>    # one PoC file (relative to worker dir)
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "target", "pollinations");

const WORKERS = ["enter", "gen", "media", "shared", "root"];
const WORKER_DIR = {
    enter: "enter.pollinations.ai",
    gen: "gen.pollinations.ai",
    media: "media.pollinations.ai",
    shared: "shared",
    // monorepo-root tier: packages/**, operations/**, apps/** (plain node)
    root: ".",
};

const args = process.argv.slice(2);
let onlyFile = null;
const workerArgs = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file") {
        onlyFile = args[++i];
        continue;
    }
    workerArgs.push(args[i]);
}

const selected = workerArgs.length
    ? workerArgs.filter((w) => WORKERS.includes(w))
    : WORKERS;

if (!selected.length) {
    console.error(`No known workers selected. Known: ${WORKERS.join(", ")}`);
    process.exit(2);
}

const vitestBin = path.join(TARGET, "node_modules", ".bin", "vitest");
if (!existsSync(vitestBin)) {
    console.error(
        `[poc] missing ${vitestBin}\n[poc] run: npm install && npm --prefix target/pollinations install`,
    );
    process.exit(2);
}

let failed = 0;
const summary = [];

for (const worker of selected) {
    const dir = path.join(TARGET, WORKER_DIR[worker]);
    const isRootTier = worker === "root";
    const pocDir = isRootTier
        ? path.join(dir, "poc")
        : path.join(dir, "test", "poc");
    if (!existsSync(pocDir)) {
        console.log(`[poc] ${worker}: no PoC directory, skipping`);
        continue;
    }
    // Prefer an assessment-specific vitest config (never modifies upstream
    // configs) so PoCs are actually collected: upstream shared/vitest.config.ts
    // hardcodes `include` to two registry tests.
    const pocConfig = path.join(dir, "vitest.poc.config.ts");
    const vitestArgs = ["run", "--reporter=default"];
    if (existsSync(pocConfig)) vitestArgs.push("--config", "vitest.poc.config.ts");
    else vitestArgs.push("--dir", isRootTier ? "poc" : "test/poc");
    if (onlyFile) vitestArgs.push(onlyFile);
    console.log(
        `\n[poc] === ${worker} (${WORKER_DIR[worker]}) :: vitest ${vitestArgs.join(" ")} ===`,
    );
    const res = spawnSync(vitestBin, vitestArgs, {
        cwd: dir,
        stdio: "inherit",
        env: { ...process.env, TZ: "UTC", CI: "1" },
    });
    const code = res.status === null ? 1 : res.status;
    summary.push({ worker, exit: code });
    if (code !== 0) failed++;
}

console.log("\n[poc] === summary ===");
for (const s of summary) {
    console.log(`[poc] ${s.worker}: exit ${s.exit}`);
}
if (failed) {
    console.error(`[poc] ${failed} worker(s) failed`);
    process.exit(1);
}
console.log("[poc] all selected workers green");
