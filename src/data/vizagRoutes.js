/**
 * Visakhapatnam APSRTC Bus Routes
 * Source: https://wiki.openstreetmap.org/wiki/Visakhapatnam_APSRTC_Bus_Routes
 */
const VIZAG_ROUTES = [
  { routeNumber: "10K",    routeName: "RTC Complex to Kailasagiri",             via: "Jagadamba, RK Beach, VUDA Park, Tenneti Park",                              osmRelationId: "19344271" },
  { routeNumber: "10K",    routeName: "Kailasagiri to RTC Complex",             via: "Tenneti Park, VUDA Park, RK Beach, Jagadamba",                              osmRelationId: "19344357" },
  { routeNumber: "14",     routeName: "Old Post Office - Venkojipalem",         via: "",                                                                          osmRelationId: "9362357"  },
  { routeNumber: "28K",    routeName: "Kothavalasa to RK Beach",                via: "NAD, RTC Complex",                                                          osmRelationId: "17338986" },
  { routeNumber: "38Y",    routeName: "RTC Complex → Duvvada Railway Station",  via: "Gurudwara, NAD, Gajuwaka",                                                  osmRelationId: "20290658" },
  { routeNumber: "205",    routeName: "Vizianagaram to Anakapalli",             via: "Bheemasingi, Kothavalasa, Pendurthi, Sabbavaram",                           osmRelationId: "17340814" },
  { routeNumber: "12D",    routeName: "Devarapalli to RTC Complex",             via: "Kothavalasa, NAD, Railway Station",                                         osmRelationId: "17342307" },
  { routeNumber: "12D",    routeName: "RTC Complex to Devarapalli",             via: "",                                                                          osmRelationId: "17377041" },
  { routeNumber: "55K",    routeName: "Kothavalasa to Scindia",                 via: "NAD, Gajuwaka",                                                             osmRelationId: "17342309" },
  { routeNumber: "68K",    routeName: "Kothavalasa to RK Beach",                via: "Vepagunta, Simhachalam, Hanumantuwaka",                                     osmRelationId: "17342310" },
  { routeNumber: "68K",    routeName: "RK Beach to Kothavalasa",                via: "RTC Complex, Maddilapalem, Hanumanthuwaka, Simhachalam, Vepagunta, Pendurthi", osmRelationId: "18919052" },
  { routeNumber: "222V",   routeName: "Vizianagaram to Visakhapatnam",          via: "Tagarapuvalasa, Anandapuram, Hanumanthuwaka",                               osmRelationId: "17357342" },
  { routeNumber: "222R",   routeName: "Railway Station to Thagarapuvalasa",     via: "RTC Complex, Maddilapalem, Madhurawada, Anandapuram",                       osmRelationId: "17360231" },
  { routeNumber: "201V",   routeName: "S Kota to Visakhapatnam",                via: "Kothavalasa, NAD",                                                          osmRelationId: "17363000" },
  { routeNumber: "122",    routeName: "Vizianagaram to S. Kota",                via: "Bheemasingi",                                                               osmRelationId: "17367131" },
  { routeNumber: "101",    routeName: "Vizianagaram to Simhachalam",            via: "",                                                                          osmRelationId: "17367132" },
  { routeNumber: "700",    routeName: "Vizianagaram to Simhachalam Hill Top",   via: "",                                                                          osmRelationId: "17367133" },
  { routeNumber: "541",    routeName: "Maddilapalem to Kothavalasa",            via: "Gurudwara, NAD, Pendurthi",                                                 osmRelationId: "17472447" },
  { routeNumber: "541",    routeName: "Kothavalasa to Maddilapalem",            via: "NAD, Gurudwara",                                                            osmRelationId: "17342308" },
  { routeNumber: "541P",   routeName: "Maddilapalem to Padmanabham",            via: "Gurudwara, NAD, Pendurthi, Kothavalasa",                                    osmRelationId: "19317064" },
  { routeNumber: "600",    routeName: "Anakapalli to Scindia",                  via: "Aganampudi, Gajuwaka, Kurmannapalem",                                       osmRelationId: "19131619" },
  { routeNumber: "48A",    routeName: "Madhavadhara to Old Post Office",        via: "Muralinagar, Kailasapuram, Akkayapalem, RTC Complex",                       osmRelationId: "19176682" },
  { routeNumber: "25P",    routeName: "Ratnagiri HB Colony to Old Post Office", via: "PM Palem, Endada, Maddilapalem",                                            osmRelationId: "19176683" },
  { routeNumber: "60C",    routeName: "Arilova Colony to Old Post Office",      via: "Maddilapalem, RTC Complex",                                                 osmRelationId: "19176684" },
  { routeNumber: "60C",    routeName: "Old Post Office to Arilova Colony",      via: "RTC Complex, Maddilapalem, Hanumanthuwaka",                                 osmRelationId: "19343886" },
  { routeNumber: "400",    routeName: "RTC Complex to Rajeev Nagar",            via: "Railway Station, Scindia",                                                  osmRelationId: "19176747" },
  { routeNumber: "311",    routeName: "Scindia to Chodavaram",                  via: "Gajuwaka, Kurmannapalem, Duvvada, Sabbavaram",                              osmRelationId: "19176748" },
  { routeNumber: "6H",     routeName: "Simhachalam Hill Top to Old Post Office",via: "Simhachalam, NAD, Convent, Junction",                                       osmRelationId: "19216317" },
  { routeNumber: "28 Z/H", routeName: "Simhachalam Hill Top to Zilla Parishad", via: "Simhachalam, NAD, Gurudwar, RTC Complex",                                   osmRelationId: "19216318" },
  { routeNumber: "900K",   routeName: "Bheemili to Railway Station",            via: "INS Kalinga, Rushikonda, Sagarnagar, MVP Colony, RTC Complex",              osmRelationId: "19218384" },
  { routeNumber: "888",    routeName: "Anakapalli to Tagarapuvalasa",           via: "Sabbavaram, Pendurthi, Sontyam, Anandapuram",                               osmRelationId: "19221342" },
  { routeNumber: "55T",    routeName: "Old Gajuwaka to Tagarapuvalasa",         via: "NAD, Pendurthi, Sontyam, Anandapuram",                                      osmRelationId: "19221343" },
  { routeNumber: "300C",   routeName: "Chodavaram to RTC Complex",              via: "",                                                                          osmRelationId: "19270327" },
  { routeNumber: "300N",   routeName: "Sabbavaram to RK Beach",                 via: "Narava, Old Gopalapatnam, NAD, Kancharapalem, RTC Complex",                 osmRelationId: "19283231" },
  { routeNumber: "52D",    routeName: "Old Post Office to Ravindra Nagar",      via: "RTC Complex, Maddilapalem, Hanumanthuwaka",                                 osmRelationId: "19176746" },
  { routeNumber: "52D",    routeName: "Ravindra Nagar to Old Post Office",      via: "Hanumanthuwaka, Maddilapalem, RTC Complex",                                 osmRelationId: "19343768" },
];

