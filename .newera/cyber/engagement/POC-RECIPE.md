# PoC RECIPE — pollinations/pollinations authorized assessment (LOOPBACK ONLY)

## 0. Authorization / scope
- Scope file: `.newera/cyber/scope.json`. **Only** loopback (`http://127.0.0.1:*`, `http://localhost:*`)
  and the vendored upstream source tree may be touched.
- **NEVER** scan or send traffic to `pollinations.ai`, `gen.pollinations.ai`,
  `enter.pollinations.ai`, `media.pollinations.ai` or any third-party host.
- No DoS, no bulk resource exhaustion, no live data mutation, no real credentials.
- Never modify upstream source files. Only ADD new files under `test/poc/**`.

## 1. Layout
- Vendored upstream source: `target/pollinations/`
  - `target/pollinations/enter.pollinations.ai/`  (auth, account, keys, billing, quests, agents)
  - `target/pollinations/gen.pollinations.ai/`    (generation gateway, cache, moderation, MCP apps, code agents)
  - `target/pollinations/media.pollinations.ai/` (R2 uploads, galleries, XSS surface)
  - `target/pollinations/shared/`                 (auth, billing, middleware, registry)
- **PoC file location** (durable, tracked by root git):
  `target/pollinations/<worker-dir>/test/poc/<slug>.test.ts`
- Run one PoC:
  ```bash
  cd target/pollinations/enter.pollinations.ai
  npx vitest run test/poc/<slug>.test.ts
  ```
  (the worker dir has its own `vitest.config.ts` → `@cloudflare/vitest-pool-workers`
  → **real workerd pool, real D1 + KV + R2 bindings, real Worker routes via `SELF.fetch`**)
- Run ALL PoCs of a worker:
  ```bash
  cd target/pollinations/enter.pollinations.ai && npx vitest run --dir test/poc
  ```
- Repo-root orchestrator: `node scripts/run-pocs.mjs enter gen media shared`

## 2. Minimal PoC skeleton (enter worker)
```ts
import { env, SELF } from "cloudflare:test";
import { describe, expect } from "vitest";
import { test } from "../fixtures.ts"; // enter only: gives auth/sessionToken/apiKey/mocks

describe("wave-xx <slug>", () => {
    test("exploit reproduces", async ({ apiKey, accountToken, mocks }) => {
        // 1. arrange attacker-controlled input
        // 2. call the REAL route through SELF.fetch
        const res = await SELF.fetch("http://localhost:3000/api/...", {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        // 3. ASSERT THE VULNERABLE BEHAVIOUR (the exploit SUCCEEDS)
        expect(res.status).toBe(200); // <-- vulnerable behaviour
    });
});
```
**Conventions that matter**
- A PoC asserts the *vulnerable* behaviour. It MUST **PASS** on the current code.
  If the code is already hardened, the hypothesis is dead — say so, do not fake it.
- Log the observed evidence with `console.log("[poc] ...")` so the run output is quotable.
- No `describe` block may hit the public network: mock it (`mocks.github`, `mocks.stripe`,
  `mocks.tinybird`, `mocks.discord`, `mocks.google`) or use `vi.stubGlobal`/fetch mock.
- One PoC file = one vulnerability. Keep each file under ~200 lines.

## 3. Issue markdown template (write at REPO ROOT as `issue<N>.md`)
```markdown
# Issue <N> — <one-line title>

**Severity:** Critical | High | Medium
**Component:** <worker>/<path>
**Status:** Verified locally (PoC passes) — not exploited against production

## Summary
<2–5 sentences: what is wrong, why an attacker wins>

## Affected code
- `path/to/file.ts:LINE-LINE` — <what it does>
<exact snippets, 3–15 lines each>

## Root cause
<mechanism, with the exact comparison/parse/await that fails>

## Attacker path (end-to-end)
1. …
2. …

## Proof of concept (executed, output below)
PoC file: `target/pollinations/<worker>/test/poc/<slug>.test.ts`
Command:
```bash
cd target/pollinations/<worker> && npx vitest run test/poc/<slug>.test.ts
```
Observed output (verbatim):
```
<paste the real run output>
```

## Impact
<attacker capability, blast radius, financial effect>

## Severity rationale
<why this severity>

## Remediation
<concrete patch suggestion>

## Dedupe note
<why this is NOT a duplicate of archived issues #40–#127; cite the closest one and the difference>

## Notes / limitations
<what was not tested>
```

## 4. Evidence discipline (hard rules)
- **NEVER** claim a vulnerability without a PoC that PASSES in this environment.
- Paste the **verbatim** vitest output (test name, PASS line, your `console.log` evidence).
- If a PoC does not pass, fix the PoC or drop the hypothesis — never fabricate output.
- Check the archived list before reporting: `target/archive/pollinations-bugs-40-127/00-SEVERITY-INDEX.md`
  (88 prior findings #40–#127). New findings must be distinct; cite the nearest prior one.
- Severity: Critical = full account takeover / RCE / cross-tenant secret exposure / direct financial theft;
  High = significant privilege escalation, unbounded financial drain, auth bypass, stored XSS with account impact;
  Medium = DoS amplification, info leak, weak enforcement.

## 5. Agent output contract
For each verified finding, produce:
1. `target/pollinations/<worker>/test/poc/<slug>.test.ts` (runs green)
2. `<repo-root>/issue<N>.md` using the template, with real output pasted
3. A one-line summary back to the orchestrator: `issue<N> | Severity | slug | worker | command`
