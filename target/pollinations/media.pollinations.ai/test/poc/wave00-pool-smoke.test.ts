import { SELF } from "cloudflare:test";
import { describe, expect, test } from "vitest";

describe("wave-00 media pool smoke", () => {
    test("workerd pool boots and SELF routes", async () => {
        const res = await SELF.fetch("http://localhost/");
        console.log("[poc] media pool booted, GET / ->", res.status);
        expect(res.status).toBeGreaterThan(0);
    });
});