export function getUniqueRouteNumbers() {
  const seen = new Set();
  return VIZAG_ROUTES.filter((r) => {
    if (seen.has(r.routeNumber)) return false;
    seen.add(r.routeNumber);
    return true;
  }).map((r) => r.routeNumber);
}

export function searchRoutes(query = '') {
  if (!query.trim()) return VIZAG_ROUTES;
  const q = query.trim().toLowerCase();
  return VIZAG_ROUTES.filter(
    (r) =>
      r.routeNumber.toLowerCase().includes(q) ||
      r.routeName.toLowerCase().includes(q) ||
      r.via.toLowerCase().includes(q),
  );
}

/** Find the first route whose routeNumber matches a given bus code (case-insensitive). */
export function findRouteByBusCode(busCode) {
  if (!busCode) return null;
  const q = busCode.trim().toUpperCase();
  return VIZAG_ROUTES.find((r) => r.routeNumber.toUpperCase() === q) || null;
}

// ─── Rate-limited Overpass fetcher ────────────────────────────────────────────
// Overpass allows ~1 req/s for anonymous users. We enforce a minimum gap and
// retry on 429 with exponential back-off.

let _lastOverpassRequest = 0;
const OVERPASS_MIN_GAP_MS = 1200;   // 1.2 s between requests
const OVERPASS_MAX_RETRIES = 4;
const OVERPASS_BASE_BACKOFF_MS = 3000;

