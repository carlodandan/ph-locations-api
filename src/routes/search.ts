// Search routes

import { search } from "../lib/data.js";
import { errorResponse, json } from "../lib/response.js";
import { validateSearchQuery } from "../lib/validation.js";
import type { Env } from "../types/location.js";

/** GET /api/search?q=... */
export function handleSearch(request: Request, env: Env): Response {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q");

  const validation = validateSearchQuery(rawQuery);

  if (!validation.ok) {
    return errorResponse(request, env, "INVALID_QUERY", validation.reason, 400);
  }

  const results = search(validation.query);

  return json(request, env, { data: results });
}
