// Location routes

import {
  flattenLocations,
  getBarangays,
  getRegion,
  getRegionData,
} from "../lib/data.js";
import { errorResponse, json } from "../lib/response.js";
import { isValidSlug } from "../lib/validation.js";
import type { Env, Location } from "../types/location.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Validate region slug, look up region + data, and return normalised locations. */
function resolveRegionLocations(
  request: Request,
  env: Env,
  regionSlug: string,
): { locations: Location[] } | Response {
  if (!isValidSlug(regionSlug)) {
    return errorResponse(
      request,
      env,
      "INVALID_SLUG",
      "Region slug contains invalid characters.",
      400,
    );
  }

  const region = getRegion(regionSlug);
  if (!region) {
    return errorResponse(
      request,
      env,
      "REGION_NOT_FOUND",
      "Region not found.",
      404,
    );
  }

  const data = getRegionData(regionSlug);
  if (!data) {
    // Should never happen if regions.json and lgu/ files are in sync,
    // but handle gracefully anyway.
    return errorResponse(
      request,
      env,
      "DATA_UNAVAILABLE",
      "Location data for this region is unavailable.",
      500,
    );
  }

  return { locations: flattenLocations(data) };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** GET /api/regions/:region/locations */
export function handleGetLocations(
  request: Request,
  env: Env,
  regionSlug: string,
): Response {
  const result = resolveRegionLocations(request, env, regionSlug);
  if (result instanceof Response) return result;

  return json(request, env, { data: result.locations });
}

/** GET /api/regions/:region/cities */
export function handleGetCities(
  request: Request,
  env: Env,
  regionSlug: string,
): Response {
  const result = resolveRegionLocations(request, env, regionSlug);
  if (result instanceof Response) return result;

  const cities = result.locations.filter((l) => l.type === "city");
  return json(request, env, { data: cities });
}

/** GET /api/regions/:region/municipalities */
export function handleGetMunicipalities(
  request: Request,
  env: Env,
  regionSlug: string,
): Response {
  const result = resolveRegionLocations(request, env, regionSlug);
  if (result instanceof Response) return result;

  const municipalities = result.locations.filter(
    (l) => l.type === "municipality",
  );
  return json(request, env, { data: municipalities });
}

/** GET /api/regions/:region/towns */
export function handleGetTowns(
  request: Request,
  env: Env,
  regionSlug: string,
): Response {
  const result = resolveRegionLocations(request, env, regionSlug);
  if (result instanceof Response) return result;

  return json(request, env, { data: [] }, 200, {
    "X-Note":
      "The current dataset contains no locations of type 'town'. " +
      "All locations are classified as 'city' or 'municipality'.",
  });
}

/** GET /api/regions/:region/locations/:location */
export function handleGetLocation(
  request: Request,
  env: Env,
  regionSlug: string,
  locationSlug: string,
): Response {
  if (!isValidSlug(locationSlug)) {
    return errorResponse(
      request,
      env,
      "INVALID_SLUG",
      "Location slug contains invalid characters.",
      400,
    );
  }

  const result = resolveRegionLocations(request, env, regionSlug);
  if (result instanceof Response) return result;

  const location = result.locations.find((l) => l.slug === locationSlug);

  if (!location) {
    return errorResponse(
      request,
      env,
      "LOCATION_NOT_FOUND",
      "Location not found.",
      404,
    );
  }

  return json(request, env, { data: location });
}

/** GET /api/regions/:region/locations/:location/barangays */
export function handleGetBarangays(
  request: Request,
  env: Env,
  regionSlug: string,
  locationSlug: string,
): Response {
  if (!isValidSlug(locationSlug)) {
    return errorResponse(
      request,
      env,
      "INVALID_SLUG",
      "Location slug contains invalid characters.",
      400,
    );
  }

  // Validate region + location exist first
  const result = resolveRegionLocations(request, env, regionSlug);
  if (result instanceof Response) return result;

  const location = result.locations.find((l) => l.slug === locationSlug);
  if (!location) {
    return errorResponse(
      request,
      env,
      "LOCATION_NOT_FOUND",
      "Location not found.",
      404,
    );
  }

  const barangays = getBarangays(regionSlug, location.slug);

  const responseData = {
    ...location,
    barangays: barangays ?? [],
  };

  const extraHeaders: HeadersInit = {};
  if (barangays === null) {
    extraHeaders["X-Note"] = "No barangay data is available for this location.";
  }

  return json(request, env, { data: responseData }, 200, extraHeaders);
}

/** GET /api/regions/:region/locations/:location/barangays/:barangay */
export function handleGetBarangay(
  request: Request,
  env: Env,
  regionSlug: string,
  locationSlug: string,
  barangaySlug: string,
): Response {
  if (!isValidSlug(barangaySlug)) {
    return errorResponse(
      request,
      env,
      "INVALID_SLUG",
      "Barangay slug contains invalid characters.",
      400,
    );
  }

  // Validate parent region + location exist first
  const result = resolveRegionLocations(request, env, regionSlug);
  if (result instanceof Response) return result;

  const location = result.locations.find((l) => l.slug === locationSlug);
  if (!location) {
    return errorResponse(
      request,
      env,
      "LOCATION_NOT_FOUND",
      "Location not found.",
      404,
    );
  }

  const barangays = getBarangays(regionSlug, location.slug);

  if (barangays === null) {
    return errorResponse(
      request,
      env,
      "BARANGAY_NOT_FOUND",
      "No barangay data is available for this location.",
      404,
    );
  }

  const barangay = barangays.find((b) => b.slug === barangaySlug);

  if (!barangay) {
    return errorResponse(
      request,
      env,
      "BARANGAY_NOT_FOUND",
      "Barangay not found.",
      404,
    );
  }

  return json(request, env, { data: barangay });
}