async function overpassFetch(query) {
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  for (let attempt = 0; attempt < OVERPASS_MAX_RETRIES; attempt++) {
    // Enforce minimum gap between requests
    const gap = Date.now() - _lastOverpassRequest;
    if (gap < OVERPASS_MIN_GAP_MS) {
      await sleep(OVERPASS_MIN_GAP_MS - gap);
    }
    _lastOverpassRequest = Date.now();

    const res = await fetch(url);

    if (res.status === 429 || res.status === 503) {
      // Rate limited or server busy — back off exponentially
      const backoff = OVERPASS_BASE_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(`Overpass ${res.status} — retrying in ${backoff / 1000}s (attempt ${attempt + 1})`);
      await sleep(backoff);
      continue;
    }

    if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
    return res.json();
  }

  throw new Error('Overpass API unavailable after retries. Please try again in a moment.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Way-chain algorithm ──────────────────────────────────────────────────────
// OSM route relations don't guarantee ways are stored in order. This greedy
// graph-based approach chains them correctly regardless of ordering.

function chainWays(wayMembers, ways, nodes) {
  if (wayMembers.length === 0) return [];

  // Build segment list: each segment is { ref, nodeIds, forward: bool }
  // We don't know direction yet, so we keep both endpoints
  const segments = wayMembers
    .map(({ ref, role }) => {
      const way = ways.get(ref);
      if (!way || way.nodeIds.length === 0) return null;
      const nodeIds = role === 'backward' ? [...way.nodeIds].reverse() : [...way.nodeIds];
      return { ref, nodeIds, role };
    })
    .filter(Boolean);

  if (segments.length === 0) return [];

  // Build endpoint → segment index lookup (each way has two endpoints)
  const endpointMap = new Map(); // nodeId → [segmentIdx, ...]
  segments.forEach((seg, i) => {
    const a = seg.nodeIds[0];
    const b = seg.nodeIds[seg.nodeIds.length - 1];
    if (!endpointMap.has(a)) endpointMap.set(a, []);
    if (!endpointMap.has(b)) endpointMap.set(b, []);
    endpointMap.get(a).push(i);
    endpointMap.get(b).push(i);
  });

  // Find the best starting segment — prefer one whose first endpoint is NOT
  // shared with another segment's end (true start of route)
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

    // Append this segment's nodes (skip first if it duplicates the last coordinate)
    const skipFirst = coordinates.length > 0;
    const startI = skipFirst ? 1 : 0;
    for (let i = startI; i < seg.nodeIds.length; i++) {
      const node = nodes.get(seg.nodeIds[i]);
      if (node) coordinates.push([node.lat, node.lon]);
    }

    const lastNodeId = seg.nodeIds[seg.nodeIds.length - 1];

    // Find the next unused segment that shares this endpoint
    const candidates = endpointMap.get(lastNodeId) || [];
    let nextIdx = -1;
    for (const ci of candidates) {
      if (ci === curSegIdx || used.has(ci)) continue;
      const cSeg = segments[ci];
      // Ensure it can connect: either its first or last node matches
      if (cSeg.nodeIds[0] === lastNodeId) {
        nextIdx = ci;
        break;
      } else if (cSeg.nodeIds[cSeg.nodeIds.length - 1] === lastNodeId) {
        // Need to reverse this segment
        segments[ci] = { ...cSeg, nodeIds: [...cSeg.nodeIds].reverse() };
        nextIdx = ci;
        break;
      }
    }

    curSegIdx = nextIdx;
  }

  // If some ways weren't chained (gaps/branches), append them separately
  // so at least their geometry appears on the map
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

// ─── Main fetch function ──────────────────────────────────────────────────────

const routeCache = new Map();

/**
 * Fetch route polyline + bus stops for an OSM route relation.
 * Results are cached in-memory so repeated clicks are instant.
 *
 * Returns { coordinates: [[lat,lon],...], stops: [{ name, lat, lon },…] }
 */
export async function fetchRouteGeometry(osmRelationId) {
  if (routeCache.has(osmRelationId)) return routeCache.get(osmRelationId);

  const query = [
    '[out:json][timeout:25];',
    `relation(${osmRelationId});`,
    'out body;',
    '>;',
    'out skel qt;',
  ].join('\n');

  const data = await overpassFetch(query);

  // ─── Build node lookup ────────────────────────────────────────────────────
  const nodes = new Map();
  for (const el of data.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, { lat: el.lat, lon: el.lon, tags: el.tags || {} });
    }
  }

  // ─── Build way lookup ─────────────────────────────────────────────────────
  const ways = new Map();
  for (const el of data.elements) {
    if (el.type === 'way') {
      ways.set(el.id, { nodeIds: el.nodes || [], tags: el.tags || {} });
    }
  }

  // ─── Find the relation ────────────────────────────────────────────────────
  const relation = data.elements.find((el) => el.type === 'relation');
  if (!relation) return { coordinates: [], stops: [] };

  const isStopRole = (role) => Boolean(role) && /stop|platform/i.test(role);

  // ─── Extract bus stops ────────────────────────────────────────────────────
  const stops = [];
  const seenStopIds = new Set();

  for (const member of relation.members) {
    if (!isStopRole(member.role)) continue;

    if (member.type === 'node') {
      if (seenStopIds.has(member.ref)) continue;
      seenStopIds.add(member.ref);

      const node = nodes.get(member.ref);
      if (!node) continue;

      const name =
        node.tags['name'] ||
        node.tags['name:en'] ||
        node.tags['ref'] ||
        `Stop ${stops.length + 1}`;

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

  // ─── Extract route way members (non-stop) ────────────────────────────────
  const wayMembers = relation.members
    .filter((m) => m.type === 'way' && !isStopRole(m.role))
    .map((m) => ({ ref: m.ref, role: m.role || '' }));

  // ─── Chain ways into a polyline ───────────────────────────────────────────
  const coordinates = chainWays(wayMembers, ways, nodes);

  const result = { coordinates, stops };
  routeCache.set(osmRelationId, result);
  return result;
}

// ─── OSRM walking route ───────────────────────────────────────────────────────

const walkCache = new Map();

/**
 * Fetch a real walking route between two coordinates using OSRM.
 * Returns { coords: [[lat,lon],…], distanceM: number, durationS: number }
 * or null on failure.
 */
export async function fetchWalkingRoute(fromLat, fromLon, toLat, toLon) {
  const key = `${fromLat.toFixed(5)},${fromLon.toFixed(5)}_${toLat.toFixed(5)},${toLon.toFixed(5)}`;
  if (walkCache.has(key)) return walkCache.get(key);

  try {
    const url =
      `https://router.project-osrm.org/route/v1/foot/` +
      `${fromLon},${fromLat};${toLon},${toLat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) return null;

    const route = json.routes[0];
    const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const result = {
      coords,
      distanceM: Math.round(route.distance),
      durationS: Math.round(route.duration),
    };
    walkCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

export default VIZAG_ROUTES;
