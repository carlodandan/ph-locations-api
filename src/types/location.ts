// ---------------------------------------------------------------------------
// Raw JSON data shapes (as they exist in data/lgu/*.json)
// ---------------------------------------------------------------------------

/** A city entry inside a raw JSON file */
export interface RawCity {
  city: string;
  zip_code?: string;
}

/** A municipality entry inside a raw JSON file */
export interface RawMunicipality {
  municipality: string;
  zip_code?: string;
}

/**
 * A province block inside a province-nested region file.
 * A province may contain cities, municipalities, or both.
 */
export interface RawProvince {
  province: string;
  cities?: RawCity[];
  municipalities?: RawMunicipality[];
}

export interface RawRegionData {
  slug: string;
  provinces?: RawProvince[];
  cities?: RawCity[];
  municipalities?: RawMunicipality[];
}

export interface RawBarangayFile {
  slug: string;
  locations: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Normalised API types (returned to callers)
// ---------------------------------------------------------------------------

export interface Region {
  name: string;
  slug: string;
}

export interface Location {
  name: string;
  slug: string;
  type: "city" | "municipality";
  zip_code: string | null;
  province: string | null;
}

export interface Barangay {
  name: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// Search result shape
// ---------------------------------------------------------------------------

export interface SearchResult {
  type: "region" | "city" | "municipality";
  name: string;
  slug: string;
  region: {
    name: string;
    slug: string;
  };
  /** null for flat regions */
  province: string | null;
  zip_code?: string | null;
}

// ---------------------------------------------------------------------------
// Cloudflare Workers environment bindings
// ---------------------------------------------------------------------------

export interface Env {
  /**
   * Comma-separated list of allowed CORS origins.
   * Use "*" to allow all origins (development / public APIs).
   */
  CORS_ORIGINS: string;
}
