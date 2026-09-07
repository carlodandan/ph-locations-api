import { test, expect } from "vitest";
import worker from "../src/index.ts";

test("caching", async () => {
  const env = {};

  // First request
  const req = new Request("http://localhost/api/regions");
  const res = await worker.fetch(req, env as any, {} as any);
  expect(res.status).toBe(200);
  expect(res.headers.get("X-Cache")).toBe("MISS");

  // Second request
  const req2 = new Request("http://localhost/api/regions");
  const res2 = await worker.fetch(req2, env as any, {} as any);
  expect(res2.status).toBe(200);
  expect(res2.headers.get("X-Cache")).toBe("HIT");
});
