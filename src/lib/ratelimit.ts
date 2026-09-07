import { errorResponse } from "./response.js";
import type { Env } from "../types/location.js";

// Basic in-memory rate limiter (per Cloudflare isolate)
// Since we are not using KV/D1/Redis, this limits requests per edge node.
// This is perfectly fine for basic protection against spam/abuse.

const MAX_REQUESTS = 60; // 60 requests per minute per IP
const WINDOW_MS = 60 * 1000; // 1 minute

let rateLimitMap = new Map<string, number>();
let windowStart = Date.now();

export function checkRateLimit(request: Request, env: Env): Response | null {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    rateLimitMap.clear();
    windowStart = now;
  }

  const count = (rateLimitMap.get(ip) ?? 0) + 1;
  rateLimitMap.set(ip, count);

  if (count > MAX_REQUESTS) {
    return errorResponse(
      request,
      env,
      "RATE_LIMITED",
      "Too many requests. Please try again later.",
      429,
      {
        "Retry-After": "60",
      },
    );
  }

  return null;
}
