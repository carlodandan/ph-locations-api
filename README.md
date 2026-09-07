# Philippine Locations API

A lightning-fast, production-ready REST API that serves administrative locations (regions, cities, municipalities, and barangays) in the Philippines. 

Built on **Cloudflare Workers** and **TypeScript**, this API achieves sub-millisecond response times by bundling all location data statically at build time—completely eliminating database lookup latency.

## Features

- ⚡ **Zero Database Latency**: Data is served directly from static JSON files bundled into the Worker isolate.
- 🌍 **Edge Caching**: Utilizes the Cloudflare Cache API to instantly serve repeated requests from the CDN edge.
- 🛡️ **Rate Limiting**: Built-in in-memory rate limiting (60 requests/minute per IP) to prevent abuse.
- 🏷️ **Slug-based Routing**: Beautiful, URL-safe slugs (e.g., 
ational-capital-region, makati, el-air) for all lookups.
- 🔍 **Search Engine**: Built-in partial-match, case-insensitive search across regions and locations.

## Data Structure

The API hierarchy strictly follows the Philippine administrative structure:
Regions -> Cities / Municipalities -> Barangays

Locations are normalized so that all cities and municipalities share the same object shape (including their zip_code and province).

## Endpoints

All responses are wrapped in a standard { "data": ... } JSON envelope.

### Regions
- GET /api/regions - List all regions.
- GET /api/regions/:region - Get details for a specific region.

### Locations (Cities & Municipalities)
- GET /api/regions/:region/locations - List all cities and municipalities in a region.
- GET /api/regions/:region/cities - List only cities in a region.
- GET /api/regions/:region/municipalities - List only municipalities in a region.
- GET /api/regions/:region/locations/:location - Get details for a specific location.

### Barangays
- GET /api/regions/:region/locations/:location/barangays 
  Returns the location object with its nested arangays array.
- GET /api/regions/:region/locations/:location/barangays/:barangay
  Get details for a specific barangay.

### Search
- GET /api/search?q=<query>
  Search across all region, city, and municipality names.

## Example Response

**GET /api/regions/national-capital-region/locations/makati/barangays**

```json
{
  "data": {
    "name": "Makati",
    "slug": "makati",
    "type": "city",
    "zip_code": "1200",
    "province": null,
    "barangays": [
      {
        "name": "Bel-Air",
        "slug": "bel-air"
      },
      {
        "name": "Poblacion",
        "slug": "poblacion"
      }
    ]
  }
}
```

## Error Handling

Errors return a consistent JSON payload along with appropriate HTTP status codes (e.g., 404 Not Found, 429 Too Many Requests).

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later."
  }
}
```

## Development

### Prerequisites
- Node.js (v18+)
- pnpm

### Setup & Run
1. Install dependencies:
```
pnpm install
```
2. Start the local development server (Wrangler/Miniflare):
```
pnpm dev
```

### Scripts
- pnpm build: Run type checks and compile the Worker.
- pnpm test: Run the test suite using Vitest.
- pnpm run script:remap: Regenerate the mapped barangay JSON files from the raw LGU dataset.
