/**
 * scripts/split-barangays.ts
 *
 * Splits the monolithic data/lgu/barangay/barangays.json into one JSON file
 * per region, stored at data/lgu/barangay/<region-slug>.json
 *
 * Output format per file:
 * {
 *   "slug": "<region-slug>",
 *   "locations": {
 *     "<municipality-name>": ["Barangay A", "Barangay B", ...]
 *   }
 * }
 *
 * The province layer is flattened. If two municipalities in different
 * provinces share the same name, the province name is appended as a
 * disambiguator: "Rosario (Batangas)", "Rosario (Cavite)".
 *
 * Special case: Some cities (e.g. Cagayan De Oro, Iligan) are stored at the
 * province level with their barangays as a string-indexed object rather than
 * a municipality → barangays[] structure. These are detected and handled.
 *
 * Run with: pnpm split-barangays
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const LGU_DIR = join(DATA_DIR, "lgu");
const INPUT_FILE = join(LGU_DIR, "barangay", "barangays.json");
const OUTPUT_DIR = join(LGU_DIR, "barangay");

// ---------------------------------------------------------------------------
// Region name → slug mapping
// ---------------------------------------------------------------------------

const REGION_NAME_TO_SLUG: Record<string, string> = {
  "Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)":
    "bangsamoro-autonomous-region-in-muslim-mindanao",
  "Cordillera Administrative Region (CAR)": "cordillera-administrative-region",
  "MIMAROPA Region": "region-ivb-mimaropa",
  "National Capital Region (NCR)": "national-capital-region",
  "Negros Island Region (NIR)": "negros-island-region",
  "Region I (Ilocos Region)": "region-i-ilocos-region",
  "Region II (Cagayan Valley)": "region-ii-cagayan-valley",
  "Region III (Central Luzon)": "region-iii-central-luzon",
  "Region IV-A (CALABARZON)": "region-iva-calabarzon",
  "Region IX (Zamboanga Peninsula)": "region-ix-zamboanga-peninsula",
  "Region V (Bicol Region)": "region-v-bicol-region",
  "Region VI (Western Visayas)": "region-vi-western-visayas",
  "Region VII (Central Visayas)": "region-vii-central-visayas",
  "Region VIII (Eastern Visayas)": "region-viii-eastern-visayas",
  "Region X (Northern Mindanao)": "region-x-northern-mindanao",
  "Region XI (Davao Region)": "region-xi-davao-region",
  "Region XII (SOCCSKSARGEN)": "region-xii-soccsksargen",
  "Region XIII (Caraga)": "region-xiiicaraga",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Value of a province in the input:
 *  - Normal case: Record<municipalityName, string[]>   (municipality → barangays)
 *  - City case:   Record<"0"|"1"|..., string>          (numbered index → barangay name)
 */
type ProvinceValue =
  | Record<string, string[]> // normal: municipality → [barangays]
  | Record<string, string>; // city-level: "0" → "Barangay Name"

type BarangaysInput = Record<
  string, // region name
  Record<string, ProvinceValue> // province name → municipalities or city barangays
>;

interface RegionBarangayFile {
  slug: string;
  /**
   * Flat map: LGU name → sorted array of barangay names.
   * If two LGUs in different provinces share the same name, the key is
   * disambiguated with " (Province Name)".
   */
  locations: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(msg);
}
function warn(msg: string) {
  console.warn(`  ⚠️  ${msg}`);
}

/**
 * Detect whether a province value is the city-level format.
 *
 * City-level format: all values are strings (not arrays).
 * Normal format: all values are arrays.
 */
function isCityLevelFormat(val: ProvinceValue): boolean {
  const values = Object.values(val);
  if (values.length === 0) return false;
  return typeof values[0] === "string";
}

/**
 * Add an LGU entry to the locations map, handling duplicates with province
 * disambiguation.
 */
function addLgu(
  locations: Record<string, string[]>,
  seen: Map<string, string>,
  lguName: string,
  barangays: string[],
  provinceName: string,
  slug: string,
): void {
  if (seen.has(lguName)) {
    const firstProvince = seen.get(lguName)!;

    if (locations[lguName]) {
      const existing = locations[lguName]!;
      const disambiguatedKey = `${lguName} (${firstProvince})`;
      locations[disambiguatedKey] = existing;
      delete locations[lguName];
      warn(
        `[${slug}] Duplicate "${lguName}" — renamed to "${disambiguatedKey}"`,
      );
    }

    const disambiguatedKey = `${lguName} (${provinceName})`;
    locations[disambiguatedKey] = [...barangays].sort();
    warn(
      `[${slug}] Duplicate "${lguName}" — stored new as "${disambiguatedKey}"`,
    );
  } else {
    seen.set(lguName, provinceName);
    locations[lguName] = [...barangays].sort();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

log("Splitting barangays.json into per-region files…\n");

if (!existsSync(INPUT_FILE)) {
  console.error(`❌ Input file not found: ${INPUT_FILE}`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(INPUT_FILE, "utf-8")) as BarangaysInput;

let filesWritten = 0;
let totalBarangays = 0;
const unmappedRegions: string[] = [];

for (const [regionName, provinces] of Object.entries(raw)) {
  const slug = REGION_NAME_TO_SLUG[regionName];

  if (!slug) {
    warn(`No slug mapping for region: "${regionName}" — skipping`);
    unmappedRegions.push(regionName);
    continue;
  }

  const locations: Record<string, string[]> = {};
  const seen = new Map<string, string>(); // lguName → province that first defined it

  for (const [provinceName, provinceValue] of Object.entries(provinces)) {
    if (isCityLevelFormat(provinceValue)) {
      // Special case: province key IS the city name; values are indexed barangay names
      // e.g. "City of Cagayan De Oro": { "0": "Barangay 7", "1": "Barangay 14", ... }
      const barangays = Object.values(provinceValue as Record<string, string>);
      addLgu(locations, seen, provinceName, barangays, "city", slug);
    } else {
      // Normal case: municipality name → string[]
      const municipalities = provinceValue as Record<string, string[]>;
      for (const [lguName, barangays] of Object.entries(municipalities)) {
        addLgu(locations, seen, lguName, barangays, provinceName, slug);
      }
    }
  }

  totalBarangays += Object.values(locations).reduce((s, b) => s + b.length, 0);

  const output: RegionBarangayFile = { slug, locations };
  const outPath = join(OUTPUT_DIR, `${slug}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf-8");

  const lguCount = Object.keys(locations).length;
  const brgyCount = Object.values(locations).reduce((s, b) => s + b.length, 0);
  log(`  ✅ ${slug} → ${lguCount} LGUs, ${brgyCount} barangays`);
  filesWritten++;
}

log(`\n── Summary ──`);
log(`  Files written:     ${filesWritten}`);
log(`  Total barangays:   ${totalBarangays}`);

if (unmappedRegions.length > 0) {
  warn(`Unmapped regions: ${unmappedRegions.join(", ")}`);
} else {
  log(`  Unmapped regions:  0`);
}

log("\n✅ Done.\n");
