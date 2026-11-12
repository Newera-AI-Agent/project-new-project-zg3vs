import { SELF, env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

describe("wave-00 gen pool smoke", () => {
    test("workerd pool boots and SELF routes", async () => {
        expect(env).toBeDefined();
        const res = await SELF.fetch("http://localhost/");
        console.log("[poc] gen pool booted, GET / ->", res.status);
        expect(res.status).toBeGreaterThan(0);
    });
});
