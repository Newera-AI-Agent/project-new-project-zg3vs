import { expect } from "vitest";
import { test } from "../fixtures.ts";

test("smoke: account token auth works", async ({ accountToken }) => {
    const res = await SELF.fetch("http://localhost:3000/api/account/keys", {
        headers: { Authorization: `Bearer ${accountToken}` },
    });
    console.log("[smoke] keys status", res.status);
    expect(res.status).toBe(200);
});
