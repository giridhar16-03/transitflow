import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import VIZAG_ROUTES, { fetchRouteGeometry } from '../src/data/vizagRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const result = {};
  console.log(`Prefetching ${VIZAG_ROUTES.length} routes... This will take a minute due to rate limits.`);
  
  for (let i = 0; i < VIZAG_ROUTES.length; i++) {
    const route = VIZAG_ROUTES[i];
    console.log(`[${i+1}/${VIZAG_ROUTES.length}] Fetching ${route.routeNumber} (${route.osmRelationId})...`);
    try {
      const { coordinates, stops } = await fetchRouteGeometry(route.osmRelationId);
      result[route.osmRelationId] = { coordinates, stops };
    } catch (err) {
      console.error(`Error fetching ${route.routeNumber}:`, err.message);
    }
  }

  const outPath = path.join(__dirname, '../src/data/precomputedRoutes.js');
  fs.writeFileSync(outPath, 'export default ' + JSON.stringify(result) + ';');
  console.log('Saved to', outPath);
}

// We need to patch localStorage since it's running in Node
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

main();
