import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import VIZAG_ROUTES from '../src/data/vizagRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Minimal logic to just fetch the relations
async function fetchGeometry(osmRelationId) {
  const query = `[out:json][timeout:25]; relation(${osmRelationId}); out body; >; out skel qt;`;
  const url = `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`;
  
  for (let i=0; i<3; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'TransitFlow/1.0', 'Accept': '*/*' }});
    if (res.status === 429) {
      console.log(`429... waiting ${5000 * (i+1)}ms`);
      await sleep(5000 * (i+1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }
  throw new Error("Failed after retries");
}

async function main() {
  const result = {};
  console.log(`Prefetching ${VIZAG_ROUTES.length} routes using Kumi Systems (slow & steady)...`);
  
  for (let i = 0; i < VIZAG_ROUTES.length; i++) {
    const route = VIZAG_ROUTES[i];
    console.log(`[${i+1}/${VIZAG_ROUTES.length}] Fetching ${route.routeNumber} (${route.osmRelationId})...`);
    try {
      const data = await fetchGeometry(route.osmRelationId);
      
      // We will just store the raw OSM JSON data temporarily, then process it.
      // Actually, we can just process it using the same logic as vizagRoutes.js if we want.
      // But for simplicity, we just save the raw data.
      result[route.osmRelationId] = data;
      
    } catch (err) {
      console.error(`Error fetching ${route.routeNumber}:`, err.message);
    }
    
    // 4 seconds gap to respect rate limits
    await sleep(4000);
  }

  const outPath = path.join(__dirname, '../src/data/rawOsmRoutes.json');
  fs.writeFileSync(outPath, JSON.stringify(result));
  console.log('Saved to', outPath);
}

main();
