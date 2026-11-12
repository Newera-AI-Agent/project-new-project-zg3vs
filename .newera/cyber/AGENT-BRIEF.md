# AGENT BRIEF — pollinations/pollinations authorized security assessment

Read this file COMPLETELY before writing any code. It is the contract for every wave.

## 0. Authorization and safety (non-negotiable)
- Scope file: `.newera/cyber/scope.json`. **Only** loopback (`http://127.0.0.1:*`,
  `http://localhost:*`) and the vendored source tree may be touched.
- **NEVER** contact `pollinations.ai`, `gen.pollinations.ai`, `enter.pollinations.ai`,
  `media.pollinations.ai` or any third-party host. No live scanning, no DoS, no
  bulk enumeration, no real credentials, no production data mutation.
- **Never modify upstream source.** Only ADD files:
  `target/pollinations/<worker>/test/poc/<slug>.test.ts` (worker tier) or
  `target/pollinations/poc/<slug>.test.ts` (root tier).
- Do not create the `issue*.md` reports — the orchestrator writes those. You deliver
  PoC files + a findings summary (see §6).
- Work only inside your assigned file list. Never touch another agent's files.

## 1. Layout of the vendored upstream tree
`target/pollinations/`
| dir | what lives there |
|---|---|
| `shared/` | auth, session tokens, billing helpers, middleware, registry, crypto, rate limiting, community endpoints, secret encryption, safety |
| `enter.pollinations.ai/` | account/auth API, API-key lifecycle, wallet/pollen, payments, device+OAuth flows, quests, agents, code agents |
| `gen.pollinations.ai/` | generation gateway (text/image/video/audio), text+media cache, moderation/guardrails, MCP apps, code-execution sandbox, realtime sessions |
| `media.pollinations.ai/` | R2 uploads, galleries, tag catalogue, run tokens, public media serving |
| `packages/` | `auth`, `sdk`, `mcp`, `polli-cli`, `ui` — published client surfaces |
| `operations/` | dashboards, monitoring, community-monitor agent, data-sync, infrastructure, news |
| `apps/` | ~70 community agents/MCP apps (discord bot, catgpt, floret, exa-mcp, ffmpeg-mcp, computer-mcp, websim, …) |
| `pollinations.ai/` | marketing site + apps catalogue (frontend) |

## 2. How PoCs run (three tiers)

### Worker tier (enter / gen / media) — REAL worker routes, REAL D1/KV/R2
PoC: `target/pollinations/<worker-dir>/test/poc/<slug>.test.ts`
Run:
```bash
cd target/pollinations/enter.pollinations.ai && ../node_modules/.bin/vitest run test/poc/<slug>.test.ts
```
The worker dir has its own `vitest.config.ts` → `@cloudflare/vitest-pool-workers` →
**workerd pool with real D1 + KV + R2 bindings**; `SELF.fetch("http://localhost:3000/...")`
routes through the real Worker. `enter` has extra setup files (D1 migrations applied).

`enter` fixtures (`target/pollinations/enter.pollinations.ai/test/fixtures.ts`) — import
`{ test }` from `../fixtures.ts` (NOT from `vitest`):
```ts
import { test } from "../fixtures.ts";
test("...", async ({ apiKey, paidApiKey, pubApiKey, restrictedApiKey,
                      exhaustedBudgetApiKey, budgetedApiKey, accountToken,
                      sessionToken, auth, mocks }) => { ... });
```
- `apiKey` — normal user key; `paidApiKey` — user with pollen balance;
  `pubApiKey` — publishable key; `restrictedApiKey` — model-restricted key;
  `exhaustedBudgetApiKey` — zero budget (expect 402); `budgetedApiKey` — `{key,id}`;
  `accountToken` — dashboard bearer token minted from the session cookie;
  `sessionToken` — better-auth session token; `auth` — better-auth client
  (baseURL `http://localhost:3000`, basePath `/api/auth`) for login/signup/2FA;
  `mocks` — `{tinybird, discord, github, google, stripe}` fetch mocks.
- `gen`/`media` tests import from `vitest` directly and use
  `import { env, SELF } from "cloudflare:test"` plus `createExecutionContext` /
  `waitOnExecutionContext` when calling a Worker handler directly.
