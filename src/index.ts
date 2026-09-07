import { checkRateLimit } from "./lib/ratelimit.js";
import { errorResponse, preflight } from "./lib/response.js";
import {
  handleGetBarangay,
  handleGetBarangays,
  handleGetCities,
  handleGetLocation,
  handleGetLocations,
  handleGetMunicipalities,
  handleGetTowns,
} from "./routes/locations.js";
import { handleGetRegion, handleGetRegions } from "./routes/regions.js";
import { handleSearch } from "./routes/search.js";
import type { Env } from "./types/location.js";

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/api/search") {
    return handleSearch(request, env);
  }

  if (pathname === "/api/regions" || pathname === "/api/regions/") {
    return handleGetRegions(request, env);
  }

  const regionMatch = pathname.match(/^\/api\/regions\/([^/]+)(\/.*)?$/);
  if (regionMatch) {
    const regionSlug = regionMatch[1] ?? "";
    const subPath = regionMatch[2] ?? "";

    if (subPath === "" || subPath === "/") {
      return handleGetRegion(request, env, regionSlug);
    }

    const barangayMatch = subPath.match(
      /^\/locations\/([^/]+)\/barangays\/([^/]+)\/?$/,
    );
    if (barangayMatch) {
      const locationSlug = barangayMatch[1] ?? "";
      const barangaySlug = barangayMatch[2] ?? "";
      return handleGetBarangay(
        request,
        env,
        regionSlug,
        locationSlug,
        barangaySlug,
      );
    }

    const barangaysMatch = subPath.match(
      /^\/locations\/([^/]+)\/barangays\/?$/,
    );
    if (barangaysMatch) {
      const locationSlug = barangaysMatch[1] ?? "";
      return handleGetBarangays(request, env, regionSlug, locationSlug);
    }

    const locationMatch = subPath.match(/^\/locations\/([^/]+)\/?$/);
    if (locationMatch) {
      const locationSlug = locationMatch[1] ?? "";
      return handleGetLocation(request, env, regionSlug, locationSlug);
    }

    if (subPath === "/locations" || subPath === "/locations/") {
      return handleGetLocations(request, env, regionSlug);
    }

    if (subPath === "/cities" || subPath === "/cities/") {
      return handleGetCities(request, env, regionSlug);
    }

    if (subPath === "/municipalities" || subPath === "/municipalities/") {
      return handleGetMunicipalities(request, env, regionSlug);
    }

    if (subPath === "/towns" || subPath === "/towns/") {
      return handleGetTowns(request, env, regionSlug);
    }

    return errorResponse(request, env, "NOT_FOUND", "Route not found.", 404);
  }

  return errorResponse(request, env, "NOT_FOUND", "Route not found.", 404);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const method = request.method.toUpperCase();

    // 1. CORS Preflight
    if (method === "OPTIONS") {
      return preflight(request, env);
    }

    // 2. Rate Limiting
    const rateLimitResponse = checkRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;

    // Only GET is supported for data endpoints
    if (method !== "GET") {
      return errorResponse(
        request,
        env,
        "METHOD_NOT_ALLOWED",
        "Only GET and OPTIONS requests are supported.",
        405,
      );
    }

    // 3. Cache API check
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      // Add a header so we can verify cache hits in tests/debugging
      const response = new Response(cachedResponse.body, cachedResponse);
      response.headers.set("X-Cache", "HIT");
      return response;
    }

    // 4. Route the request
    const response = await routeRequest(request, env);

    // 5. Store in cache if successful (200 OK)
    if (response.status === 200) {
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        await cache.put(cacheKey, response.clone());
      }
      response.headers.set("X-Cache", "MISS");
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
