# TransitFlow

TransitFlow is a JS-only Vite + React transport tracking scaffold for public fleets and private institutions. It mirrors the warm beige, Fraunces/Inter visual language from the source project while using npm instead of Bun and JavaScript instead of TypeScript.

## Stack

- React 19
- Vite
- React Router DOM
- Tailwind CSS
- shadcn-style UI primitives
- Lucide React
- Sonner
- Node.js + Express backend
- Supabase-ready auth and schema

## Run locally

```bash
npm install
npm run dev
```

The frontend runs on Vite and the API runs on `http://localhost:4000`.

## Build

```bash
npm run build
```

## Environment

Copy `.env.example` to `.env` and fill in the keys you want to use for Supabase and JWT signing. The project uses OpenStreetMap tiles via Leaflet (no API key required).

## Notes

- The frontend includes landing, auth, public tracking, driver, and private institution dashboards.
- OpenStreetMap (Leaflet) is used for map rendering; tiles are loaded from OSM and no Maps API key is required.
- Supabase auth helpers are ready, but the app falls back to demo behavior if credentials are missing.
