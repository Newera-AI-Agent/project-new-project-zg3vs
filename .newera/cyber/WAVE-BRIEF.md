# WAVE BRIEF — pollinations/pollinations authorized security assessment (relay VM 2)

Read COMPLETELY before writing code. This is the contract for every wave.

## 0. Authorization / safety (NON-NEGOTIABLE)
- Scope: `.newera/cyber/scope.json`. ONLY loopback (`http://127.0.0.1:*`, `http://localhost:*`)
  and the vendored source tree may be touched.
- NEVER contact pollinations.ai / gen / enter / media / any third-party host. No live scanning,
  no DoS, no bulk enumeration, no real credentials, no production data.
- NEVER modify upstream source files. Only ADD:
  - `target/pollinations/<worker>/test/poc/<slug>.test.ts` (worker tier)
  - `target/pollinations/poc/<slug>.test.ts` (root tier)
  - `target/pollinations/shared/test/poc/<slug>.test.ts` (shared tier)
  - your assigned `issue<N>.md` files at the REPO ROOT (`/home/runner/work/project-new-project-zg3vs/project-new-project-zg3vs/`)
- Do NOT touch files owned by another wave (other `issue*.md`, other `test/poc/**` files).
- Do NOT git commit / push / open PRs. The harness commits.

## 1. Layout
`target/pollinations/`
| dir | contents |
|---|---|
| `shared/` | auth, session tokens, billing helpers, middleware, registry, crypto, rate limiting, community endpoints, secret encryption, safety, r2-storage, client-ip, cache |
| `enter.pollinations.ai/` | account/auth API, API-key lifecycle, wallet/pollen, payments, device+OAuth flows, quests, agents, code agents |
| `gen.pollinations.ai/` | generation gateway (text/image/video/audio), text+media cache, moderation/guardrails, MCP apps, code-execution sandbox, realtime sessions |
| `media.pollinations.ai/` | R2 uploads, galleries, tag catalogue, run tokens, public media serving |
| `packages/` | `auth`, `sdk`, `mcp`, `polli-cli`, `ui` — published client surfaces |
| `operations/` | dashboards, monitoring, community-monitor agent, data-sync, infrastructure, news |
| `apps/` | ~53 community agents / MCP apps (discord bot, catgpt, floret, exa-mcp, ffmpeg-mcp, computer-mcp, websim, ...) |
| `pollinations.ai/` | marketing site + apps catalogue (frontend) |

## 2. How PoCs run
Worker tier (enter/gen/media) -> REAL worker routes, REAL D1/KV/R2, workerd pool:
```bash
cd target/pollinations/enter.pollinations.ai && ../node_modules/.bin/vitest run test/poc/<slug>.test.ts
```
The worker dir's own `vitest.config.ts` already collects `test/**` (only `test/e2e/**` is excluded),
so NO extra config is needed for worker tier.

