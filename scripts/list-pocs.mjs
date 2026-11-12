#!/usr/bin/env node
/**
 * Lists every proof-of-concept in the assessment.
 *
 * Two tiers:
 *  - `poc/**`                     root tier  — exercises upstream `shared/` modules directly
 *  - `target/pollinations/<w>/test/poc/**`  worker tier — exercises real Worker routes via workerd
 *
 * Usage: node scripts/list-pocs.mjs [--json]
 */
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "target", "pollinations");
const WORKER_DIR = {
    enter: "enter.pollinations.ai",
    gen: "gen.pollinations.ai",
    media: "media.pollinations.ai",
    shared: "shared",
};

function walk(dir) {
    if (!existsSync(dir)) return [];
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (/\.test\.ts$/.test(entry)) out.push(full);
    }
    return out;
}

const rows = [];
for (const f of walk(path.join(TARGET, "poc"))) {
    rows.push({ tier: "root", worker: "root", file: path.relative(ROOT, f) });
}
for (const [worker, dir] of Object.entries(WORKER_DIR)) {
    for (const f of walk(path.join(TARGET, dir, "test", "poc"))) {
        rows.push({ tier: "worker", worker, file: path.relative(ROOT, f) });
    }
}
rows.sort((a, b) => a.file.localeCompare(b.file));

if (process.argv.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
} else {
    console.log(`[poc] ${rows.length} proof-of-concept file(s)`);
    for (const r of rows) {
        console.log(`  ${r.tier.padEnd(6)} ${r.worker.padEnd(6)} ${r.file}`);
    }
}
