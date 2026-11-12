#!/usr/bin/env node
/**
 * Assessment build step.
 *
 * 1. Discovers every proof-of-concept (root `poc/**` + worker `test/poc/**`).
 * 2. Verifies each one has a matching issue report at the repo root.
 * 3. Writes `dist/assessment-index.json` + `dist/assessment-index.md`:
 *    the severity-ordered findings list (one row per PoC).
 * 4. Fails the build when a PoC has no report or a report has no PoC.
 *
 * The build is deterministic and needs no network.
 */
import { readdirSync, existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "target", "pollinations");
const OUT = path.join(ROOT, "dist");
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
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (/\.test\.ts$/.test(entry)) out.push(full);
    }
    return out;
}

function issueFiles() {
    if (!existsSync(ROOT)) return [];
    return readdirSync(ROOT)
        .filter((f) => /^issue\d+\.md$/.test(f))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
}

function readSeverity(file) {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    const m = text.match(/\*\*Severity:\*\*\s*([^\n*]+)/i);
    return m ? m[1].trim() : "Unspecified";
}

function readTitle(file) {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    const m = text.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : file;
}

// ---- discover -------------------------------------------------------------
const pocs = [];
for (const f of walk(path.join(ROOT, "poc"))) {
    pocs.push({ tier: "root", worker: "shared", file: path.relative(ROOT, f) });
}
for (const [worker, dir] of Object.entries(WORKER_DIR)) {
    for (const f of walk(path.join(TARGET, dir, "test", "poc"))) {
        pocs.push({ tier: "worker", worker, file: path.relative(ROOT, f) });
    }
}
const issues = issueFiles();

// A report names its PoC file in the line `PoC file: \`...\``.
const pocOfIssue = new Map();
for (const issue of issues) {
    const text = readFileSync(path.join(ROOT, issue), "utf8");
    const m = text.match(/PoC file:\s*`([^`]+)`/i);
    if (m) pocOfIssue.set(path.normalize(m[1].trim()), issue);
}

const pocPaths = new Set(pocs.map((p) => path.normalize(p.file)));
const orphans = [];
for (const [pocPath, issue] of pocOfIssue) {
    if (!pocPaths.has(pocPath)) orphans.push({ issue, pocPath });
}
const unreported = pocs.filter((p) => !pocOfIssue.has(path.normalize(p.file)));

const findings = issues.map((issue) => {
    const text = readFileSync(path.join(ROOT, issue), "utf8");
    const m = text.match(/PoC file:\s*`([^`]+)`/i);
    return {
        issue,
        severity: readSeverity(issue),
        title: readTitle(issue),
        poc: m ? m[1].trim() : null,
    };
});

const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
findings.sort(
    (a, b) =>
        (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) ||
        Number(a.issue.match(/\d+/)[0]) - Number(b.issue.match(/\d+/)[0]),
);

mkdirSync(OUT, { recursive: true });
writeFileSync(
    path.join(OUT, "assessment-index.json"),
    `${JSON.stringify({ generated: true, findings, pocCount: pocs.length }, null, 2)}\n`,
);

const md = [
    "# Assessment index — verified findings",
    "",
    `${findings.length} reported finding(s), ${pocs.length} proof-of-concept file(s).`,
    "",
    "| Issue | Severity | Title | PoC |",
    "| --- | --- | --- | --- |",
    ...findings.map(
        (f) =>
            `| ${f.issue.replace(/\.md$/, "")} | ${f.severity} | ${f.title} | ${f.poc ? `\`${f.poc}\`` : "—"} |`,
    ),
    "",
].join("\n");
writeFileSync(path.join(OUT, "assessment-index.md"), md);

console.log(`[build] ${findings.length} finding(s), ${pocs.length} PoC file(s)`);
for (const f of findings) {
    console.log(`[build]   ${f.issue} [${f.severity}] ${f.title}`);
}
if (orphans.length) {
    console.error("[build] ERROR: issue reports reference missing PoC files:");
    for (const o of orphans) console.error(`[build]   ${o.issue} -> ${o.pocPath}`);
    process.exit(1);
}
if (unreported.length) {
    console.error("[build] ERROR: PoC files without a matching issue report:");
    for (const u of unreported) console.error(`[build]   ${u.file}`);
    process.exit(1);
}
console.log("[build] OK — every PoC has a report and every report has a PoC");