enter fixtures: `import { test } from "../fixtures.ts"` (NOT from vitest):
```ts
import { test } from "../fixtures.ts";
test("...", async ({ apiKey, paidApiKey, pubApiKey, restrictedApiKey, exhaustedBudgetApiKey,
                      budgetedApiKey, accountToken, sessionToken, auth, mocks }) => { ... });
```
- `apiKey` normal key | `paidApiKey` user with pollen | `pubApiKey` publishable key |
  `restrictedApiKey` model-restricted | `exhaustedBudgetApiKey` zero budget (402) |
  `budgetedApiKey` `{key,id}` | `accountToken` dashboard bearer token | `sessionToken` better-auth cookie value |
  `auth` better-auth client (baseURL http://localhost:3000, basePath /api/auth) | `mocks` {tinybird,discord,github,google,stripe}
- `mocks.enable("github","tinybird")` etc. to intercept upstream HTTP.
- D1: `import { env } from "cloudflare:test"`; `drizzle(env.DB)`; schema `import * as schema from "@shared/db/better-auth.ts"`.
- gen/media: import { test, expect } from "vitest" + `import { env, SELF } from "cloudflare:test"`.
  Read an existing upstream test in that worker for the exact pattern (e.g. `test/account-key.test.ts`).

Shared tier (plain node):
```bash
cd target/pollinations/shared && ../node_modules/.bin/vitest run --config vitest.poc.config.ts test/poc/<slug>.test.ts
```
Root tier (packages/operations/apps/frontend, plain node):
```bash
cd target/pollinations && ./node_modules/.bin/vitest run --config vitest.poc.config.ts poc/<slug>.test.ts
```
Root config aliases `@shared` -> `target/pollinations/shared/`.

## 3. THE ASSERTION RULE — a PoC is valid only if it is GREEN and PROVES the bug
- The test MUST PASS on the current (vulnerable) code. The assertions prove the vulnerable
  behaviour (e.g. attacker gets another user's token, HTTP 200 where 403 is required,
  wallet balance goes negative, secret appears in a response/log).
- If your exploit does NOT reproduce: DELETE the PoC file, do NOT write an issue report, and
  list it under "negative results" with the exact error output. A skipped/todo test is a FAILURE.
- Never fabricate. A false-positive report is worse than no report.
- Assert on the observable effect (status code, body, DB row, R2 object, money movement, auth decision).
- Print quotable evidence: `console.log("[poc] ...")` (disableConsoleIntercept is on).
- One vulnerability per file, <= ~220 lines.
- No network: mock every external call (enter `mocks.*`, or `vi.stubGlobal`/`vi.mock`, or a local fetch stub).
- Do not leave `test.skip`, `it.skip`, `.todo`, or commented-out assertions.

## 4. Distinctness — do NOT re-report the archived bugs #40-#127
Index: `.newera/cyber/archive/pollinations-bugs-40-127/00-SEVERITY-INDEX.md` (READ IT FIRST;
individual files sit next to it). A new finding is valid only with a DIFFERENT root cause.
- You MUST cite the nearest prior archived issue number and say in ONE line why the new finding is distinct
  (different code path / different root cause / different impact).
- Same root cause in a second location = DUPLICATE -> drop it.

## 5. What is worth reporting (priority order)
1. Account takeover / auth bypass (session, device, OAuth, consent, key minting, account deletion not revoking sessions).
2. Money: pollen wallet races, unbilled spend, refund/chargeback, top-up/auto-top-up, price & quota bypass.
3. Cross-tenant data exposure: IDOR, private model/asset leaks, secret leakage (keys in logs/URLs/DB plaintext).
4. Injection with real impact: stored XSS on a trusted origin, SSRF to internal/metadata, prompt injection into a
   privileged agent holding live tokens, sandbox escape, arbitrary file read.
5. Resource abuse with financial impact: unbounded upload/session/queue, uncapped agent compute, shared-token quota burn.
6. CSRF / missing Origin checks on state-changing routes.
Only report what an external attacker can actually trigger.

## 6. Your deliverable (per wave)
A. PoC file(s) — created and VERIFIED GREEN. Show the passing vitest output in your final message.
B. One issue report per verified finding, at the REPO ROOT, named exactly `issue<N>.md` using the
   issue-number block assigned to you (see your task text). EXACT template:

```markdown
# Issue <N> — <short title>

**Severity:** Critical|High|Medium
**Component:** `<path/to/file.ts>` (and related)
**PoC file:** `target/pollinations/<worker>/test/poc/<slug>.test.ts`

## Summary
<2-4 sentences: what the attacker does and what they get.>

## Root cause
<exact file:line references and the broken logic>

## Distinctness
Nearest prior archived issue: #<NN> — <one line: different code path / root cause / impact>

## Proof of concept
```bash
<exact command you ran>
```
<verbatim key output>

## Impact
<attacker capability, blast radius, financial/security consequence>

## Recommended fix
<2-6 lines>
```
The repo-root `issue*.md` naming is required by `scripts/build.mjs`; the `PoC file:` line must match the
PoC path exactly (repo-relative). `scripts/build.mjs` FAILS if a PoC has no report or a report has no PoC.

C. Final message, one line per finding:
`<slug> | severity | tier | one-line vuln | nearest-prior-issue #N and why distinct | exact test command + pass count`
plus a "negative results (do not report)" section listing every candidate that failed to reproduce
(with the exact error output) — negative results are valuable proof of rigour.