- D1 access: `import { env } from "cloudflare:test"` then
  `drizzle(env.DB, { schema })` with `import * as schema from "@shared/db/better-auth.ts"`
  (enter). gen/media have their own schema paths — read the worker's existing tests.

### Shared tier — plain node, direct module import
PoC: `target/pollinations/shared/test/poc/<slug>.test.ts`
Run: `cd target/pollinations/shared && ../node_modules/.bin/vitest run --config vitest.poc.config.ts test/poc/<slug>.test.ts`
(the config exists precisely because upstream `shared/vitest.config.ts` hardcodes
`include` to two registry tests — assessment PoCs would never be collected).

### Root tier — packages / operations / apps / frontend (plain node or jsdom)
PoC: `target/pollinations/poc/<slug>.test.ts`
Run: `cd target/pollinations && ./node_modules/.bin/vitest run --config vitest.poc.config.ts poc/<slug>.test.ts`
Alias `@shared` → `target/pollinations/shared/` is configured.

**Full sweep** (all tiers, from repo root):
```bash
node scripts/run-pocs.mjs            # all workers + root tier
node scripts/run-pocs.mjs enter gen  # subset
node scripts/list-pocs.mjs           # inventory
```

## 3. THE ASSERTION RULE (what makes a PoC valid)
A PoC **must assert the vulnerable behaviour and therefore PASS on the current
code**. If your exploit does not reproduce, the hypothesis is dead: **delete the
PoC and report the negative result** — a red/green ambiguity or a skipped test is
NOT acceptable, and a fabricated “finding” is a catastrophic failure.
- Assert on the *observable effect*: HTTP status, response body, DB row, R2 object,
  money movement, auth decision, cross-tenant data leak.
- Print quotable evidence with `console.log("[poc] ...")` (the orchestrator captures
  stdout; `disableConsoleIntercept: true` is set in the worker configs so logging
  works).
- Keep every PoC under ~200 lines, one vulnerability per file.
- No network: mock every external call (`mocks.*` in enter, `vi.stubGlobal`,
  `vi.mock`, or a local `fetch` stub) — otherwise the workerd pool may try to reach
  the public internet.
- Use `it`/`describe` from `vitest` (or `test` from `../fixtures.ts` in enter).

## 4. Distinctness — do NOT re-report bugs #40–#127
Prior findings are indexed in `.newera/cyber/archive/pollinations-bugs-40-127/00-SEVERITY-INDEX.md`
(read the individual files for details). **Read the index before you start.**
A new PoC is only valid if it demonstrates a *different* root cause.
- You MUST cite the nearest prior issue number and explain in ONE line why the new
  finding is distinct (different code path / different root cause / different impact).
- If your candidate is the same root cause as a prior issue (e.g. another instance
  of “community usage forgery”, “stored XSS on media”, “cache is identity-blind”),
  it is a DUPLICATE → drop it and find something else.

## 5. What counts as a high-value finding
Prioritise, in this order:
1. **Account takeover / auth bypass** — session, device, OAuth, consent, key minting.
2. **Money** — pollen wallet races, unbilled spend, refund/chargeback, top-up,
   auto-top-up, price/promo abuse, quota or budget bypass.
3. **Cross-tenant data exposure** — IDOR, private model/asset leaks, secret leakage.
4. **Injection with real impact** — stored XSS on a trusted origin, SSRF to
   internal/metadata endpoints, prompt injection into a privileged agent that
   holds live tokens, sandbox escape, arbitrary file read.
5. **Resource abuse with financial impact** — unbounded upload/session/queue,
   uncapped agent compute, shared-token quota exhaustion.
6. **CSRF / origin-missing checks** on state-changing routes.
Only report things an external attacker can actually trigger.

## 6. Your deliverable (per wave)
1. The PoC file(s) — created and **verified green** (`vitest run` exits 0).
2. A findings summary in your final message, one line per PoC:
   `<slug> | severity(critical/high/medium) | worker-tier | one-line vuln | nearest-prior-issue #N and why distinct | exact test command + pass count`
3. If a candidate did NOT reproduce: list it under `negative results (do not report)`
   with the exact error output. Negative results are valuable — they prove rigour.
4. Never claim a vulnerability you did not execute end-to-end.
