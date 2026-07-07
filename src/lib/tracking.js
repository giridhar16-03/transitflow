const PUBLIC_SELECTION_KEY = "transitflow:public:selectedBusId";
const ACTIVE_TRIP_KEY = "transitflow:trip:active";
const TRACKING_EVENT = "transitflow:tracking-updated";

export const trafficLevels = [
  { key: "light", label: "Light", factor: 0.9 },
  { key: "medium", label: "Moderate", factor: 1.15 },
  { key: "heavy", label: "Heavy", factor: 1.45 },
];

export const locationCatalog = [
  { name: "Central Station", latitude: 12.9718, longitude: 77.5946 },
  { name: "Tech Park", latitude: 12.9688, longitude: 77.6023 },
  { name: "Depot", latitude: 12.9604, longitude: 77.5959 },
  { name: "North Loop", latitude: 12.9794, longitude: 77.6122 },
  { name: "City Hall", latitude: 12.9751, longitude: 77.5868 },
  { name: "Airport Road", latitude: 12.9502, longitude: 77.6218 },
  { name: "University Gate", latitude: 12.9865, longitude: 77.5967 },
  { name: "Metro Hub", latitude: 12.9924, longitude: 77.5805 },
  { name: "South Depot", latitude: 12.9489, longitude: 77.5881 },
  { name: "Residential Loop", latitude: 12.9576, longitude: 77.6073 },
];

export function getNearbyBusStops(userLocation, limit = 4, maxDistanceKm = 1.8) {
  if (!userLocation) return [];

  return locationCatalog
    .map((stop) => ({
      ...stop,
      distanceKm: haversineDistanceKm(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: stop.latitude, longitude: stop.longitude },
      ),
    }))
    .filter((stop) => stop.distanceKm <= maxDistanceKm)
    .sort((first, second) => first.distanceKm - second.distanceKm)
    .slice(0, limit);
}

function hasWindow() {
  return typeof window !== "undefined";
}

function scopeSuffix(scope) {
  const normalized = String(scope || "").trim();
  return normalized ? `:${normalized}` : "";
}

function scopedKey(baseKey, scope) {
  return `${baseKey}${scopeSuffix(scope)}`;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readJson(key, fallback) {
  if (!hasWindow()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!hasWindow()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(TRACKING_EVENT));
}

export function getSelectedBusId(scope = "") {
  return hasWindow() ? window.localStorage.getItem(scopedKey(PUBLIC_SELECTION_KEY, scope)) || "" : "";
}

export function setSelectedBusId(busId, scope = "") {
  if (!hasWindow()) return;
  window.localStorage.setItem(scopedKey(PUBLIC_SELECTION_KEY, scope), busId || "");
  window.dispatchEvent(new Event(TRACKING_EVENT));
}

export function clearSelectedBusId(scope = "") {
  if (!hasWindow()) return;
  window.localStorage.removeItem(scopedKey(PUBLIC_SELECTION_KEY, scope));
  window.dispatchEvent(new Event(TRACKING_EVENT));
}

export function getActiveTrip(scope = "") {
  return readJson(scopedKey(ACTIVE_TRIP_KEY, scope), null);
}

export function setActiveTrip(trip, scope = "") {
  writeJson(scopedKey(ACTIVE_TRIP_KEY, scope), trip);
}

export function clearActiveTrip(scope = "") {
  if (!hasWindow()) return;
  window.localStorage.removeItem(scopedKey(ACTIVE_TRIP_KEY, scope));
  window.dispatchEvent(new Event(TRACKING_EVENT));
}

export function subscribeTrackingState(listener, scope = "") {
  if (!hasWindow()) return () => {};

  const handler = () => {
    listener({ selectedBusId: getSelectedBusId(scope), activeTrip: getActiveTrip(scope) });
  };

  window.addEventListener("storage", handler);
  window.addEventListener(TRACKING_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(TRACKING_EVENT, handler);
  };
}

export function getTrackingState() {
  return {
    selectedBusId: getSelectedBusId(),
    activeTrip: getActiveTrip(),
  };
}

export function getLocationByName(place) {
  const query = normalize(place);
  if (!query) return null;
  return locationCatalog.find((location) => normalize(location.name) === query) || null;
}

export function formatPlace(place) {
  if (typeof place === "string") return place.trim();
  if (!place) return "";
  return place.name || "";
}

export function normalizeBusId(value) {
  return String(value || "").trim();
}

export function getTrafficLevel(level) {
  return trafficLevels.find((item) => item.key === level) || trafficLevels[1];
}

export function haversineDistanceKm(first, second) {
  if (!first || !second) return 0;

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(second.latitude - first.latitude);
  const deltaLng = toRad(second.longitude - first.longitude);
  const lat1 = toRad(first.latitude);
  const lat2 = toRad(second.latitude);

  const a = Math.sin(deltaLat / 2) ** 2 + Math.sin(deltaLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function estimateEtaMinutes(currentLocation, destinationLocation, trafficLevel = "medium") {
  const traffic = getTrafficLevel(trafficLevel);
  const distanceKm = haversineDistanceKm(currentLocation, destinationLocation);
  const adjustedSpeed = 30 / traffic.factor;
  return Math.max(1, Math.round((distanceKm / adjustedSpeed) * 60));
}

export function advanceTowardDestination(currentLocation, destinationLocation, trafficLevel = "medium") {
  if (!currentLocation || !destinationLocation) return currentLocation;

  const traffic = getTrafficLevel(trafficLevel);
  const step = 0.08 / traffic.factor;

  return {
    latitude: Number((currentLocation.latitude + (destinationLocation.latitude - currentLocation.latitude) * step).toFixed(6)),
    longitude: Number((currentLocation.longitude + (destinationLocation.longitude - currentLocation.longitude) * step).toFixed(6)),
  };
}

export function buildTripState({ vehicle, startPlace, endPlace, trafficLevel = "medium", driverName = "Driver" }) {
  const startLocation = getLocationByName(startPlace);
  const endLocation = getLocationByName(endPlace);

  if (!vehicle || !startLocation || !endLocation) {
    return null;
  }

  const traffic = getTrafficLevel(trafficLevel);
  const etaMinutes = estimateEtaMinutes(startLocation, endLocation, trafficLevel);

  return {
    id: `${vehicle.id}-${Date.now()}`,
    busId: vehicle.id,
    busNumber: vehicle.busNumber,
    busCode: vehicle.busCode,
    busLabel: vehicle.label,
    driverName,
    startPlace: startLocation.name,
    endPlace: endLocation.name,
    startLocation,
    endLocation,
    currentLocation: startLocation,
    trafficLevel: traffic.key,
    trafficLabel: traffic.label,
    etaMinutes,
    progress: 0,
    status: "active",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function refreshTripState(trip, currentLocation) {
  if (!trip) return null;

  const etaMinutes = estimateEtaMinutes(currentLocation || trip.currentLocation, trip.endLocation, trip.trafficLevel);
  const totalDistance = haversineDistanceKm(trip.startLocation, trip.endLocation);
  const remainingDistance = haversineDistanceKm(currentLocation || trip.currentLocation, trip.endLocation);
  const progress = totalDistance === 0 ? 1 : Math.max(0, Math.min(1, 1 - remainingDistance / totalDistance));

  return {
    ...trip,
    currentLocation: currentLocation || trip.currentLocation,
    etaMinutes,
    progress,
    status: progress >= 0.98 ? "arriving" : "active",
    updatedAt: new Date().toISOString(),
  };
}
