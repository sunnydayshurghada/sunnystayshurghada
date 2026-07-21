---
name: Google API keys — do not touch
description: Maps browser key lives in .env; Weather server key lives only as Cloudflare secret. Never merge, rename, or overwrite.
type: constraint
---
Two Google API keys run in parallel and must never be modified, renamed, merged, or moved:

1. `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`
   - Location: project `.env` file only
   - Used by: `src/components/LocationSection.tsx` via `import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`
   - Purpose: Google Maps JavaScript API (browser)
   - Do NOT replace with a Lovable connector key, do NOT rename, do NOT delete.

2. `GOOGLE_WEATHER_API_KEY`
   - Location: Cloudflare Worker → Variables and Secrets ONLY (not in `.env`)
   - Used by: `src/lib/weather.functions.ts` via `process.env.GOOGLE_WEATHER_API_KEY`
   - Purpose: Google Weather API (server)
   - Do NOT add to `.env`, do NOT overwrite with the Maps key, do NOT rename to `lovc_*` or `GOOGLE_API_KEY`.

**Why:** User manages the Cloudflare secret manually. Any agent-side change to `.env` for these keys, or any attempt to consolidate them, has repeatedly broken production. Preserve current values and locations on every future edit or publish.
