import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.resolve(__dirname, "../src/data");
const routesFilePath = path.join(srcPath, "vizagRoutes.js");
const outputFilePath = path.join(srcPath, "routeGeometries.json");

// Read the VIZAG_ROUTES from vizagRoutes.js
const routesContent = fs.readFileSync(routesFilePath, "utf8");
const match = routesContent.match(/const VIZAG_ROUTES = \[([\s\S]*?)\];/);

if (!match) {
  console.error("Could not parse VIZAG_ROUTES");
  process.exit(1);
}

const routesStr = "[" + match[1] + "]"
  .replace(/routeNumber:/g, '"routeNumber":')
  .replace(/routeName:/g, '"routeName":')
  .replace(/via:/g, '"via":')
  .replace(/osmRelationId:/g, '"osmRelationId":')
  .replace(/'/g, '"'); // naive JSON fix

let VIZAG_ROUTES;
try {
  // Use Function constructor to parse the JS array object
  VIZAG_ROUTES = new Function('return ' + "[" + match[1] + "]")();
} catch (e) {
  console.error("Error evaluating routes:", e);
  process.exit(1);
}

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function overpassFetch(query) {
  for (const mirror of OVERPASS_MIRRORS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(mirror, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "TransitFlow/1.0"
          },
          body: `data=${encodeURIComponent(query)}`
        });
        if (res.status === 429 || res.status === 503) {
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }
        if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn(`Fetch failed from ${mirror}: ${err.message}`);
        break; // Try next mirror
      }
    }
  }
  throw new Error('All Overpass API mirrors unavailable.');
}

function chainWays(wayMembers, ways, nodes) {
  if (wayMembers.length === 0) return [];

  const segments = wayMembers
    .map(({ ref, role }) => {
      const way = ways.get(ref);
      if (!way || way.nodeIds.length === 0) return null;
      const nodeIds = role === 'backward' ? [...way.nodeIds].reverse() : [...way.nodeIds];
      return { ref, nodeIds, role };
    })
    .filter(Boolean);

  if (segments.length === 0) return [];

  const endpointMap = new Map();
  segments.forEach((seg, i) => {
    const a = seg.nodeIds[0];
    const b = seg.nodeIds[seg.nodeIds.length - 1];
    if (!endpointMap.has(a)) endpointMap.set(a, []);
    if (!endpointMap.has(b)) endpointMap.set(b, []);
    endpointMap.get(a).push(i);
    endpointMap.get(b).push(i);
  });

  let startIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    const firstNode = segments[i].nodeIds[0];
    const connectedAtStart = (endpointMap.get(firstNode) || []).filter((j) => j !== i).length;
    if (connectedAtStart === 0) { startIdx = i; break; }
  }

  const used = new Set();
  const coordinates = [];
  let curSegIdx = startIdx;

  while (curSegIdx !== -1 && used.size < segments.length) {
    const seg = segments[curSegIdx];
    if (used.has(curSegIdx)) break;
    used.add(curSegIdx);

    const skipFirst = coordinates.length > 0;
    const startI = skipFirst ? 1 : 0;
    for (let i = startI; i < seg.nodeIds.length; i++) {
      const node = nodes.get(seg.nodeIds[i]);
      if (node) coordinates.push([node.lat, node.lon]);
    }

    const lastNodeId = seg.nodeIds[seg.nodeIds.length - 1];
    const candidates = endpointMap.get(lastNodeId) || [];
    let nextIdx = -1;
    for (const ci of candidates) {
      if (ci === curSegIdx || used.has(ci)) continue;
      const cSeg = segments[ci];
      if (cSeg.nodeIds[0] === lastNodeId) {
        nextIdx = ci;
        break;
      } else if (cSeg.nodeIds[cSeg.nodeIds.length - 1] === lastNodeId) {
        segments[ci] = { ...cSeg, nodeIds: [...cSeg.nodeIds].reverse() };
        nextIdx = ci;
        break;
      }
    }
    curSegIdx = nextIdx;
  }

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    const seg = segments[i];
    for (const nid of seg.nodeIds) {
      const node = nodes.get(nid);
      if (node) coordinates.push([node.lat, node.lon]);
    }
  }

  return coordinates;
}

async function processRoute(osmRelationId) {
  const query = [
    '[out:json][timeout:25];',
    `relation(${osmRelationId});`,
    'out body;',
    '>;',
    'out skel qt;',
  ].join('\n');

  const data = await overpassFetch(query);

  const nodes = new Map();
  for (const el of data.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, { lat: el.lat, lon: el.lon, tags: el.tags || {} });
    }
  }

  const ways = new Map();
  for (const el of data.elements) {
    if (el.type === 'way') {
      ways.set(el.id, { nodeIds: el.nodes || [], tags: el.tags || {} });
    }
  }

  const relation = data.elements.find((el) => el.type === 'relation');
  if (!relation) return { coordinates: [], stops: [] };

  const isStopRole = (role) => Boolean(role) && /stop|platform/i.test(role);

  const stops = [];
  const seenStopIds = new Set();

  for (const member of relation.members) {
    if (!isStopRole(member.role)) continue;
    if (member.type === 'node') {
      if (seenStopIds.has(member.ref)) continue;
      seenStopIds.add(member.ref);
      const node = nodes.get(member.ref);
      if (!node) continue;
      const name = node.tags['name'] || node.tags['name:en'] || node.tags['ref'] || `Stop ${stops.length + 1}`;
      stops.push({ name, lat: node.lat, lon: node.lon });
    } else if (member.type === 'way') {
      const way = ways.get(member.ref);
      if (!way || way.nodeIds.length === 0) continue;
      const midNode = nodes.get(way.nodeIds[Math.floor(way.nodeIds.length / 2)]);
      if (!midNode) continue;
      const coordKey = `${midNode.lat.toFixed(5)},${midNode.lon.toFixed(5)}`;
      if (seenStopIds.has(coordKey)) continue;
      seenStopIds.add(coordKey);
      const name = way.tags['name'] || way.tags['ref'] || `Platform ${stops.length + 1}`;
      stops.push({ name, lat: midNode.lat, lon: midNode.lon });
    }
  }

  const wayMembers = relation.members
    .filter((m) => m.type === 'way' && !isStopRole(m.role))
    .map((m) => ({ ref: m.ref, role: m.role || '' }));

  const coordinates = chainWays(wayMembers, ways, nodes);
  return { coordinates, stops };
}

async function run() {
  const allRoutes = {};
  console.log(`Found ${VIZAG_ROUTES.length} routes to fetch.`);
  for (let i = 0; i < VIZAG_ROUTES.length; i++) {
    const route = VIZAG_ROUTES[i];
    console.log(`[${i + 1}/${VIZAG_ROUTES.length}] Fetching ${route.routeNumber} (${route.osmRelationId})...`);
    try {
      allRoutes[route.osmRelationId] = await processRoute(route.osmRelationId);
      // Wait a bit to respect Overpass API rate limits
      await sleep(1500);
    } catch (err) {
      console.error(`Failed to fetch ${route.osmRelationId}:`, err);
    }
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(allRoutes));
  console.log(`Saved to ${outputFilePath}`);
}

run();
