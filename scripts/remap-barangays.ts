import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Important: use .ts for tsx script execution
import {
  getRegions,
  getRegionData,
  flattenLocations,
} from "../src/lib/data.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data");
const LGU_DIR = join(DATA_DIR, "lgu");
const OUT_DIR = join(LGU_DIR, "barangay");
const RAW_FILE = join(OUT_DIR, "barangays.json");

interface BarangaysInput {
  [regionName: string]: {
    [provinceName: string]:
      { [municipalityName: string]: string[] } | { [index: string]: string };
  };
}

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

const MANUAL_OVERRIDES: Record<string, string> = {
  "bangsamoro-autonomous-region-in-muslim-mindanao|Tagoloan-II": "Tagoloan II",
  "bangsamoro-autonomous-region-in-muslim-mindanao|Gen. S. K. Pendatun":
    "Gen. S.K. Pendatun",
  "bangsamoro-autonomous-region-in-muslim-mindanao|Shariff S. Mustapha":
    "Shariff Saydona Mustapha",
  "region-ii-cagayan-valley|Sanchez-Mira": "Sanchez Mira",
  "region-ii-cagayan-valley|Alfonso Castañeda": "Alfonso Castaneda",
  "region-iii-central-luzon|Baliuag": "City of Baliwag",
  "region-iii-central-luzon|Santo Tomas": "Sto. Tomas",
  "region-iii-central-luzon|Tarlac City": "City of Tarlac",
  "region-iva-calabarzon|Mataas na Kahoy": "Mataasnakahoy",
  "region-iva-calabarzon|Sto. Tomas": "City of Sto. Tomas",
  "region-iva-calabarzon|Dasmariñas Resettlement": "City of Dasmariñas",
  "region-iva-calabarzon|Biñan": "City of Biñan",
  "region-iva-calabarzon|Cabuyao": "City of Cabuyao",
  "region-iva-calabarzon|Calamba": "City of Calamba",
  "region-iva-calabarzon|San Pablo": "San Pablo City",
  "region-iva-calabarzon|San Pedro": "City of San Pedro",
  "region-iva-calabarzon|Santa Rosa": "City of Santa Rosa",
  "region-iva-calabarzon|Jalajala": "Jala-Jala",
  "region-ix-zamboanga-peninsula|President Manuel A. Roxas":
    "Pres. Manuel A. Roxas",
  "region-ix-zamboanga-peninsula|Banguingui": "Tongkil",
  "region-ix-zamboanga-peninsula|Panamao": "Old Panamao",
  "region-v-bicol-region|Pio V. CorpuZ": "Pio V. Corpus",
  "region-x-northern-mindanao|Don Victoriano Chiongbian": "Don Victoriano",
  "region-xi-davao-region|Davao City": "City of Davao",
  "region-xii-soccsksargen|Senator Ninoy Aquino": "Sen. Ninoy Aquino",
  "region-xiiicaraga|Banawan": "Bunawan",
  "cordillera-administrative-region|Pinukpok": "Pinukpuk",
  "cordillera-administrative-region|Baguio": "Baguio City",
  "cordillera-administrative-region|Tabuk": "City of Tabuk",
};

console.log("Remapping barangays.json to use slugs as keys...");

const raw = JSON.parse(readFileSync(RAW_FILE, "utf-8")) as BarangaysInput;

const globalFlatRawBarangays: Record<string, string[]> = {};
for (const [rName, rawRegion] of Object.entries(raw)) {
  for (const [pName, pVal] of Object.entries(rawRegion)) {
    const isAnomaly =
      Object.values(pVal).length > 0 &&
      typeof Object.values(pVal)[0] === "string";
    if (isAnomaly) {
      globalFlatRawBarangays[pName] = Object.values(pVal) as string[];
    } else {
      for (const [mName, bList] of Object.entries(pVal)) {
        if (
          rName === "National Capital Region (NCR)" &&
          pName === "City of Manila"
        ) {
          if (!globalFlatRawBarangays["Manila"])
            globalFlatRawBarangays["Manila"] = [];
          globalFlatRawBarangays["Manila"].push(...(bList as string[]));
        } else {
          globalFlatRawBarangays[mName] = bList as string[];
        }
      }
    }
  }
}

let filesWritten = 0;
let totalBarangays = 0;
let totalUnmapped = 0;

for (const slug of Object.values(REGION_NAME_TO_SLUG)) {
  const data = getRegionData(slug);
  if (!data) continue;

  // Use the actual application code to get the fully disambiguated slugs
  const lgus = flattenLocations(data);
  const outputLocations: Record<string, string[]> = {};

  for (const lgu of lgus) {
    let match: string | null = null;

    const overrideKey = slug + "|" + lgu.name;
    if (
      MANUAL_OVERRIDES[overrideKey] &&
      globalFlatRawBarangays[MANUAL_OVERRIDES[overrideKey]]
    ) {
      match = MANUAL_OVERRIDES[overrideKey];
    }

    if (!match && globalFlatRawBarangays[lgu.name]) match = lgu.name;

    if (!match && lgu.type === "city") {
      if (globalFlatRawBarangays["City of " + lgu.name])
        match = "City of " + lgu.name;
      else if (globalFlatRawBarangays[lgu.name + " City"])
        match = lgu.name + " City";
    }

    if (!match && lgu.type === "municipality") {
      if (globalFlatRawBarangays["Municipality of " + lgu.name])
        match = "Municipality of " + lgu.name;
    }

    if (!match) {
      for (const rawName of Object.keys(globalFlatRawBarangays)) {
        const ln = rawName.toLowerCase();
        const tar = lgu.name.toLowerCase();
        if (
          ln === tar ||
          (lgu.type === "city" &&
            (ln === "city of " + tar || ln === tar + " city")) ||
          (lgu.type === "municipality" && ln === "municipality of " + tar) ||
          ln.replace("city of ", "") === tar ||
          ln.replace("municipality of ", "") === tar ||
          ln.replace(" city", "") === tar ||
          ln.replace(" municipality", "") === tar
        ) {
          match = rawName;
          break;
        }
      }
    }

    if (match) {
      const bList = [...globalFlatRawBarangays[match]].sort();
      // Use the LGU slug as the key! (e.g. "makati", "burgos--ilocos-norte")
      outputLocations[lgu.slug] = [...new Set(bList)];
      totalBarangays += outputLocations[lgu.slug].length;
    } else {
      console.log(
        "  ⚠️  [" + slug + "] UNMAPPED: " + lgu.name + " (" + lgu.type + ")",
      );
      totalUnmapped++;
    }
  }

  const outFile = join(OUT_DIR, slug + ".json");
  writeFileSync(
    outFile,
    JSON.stringify({ slug, locations: outputLocations }, null, 2),
    "utf-8",
  );
  console.log(
    "  ✅ " +
      slug +
      " -> " +
      Object.keys(outputLocations).length +
      " LGUs mapped (by slug)",
  );
  filesWritten++;
}

console.log("\n── Summary ──");
console.log("  Files written:     " + filesWritten);
console.log("  Total barangays:   " + totalBarangays);
console.log("  Unmapped LGUs:     " + totalUnmapped);
console.log("\n✅ Done.");
