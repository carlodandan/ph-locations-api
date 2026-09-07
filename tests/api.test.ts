/**
 * API integration tests
 *
 * Uses @cloudflare/vitest-pool-workers to run the actual Worker in a
 * Miniflare environment so tests accurately reflect production behaviour.
 */

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string, method = "GET"): Request {
  return new Request(`https://example.com${path}`, { method });
}

async function get(path: string) {
  const req = makeRequest(path);
  const res = await worker.fetch(req, env, {} as ExecutionContext);
  const body = await res.json();
  return { res, body };
}

// ---------------------------------------------------------------------------
// GET /api/regions
// ---------------------------------------------------------------------------

describe("GET /api/regions", () => {
  it("returns 200 with a data array", async () => {
    const { res, body } = await get("/api/regions");
    expect(res.status).toBe(200);
    expect(body).toHaveProperty("data");
    expect(Array.isArray((body as { data: unknown }).data)).toBe(true);
  });

  it("each region has name and slug", async () => {
    const { body } = await get("/api/regions");
    const data = (body as { data: { name: string; slug: string }[] }).data;
    expect(data.length).toBeGreaterThan(0);
    for (const region of data) {
      expect(typeof region.name).toBe("string");
      expect(typeof region.slug).toBe("string");
    }
  });

  it("includes national-capital-region", async () => {
    const { body } = await get("/api/regions");
    const data = (body as { data: { slug: string }[] }).data;
    expect(data.some((r) => r.slug === "national-capital-region")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/regions/:region
// ---------------------------------------------------------------------------

describe("GET /api/regions/:region", () => {
  it("returns 200 for an existing region", async () => {
    const { res, body } = await get("/api/regions/national-capital-region");
    expect(res.status).toBe(200);
    const data = (body as { data: { name: string; slug: string } }).data;
    expect(data.slug).toBe("national-capital-region");
    expect(data.name).toBe("NATIONAL CAPITAL REGION");
  });

  it("returns 404 for a non-existent region", async () => {
    const { res, body } = await get("/api/regions/does-not-exist");
    expect(res.status).toBe(404);
    const err = (body as { error: { code: string } }).error;
    expect(err.code).toBe("REGION_NOT_FOUND");
  });

  it("returns 400 for an invalid slug", async () => {
    const { res, body } = await get("/api/regions/../etc/passwd");
    // The path-traversal attempt either hits 404 (unmatched route) or 400
    expect([400, 404]).toContain(res.status);
    void body;
  });
});

// ---------------------------------------------------------------------------
// GET /api/regions/:region/locations
// ---------------------------------------------------------------------------

describe("GET /api/regions/:region/locations", () => {
  it("returns all locations for NCR", async () => {
    const { res, body } = await get(
      "/api/regions/national-capital-region/locations",
    );
    expect(res.status).toBe(200);
    const data = (body as { data: unknown[] }).data;
    expect(data.length).toBeGreaterThan(0);
  });

  it("each location has name, slug, type, zip_code, province", async () => {
    const { body } = await get(
      "/api/regions/national-capital-region/locations",
    );
    const data = (
      body as {
        data: {
          name: string;
          slug: string;
          type: string;
          zip_code: string | null;
          province: string | null;
        }[];
      }
    ).data;
    for (const loc of data) {
      expect(typeof loc.name).toBe("string");
      expect(typeof loc.slug).toBe("string");
      expect(["city", "municipality"]).toContain(loc.type);
      // zip_code is string or null
      expect(loc.zip_code === null || typeof loc.zip_code === "string").toBe(
        true,
      );
      // province is null for NCR (flat region)
      expect(loc.province).toBeNull();
    }
  });

  it("province-nested region returns province field", async () => {
    const { body } = await get("/api/regions/region-iva-calabarzon/locations");
    const data = (body as { data: { province: string | null }[] }).data;
    // CALABARZON has provinces — at least one location should have a non-null province
    expect(data.some((l) => l.province !== null)).toBe(true);
  });

  it("returns 404 for unknown region", async () => {
    const { res } = await get("/api/regions/unknown-region-xyz/locations");
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/regions/:region/cities
// ---------------------------------------------------------------------------

describe("GET /api/regions/:region/cities", () => {
  it("returns only cities", async () => {
    const { res, body } = await get(
      "/api/regions/national-capital-region/cities",
    );
    expect(res.status).toBe(200);
    const data = (body as { data: { type: string }[] }).data;
    expect(data.length).toBeGreaterThan(0);
    for (const loc of data) {
      expect(loc.type).toBe("city");
    }
  });

  it("NCR cities include Makati", async () => {
    const { body } = await get("/api/regions/national-capital-region/cities");
    const data = (body as { data: { name: string }[] }).data;
    expect(data.some((l) => l.name === "Makati")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/regions/:region/municipalities
// ---------------------------------------------------------------------------

describe("GET /api/regions/:region/municipalities", () => {
  it("returns only municipalities", async () => {
    const { res, body } = await get(
      "/api/regions/national-capital-region/municipalities",
    );
    expect(res.status).toBe(200);
    const data = (body as { data: { type: string }[] }).data;
    expect(data.length).toBeGreaterThan(0);
    for (const loc of data) {
      expect(loc.type).toBe("municipality");
    }
  });

  it("NCR municipalities include Pateros", async () => {
    const { body } = await get(
      "/api/regions/national-capital-region/municipalities",
    );
    const data = (body as { data: { name: string }[] }).data;
    expect(data.some((l) => l.name === "Pateros")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/regions/:region/towns
// ---------------------------------------------------------------------------

describe("GET /api/regions/:region/towns", () => {
  it("returns 200 with an empty data array", async () => {
    const { res, body } = await get(
      "/api/regions/national-capital-region/towns",
    );
    expect(res.status).toBe(200);
    const data = (body as { data: unknown[] }).data;
    expect(data).toEqual([]);
  });

  it("includes an X-Note header explaining the empty result", async () => {
    const req = makeRequest("/api/regions/national-capital-region/towns");
    const res = await worker.fetch(req, env, {} as ExecutionContext);
    expect(res.headers.get("X-Note")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/regions/:region/locations/:location
// ---------------------------------------------------------------------------

describe("GET /api/regions/:region/locations/:location", () => {
  it("returns a specific location — Angono in CALABARZON", async () => {
    const { res, body } = await get(
      "/api/regions/region-iva-calabarzon/locations/angono",
    );
    expect(res.status).toBe(200);
    const data = (
      body as { data: { name: string; type: string; zip_code: string | null } }
    ).data;
    expect(data.name).toBe("Angono");
    expect(data.type).toBe("municipality");
    expect(data.zip_code).toBe("1930");
  });

  it("returns 404 for unknown location", async () => {
    const { res } = await get(
      "/api/regions/national-capital-region/locations/atlantis",
    );
    expect(res.status).toBe(404);
  });

  it("location without zip_code returns null", async () => {
    // Calaca in Batangas has no zip_code in the source data
    const { body } = await get(
      "/api/regions/region-iva-calabarzon/locations/calaca",
    );
    const data = (body as { data: { zip_code: string | null } }).data;
    expect(data.zip_code).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /api/regions/:region/locations/:location/barangays
// ---------------------------------------------------------------------------

describe("GET .../barangays", () => {
  it("returns actual barangay data for a valid location", async () => {
    const { res, body } = await get(
      "/api/regions/national-capital-region/locations/makati/barangays",
    );
    expect(res.status).toBe(200);
    const data = (
      body as { data: { barangays: { name: string; slug: string }[] } }
    ).data;
    expect(data.barangays.length).toBeGreaterThan(0);
    // Makati has Bel-Air
    expect(data.barangays.find((b) => b.slug === "bel-air")).toBeDefined();
  });

  it("returns empty array for location with no barangay data", async () => {
    const { res, body } = await get(
      "/api/regions/special-geographic-area/locations/kadayangan/barangays",
    );
    expect(res.status).toBe(200);
    const data = (body as { data: { barangays: unknown[] } }).data;
    expect(data.barangays).toEqual([]);
    expect(res.headers.get("X-Note")).toBe(
      "No barangay data is available for this location.",
    );
  });

  it("returns 404 for unknown parent location", async () => {
    const { res } = await get(
      "/api/regions/national-capital-region/locations/atlantis/barangays",
    );
    expect(res.status).toBe(404);
  });

  it("individual barangay returns data if found", async () => {
    const req = makeRequest(
      "/api/regions/national-capital-region/locations/makati/barangays/bel-air",
    );
    const res = await worker.fetch(req, env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { name: string; slug: string } };
    expect(body.data.name).toBe("Bel-Air");
    expect(body.data.slug).toBe("bel-air");
  });

  it("individual barangay returns 404 if not found", async () => {
    const req = makeRequest(
      "/api/regions/national-capital-region/locations/makati/barangays/fake-barangay",
    );
    const res = await worker.fetch(req, env, {} as ExecutionContext);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("BARANGAY_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// GET /api/search
// ---------------------------------------------------------------------------

describe("GET /api/search", () => {
  it("finds Angono by exact name", async () => {
    const { res, body } = await get("/api/search?q=angono");
    expect(res.status).toBe(200);
    const data = (body as { data: { name: string }[] }).data;
    expect(data.some((r) => r.name === "Angono")).toBe(true);
  });

  it("partial match: 'ang' finds Angono and Angeles etc.", async () => {
    const { body } = await get("/api/search?q=ang");
    const data = (body as { data: { name: string }[] }).data;
    expect(data.length).toBeGreaterThan(1);
    for (const result of data) {
      expect(result.name.toLowerCase()).toContain("ang");
    }
  });

  it("case-insensitive search", async () => {
    const { body: lower } = await get("/api/search?q=makati");
    const { body: upper } = await get("/api/search?q=MAKATI");
    const lData = (lower as { data: unknown[] }).data;
    const uData = (upper as { data: unknown[] }).data;
    expect(lData.length).toBe(uData.length);
  });

  it("search result includes region metadata", async () => {
    const { body } = await get("/api/search?q=makati");
    const data = (
      body as { data: { region: { name: string; slug: string } }[] }
    ).data;
    const makati = data.find((r) => (r as { name?: string }).name === "Makati");
    expect(makati).toBeDefined();
    expect(makati?.region.slug).toBe("national-capital-region");
  });

  it("returns 400 for empty query", async () => {
    const { res } = await get("/api/search?q=");
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing query parameter", async () => {
    const { res } = await get("/api/search");
    expect(res.status).toBe(400);
  });

  it("returns 400 for query exceeding 100 chars", async () => {
    const longQ = "a".repeat(101);
    const { res } = await get(`/api/search?q=${longQ}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

describe("CORS", () => {
  it("includes CORS headers on GET responses", async () => {
    const req = makeRequest("/api/regions");
    const res = await worker.fetch(req, env, {} as ExecutionContext);
    // With CORS_ORIGINS=* (default in wrangler.jsonc), the header is "*"
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });

  it("OPTIONS returns 204 with CORS headers", async () => {
    const req = makeRequest("/api/regions", "OPTIONS");
    const res = await worker.fetch(req, env, {} as ExecutionContext);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("non-GET/OPTIONS returns 405", async () => {
    const req = makeRequest("/api/regions", "POST");
    const res = await worker.fetch(req, env, {} as ExecutionContext);
    expect(res.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------

describe("404 fallback", () => {
  it("unknown routes return 404", async () => {
    const { res } = await get("/api/unknown-route");
    expect(res.status).toBe(404);
  });

  it("root path returns 404", async () => {
    const { res } = await get("/");
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Error response shape
// ---------------------------------------------------------------------------

describe("Error response shape", () => {
  it("errors have code and message fields", async () => {
    const { body } = await get("/api/regions/does-not-exist");
    const err = (body as { error: { code: string; message: string } }).error;
    expect(typeof err.code).toBe("string");
    expect(typeof err.message).toBe("string");
  });
});
