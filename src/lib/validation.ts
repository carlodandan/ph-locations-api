// Validation utilities.

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_SLUG_LENGTH = 120;
const MAX_SEARCH_LENGTH = 100;
const MIN_SEARCH_LENGTH = 1;

/** Check that a URL path segment looks like a valid slug. */
export function isValidSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(slug)
  );
}

/** Validate and normalise a search query string. */
export function validateSearchQuery(
  raw: string | null,
): { ok: true; query: string } | { ok: false; reason: string } {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "Query parameter 'q' is required." };
  }

  const trimmed = raw.trim();

  if (trimmed.length < MIN_SEARCH_LENGTH) {
    return {
      ok: false,
      reason: "Query parameter 'q' must not be empty.",
    };
  }

  if (trimmed.length > MAX_SEARCH_LENGTH) {
    return {
      ok: false,
      reason: `Query parameter 'q' must not exceed ${MAX_SEARCH_LENGTH} characters.`,
    };
  }

  return { ok: true, query: trimmed };
}
