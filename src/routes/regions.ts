// Region routes

import { getRegion, getRegions } from "../lib/data.js";
import { errorResponse, json } from "../lib/response.js";
import { isValidSlug } from "../lib/validation.js";
import type { Env } from "../types/location.js";

/** GET /api/regions */
export function handleGetRegions(request: Request, env: Env): Response {
  const regions = getRegions();
  return json(request, env, { data: regions });
}

/** GET /api/regions/:region */
export function handleGetRegion(
  request: Request,
  env: Env,
  regionSlug: string,
): Response {
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

  return json(request, env, { data: region });
}
