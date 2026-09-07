import type { Env } from "../types/location.js";

// CORS helpers

/** Build the CORS headers for a given request based on CORS_ORIGINS. */
function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const allowedOrigins = env.CORS_ORIGINS ?? "*";
  const requestOrigin = request.headers.get("Origin") ?? "";

  let allowOrigin: string;

  if (allowedOrigins.trim() === "*") {
    allowOrigin = "*";
  } else {
    const origins = allowedOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    allowOrigin = origins.includes(requestOrigin) ? requestOrigin : "";
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    if (allowOrigin !== "*") {
      headers["Vary"] = "Origin";
    }
  }

  return headers;
}

// Cache-Control

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=3600";

// Response helpers

/** Return a JSON response with consistent headers. */
export function json(
  request: Request,
  env: Env,
  data: unknown,
  status: number = 200,
  extra: HeadersInit = {},
): Response {
  const corsHeaders = getCorsHeaders(request, env);

  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": CACHE_CONTROL,
      ...extra,
    },
  });
}

/** Return a consistent JSON error response. */
export function errorResponse(
  request: Request,
  env: Env,
  code: string,
  message: string,
  status: number,
  extra: HeadersInit = {},
): Response {
  const corsHeaders = getCorsHeaders(request, env);

  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: {
        ...corsHeaders,
        // Errors should not be cached
        "Cache-Control": "no-store",
        ...extra,
      },
    },
  );
}

/** Handle CORS pre-flight requests. */
export function preflight(request: Request, env: Env): Response {
  const corsHeaders = getCorsHeaders(request, env);

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
