import { test, expect } from "vitest";
import worker from "../src/index.ts";

test("rate limiting", async () => {
  const env = {};

  // Send 60 requests, should be ok
  for (let i = 0; i < 60; i++) {
    const req = new Request("http://localhost/api/regions", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    const res = await worker.fetch(req, env as any);
    expect(res.status).toBe(200);
  }

  // 61st request should fail
  const req = new Request("http://localhost/api/regions", {
    headers: { "cf-connecting-ip": "1.2.3.4" },
  });
  const res = await worker.fetch(req, env as any);
  expect(res.status).toBe(429);

  const body = await res.json();
  expect(body.error.code).toBe("RATE_LIMITED");

  // Another IP should be ok
  const req2 = new Request("http://localhost/api/regions", {
    headers: { "cf-connecting-ip": "5.6.7.8" },
  });
  const res2 = await worker.fetch(req2, env as any);
  expect(res2.status).toBe(200);
});
