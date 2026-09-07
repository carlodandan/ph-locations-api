/**
 * Data validation script
 *
 * Run with:  pnpm validate-data
 *
 * Checks:
 *  1. Every slug in regions.json has a corresponding data/lgu/<slug>.json
 *  2. Every data/lgu/*.json has a matching entry in regions.json
 *  3. JSON files are valid (readFileSync + JSON.parse)
 *  4. Each location within a region has a unique slug
 *  5. Reports totals (files, locations, largest region)
 */

import { readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const LGU_DIR = join(DATA_DIR, "lgu");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Region {
  name: string;
  slug: string;
}

interface RawCity {
  city: string;
  zip_code?: string;
}

interface RawMunicipality {
  municipality: string;
  zip_code?: string;
}

interface RawProvince {
  province: string;
  cities?: RawCity[];
  municipalities?: RawMunicipality[];
}

interface RawRegionData {
  slug: string;
  provinces?: RawProvince[];
  cities?: RawCity[];
  municipalities?: RawMunicipality[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let errors = 0;
let warnings = 0;

function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function warn(msg: string) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function fail(msg: string) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function section(title: string) {
  console.log(`\n── ${title} ──`);
}

function readJson<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function flattenLocations(
  data: RawRegionData,
): { name: string; hasZip: boolean }[] {
  const result: { name: string; hasZip: boolean }[] = [];

  if (data.provinces) {
    for (const p of data.provinces) {
      for (const c of p.cities ?? [])
        result.push({ name: c.city, hasZip: !!c.zip_code });
      for (const m of p.municipalities ?? [])
        result.push({ name: m.municipality, hasZip: !!m.zip_code });
    }
  } else {
    for (const c of data.cities ?? [])
      result.push({ name: c.city, hasZip: !!c.zip_code });
    for (const m of data.municipalities ?? [])
      result.push({ name: m.municipality, hasZip: !!m.zip_code });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Philippine Locations API — Data Validation\n");

// 1. Load regions.json
section("Loading regions.json");
const regions = readJson<Region[]>(join(DATA_DIR, "regions.json"));
if (!regions || !Array.isArray(regions)) {
  console.error("❌ Could not parse data/regions.json");
  process.exit(1);
}
ok(`Loaded ${regions.length} regions`);

// 2. List lgu/ files
section("Listing data/lgu/ files");
const lguFiles = readdirSync(LGU_DIR).filter((f: string) =>
  f.endsWith(".json"),
);
ok(`Found ${lguFiles.length} files in data/lgu/`);

const lguSlugs = new Set(lguFiles.map((f: string) => f.replace(/\.json$/, "")));
const regionSlugs = new Set(regions.map((r) => r.slug));

// 3. Every region in regions.json must have a file
section("Checking regions.json → data/lgu/ coverage");
for (const region of regions) {
  if (lguSlugs.has(region.slug)) {
    ok(`${region.slug}`);
  } else {
    fail(`Missing file: data/lgu/${region.slug}.json`);
  }
}

// 4. Every lgu/ file must have a region entry
section("Checking data/lgu/ → regions.json coverage (orphan check)");
for (const slug of lguSlugs) {
  if (regionSlugs.has(slug)) {
    ok(`${slug}`);
  } else {
    warn(`Orphaned file: data/lgu/${slug}.json (no entry in regions.json)`);
  }
}

// 5. Validate each region data file
section("Validating location data");

let totalLocations = 0;
let maxLocations = 0;
let maxRegion = "";

for (const region of regions) {
  if (!lguSlugs.has(region.slug)) continue;

  const data = readJson<RawRegionData>(join(LGU_DIR, `${region.slug}.json`));

  if (!data) {
    fail(`Cannot parse data/lgu/${region.slug}.json — invalid JSON`);
    continue;
  }

  // Check slug field matches
  if (data.slug !== region.slug) {
    warn(
      `data/lgu/${region.slug}.json has slug="${data.slug}" but expected "${region.slug}"`,
    );
  }

  const locs = flattenLocations(data);
  const slugs = locs.map((l) => toSlug(l.name));

  // Check for duplicate slugs within the same region
  const seen = new Map<string, number>();
  for (const slug of slugs) {
    seen.set(slug, (seen.get(slug) ?? 0) + 1);
  }
  for (const [slug, count] of seen.entries()) {
    if (count > 1) {
      warn(
        `Duplicate location slug "${slug}" appears ${count}x in ${region.slug}`,
      );
    }
  }

  // Report missing ZIP codes (informational warning)
  const missingZip = locs.filter((l) => !l.hasZip).length;
  if (missingZip > 0) {
    warn(`${region.slug}: ${missingZip} location(s) have no zip_code`);
  }

  const count = locs.length;
  totalLocations += count;
  if (count > maxLocations) {
    maxLocations = count;
    maxRegion = region.slug;
  }

  ok(`${region.slug}: ${count} location(s)`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

section("Summary");
console.log(`  Regions:          ${regions.length}`);
console.log(`  LGU files:        ${lguFiles.length}`);
console.log(`  Total locations:  ${totalLocations}`);
console.log(`  Largest region:   ${maxRegion} (${maxLocations} locations)`);
console.log(`  Errors:           ${errors}`);
console.log(`  Warnings:         ${warnings}`);

if (errors > 0) {
  console.error("\n❌ Validation failed with errors.\n");
  process.exit(1);
} else if (warnings > 0) {
  console.warn("\n⚠️  Validation passed with warnings.\n");
} else {
  console.log("\n✅ Validation passed.\n");
}
