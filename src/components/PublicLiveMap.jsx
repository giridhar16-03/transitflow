import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { fetchWalkingRoute } from "../data/vizagRoutes.js";

const VIZAG_CENTER = { lat: 17.7384, lng: 83.2510 };

// ─── Map helpers ──────────────────────────────────────────────────────────────

function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  return mins < 1 ? '<1 min' : `~${mins} min`;
}

function formatDistance(metres) {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${metres} m`;
}

function estimateBusEtaMin(distanceMetres) {
  // City bus average ~20 km/h in traffic
  const speedMps = 20 * 1000 / 3600;
  const seconds = distanceMetres / speedMps;
  return Math.max(1, Math.round(seconds / 60));
}

// ─── Map control components ──────────────────────────────────────────────────

function FitBounds({ bounds, padding = [50, 50] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding, maxZoom: 16, animate: true });
  }, [map, bounds, padding]);
  return null;
}

function FitPolyline({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !coordinates || coordinates.length < 2) return;
    map.fitBounds(L.latLngBounds(coordinates), { padding: [40, 40], maxZoom: 15 });
  }, [map, coordinates]);
  return null;
}

function AutoPan({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);
  return null;
}

/** Smoothly follow a moving point (live bus) */
function SmoothFollow({ lat, lng, enabled }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    if (!map || !enabled || !lat || !lng) return;
    const prev = prevRef.current;
    if (prev && prev.lat === lat && prev.lng === lng) return;
    prevRef.current = { lat, lng };
    map.flyTo([lat, lng], map.getZoom(), { duration: 1.2 });
  }, [map, lat, lng, enabled]);
  return null;
}

/** Exposes map ref for imperative control */
function MapRef({ onMap }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function stopIcon(isNearest) {
  const size = isNearest ? 22 : 14;
  const bg = isNearest ? '#1d4ed8' : '#3b82f6';
  const border = isNearest ? 3 : 2;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${bg};
      border:${border}px solid #fff;
      box-shadow:0 1px 6px rgba(0,0,0,0.35);
      ${isNearest ? 'outline:3px solid #bfdbfe;' : ''}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const startIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8],
});

const endIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8],
});

const busIcon = (label) =>
  L.divIcon({
    className: '',
    html: `<div style="
      display:inline-flex;align-items:center;justify-content:center;
      width:36px;height:36px;border-radius:50%;
      background:#d97706;color:#fff;font-weight:700;font-size:12px;
      border:3px solid #f59e0b;box-shadow:0 2px 8px rgba(0,0,0,.25);
    ">${label}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18],
  });

const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;border-radius:50%;
    background:#2563eb;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,.25);
    position:relative;
  "><div style="
    position:absolute;inset:-4px;border-radius:50%;
    border:2px solid rgba(37,99,235,0.3);
    animation:pulse 2s ease-in-out infinite;
  "></div></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

// ─── Map Control Buttons ─────────────────────────────────────────────────────

const btnBase = "flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-soft text-foreground hover:bg-secondary transition-all duration-150 active:scale-95";

function MapControls({ mapRef, userLocation, selectedVehicle, hasRoute, routeCoordinates, stops }) {
  const handleZoomIn = () => mapRef.current?.zoomIn(1, { animate: true });
  const handleZoomOut = () => mapRef.current?.zoomOut(1, { animate: true });

  const handleCenterUser = () => {
    if (userLocation?.latitude && mapRef.current) {
      mapRef.current.flyTo([userLocation.latitude, userLocation.longitude], 16, { duration: 0.8 });
    }
  };

  const handleFitAll = () => {
    if (!mapRef.current) return;
    const points = [];
    if (userLocation?.latitude) points.push([userLocation.latitude, userLocation.longitude]);
    if (selectedVehicle) points.push([selectedVehicle.latitude, selectedVehicle.longitude]);
    if (hasRoute && routeCoordinates?.length > 0) {
      points.push(routeCoordinates[0], routeCoordinates[routeCoordinates.length - 1]);
    }
    if (stops?.length > 0) {
      stops.forEach(s => points.push([s.lat, s.lon]));
    }
    if (points.length >= 2) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15, animate: true });
    } else if (points.length === 1) {
      mapRef.current.flyTo(points[0], 15, { duration: 0.8 });
    }
  };

  return (
    <div style={{ zIndex: 1000 }} className="absolute right-3 top-3 flex flex-col gap-1.5">
      <button onClick={handleZoomIn} className={btnBase} title="Zoom in">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>
      <button onClick={handleZoomOut} className={btnBase} title="Zoom out">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>
      <div className="h-px" />
      {userLocation?.latitude && (
        <button onClick={handleCenterUser} className={btnBase} title="Center on my location">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="#2563eb" strokeWidth="2"/>
            <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
      <button onClick={handleFitAll} className={btnBase} title="Fit everything in view">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Props:
 *   selectedVehicle   — live bus { latitude, longitude, busNumber, label, lastSeen }
 *   userLocation      — { latitude, longitude }
 *   routeCoordinates  — [[lat,lon], ...]
 *   routeStops        — [{ name, lat, lon }, ...]
 *   routeInfo         — { routeNumber, routeName, via }
 *   followBus         — boolean, smooth-follow the live bus
 */
export function PublicLiveMap({ selectedVehicle, userLocation, routeCoordinates, routeStops, routeInfo, followBus = false }) {
  const hasRoute = routeCoordinates && routeCoordinates.length > 1;
  const stops = routeStops || [];
  const mapRef = useRef(null);

  const handleMapRef = useCallback((m) => { mapRef.current = m; }, []);

  // Walking route state
  const [walkPath, setWalkPath] = useState(null);
  const [walkLoading, setWalkLoading] = useState(false);

  // ─── Find nearest stop to USER ────────────────────────────────────────────
  const nearestStopToUser = useMemo(() => {
    if (!userLocation?.latitude || stops.length === 0) return null;
    let minDist = Infinity;
    let best = null;
    let bestIdx = -1;
    stops.forEach((stop, i) => {
      const d = haversineDist(userLocation.latitude, userLocation.longitude, stop.lat, stop.lon);
      if (d < minDist) { minDist = d; best = stop; bestIdx = i; }
    });
    return best ? { ...best, index: bestIdx, distanceM: Math.round(minDist) } : null;
  }, [userLocation, stops]);

  // ─── Find nearest stop to DRIVER / estimate ETA ───────────────────────────
  const driverStopInfo = useMemo(() => {
    if (!selectedVehicle || stops.length === 0 || !nearestStopToUser) return null;

    // Find which stop the driver is nearest to
    let driverNearestDist = Infinity;
    let driverNearestIdx = -1;
    stops.forEach((stop, i) => {
      const d = haversineDist(selectedVehicle.latitude, selectedVehicle.longitude, stop.lat, stop.lon);
      if (d < driverNearestDist) { driverNearestDist = d; driverNearestIdx = i; }
    });

    // Distance from driver to user's nearest stop (along route approximation)
    const driverToUserStopDist = haversineDist(
      selectedVehicle.latitude, selectedVehicle.longitude,
      nearestStopToUser.lat, nearestStopToUser.lon,
    );

    const etaMin = estimateBusEtaMin(driverToUserStopDist);

    return {
      driverNearestStopIdx: driverNearestIdx,
      driverNearestStop: stops[driverNearestIdx],
      distToUserStopM: Math.round(driverToUserStopDist),
      etaMin,
    };
  }, [selectedVehicle, stops, nearestStopToUser]);

  // ─── Fetch walking route when nearest stop or user location changes ───────
  useEffect(() => {
    if (!nearestStopToUser || !userLocation?.latitude) { setWalkPath(null); return; }

    let cancelled = false;
    setWalkLoading(true);
    fetchWalkingRoute(
      userLocation.latitude, userLocation.longitude,
      nearestStopToUser.lat, nearestStopToUser.lon,
    ).then((result) => {
      if (!cancelled) { setWalkPath(result); setWalkLoading(false); }
    }).catch(() => {
      if (!cancelled) setWalkLoading(false);
    });

    return () => { cancelled = true; };
  }, [nearestStopToUser, userLocation]);

  // ─── Map centre ───────────────────────────────────────────────────────────
  const mapCenter = useMemo(() => {
    if (hasRoute) return { lat: routeCoordinates[0][0], lng: routeCoordinates[0][1] };
    if (selectedVehicle) return { lat: selectedVehicle.latitude, lng: selectedVehicle.longitude };
    if (userLocation?.latitude) return { lat: userLocation.latitude, lng: userLocation.longitude };
    return VIZAG_CENTER;
  }, [hasRoute, routeCoordinates, selectedVehicle, userLocation]);

  const defaultZoom = hasRoute ? 13 : selectedVehicle ? 15 : 13;

  return (
    <div className="relative h-full min-h-[16rem] sm:min-h-[30rem] w-full">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={defaultZoom}
        className="absolute inset-0"
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRef onMap={handleMapRef} />

        {hasRoute && <FitPolyline coordinates={routeCoordinates} />}
        {!hasRoute && !followBus && <AutoPan center={[mapCenter.lat, mapCenter.lng]} zoom={defaultZoom} />}

        {/* Smooth follow for live bus */}
        {followBus && selectedVehicle && (
          <SmoothFollow lat={selectedVehicle.latitude} lng={selectedVehicle.longitude} enabled={followBus} />
        )}

        {/* Route: glow underlay */}
        {hasRoute && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{ color: '#3b82f6', weight: 12, opacity: 0.2, lineCap: 'round' }}
          />
        )}

        {/* Route: main line */}
        {hasRoute && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{ color: '#1d4ed8', weight: 5, opacity: 0.9, lineCap: 'round' }}
          />
        )}

        {/* Route start */}
        {hasRoute && (
          <Marker position={routeCoordinates[0]} icon={startIcon} zIndexOffset={200}>
            <Popup>
              <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 13 }}>Origin</div>
              {routeInfo && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{routeInfo.routeName}</div>}
            </Popup>
            <Tooltip direction="top" offset={[0, -10]} permanent>Origin</Tooltip>
          </Marker>
        )}

        {/* Route end */}
        {hasRoute && (
          <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={endIcon} zIndexOffset={200}>
            <Popup>
              <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>Destination</div>
              {routeInfo && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{routeInfo.routeName}</div>}
            </Popup>
            <Tooltip direction="top" offset={[0, -10]} permanent>Destination</Tooltip>
          </Marker>
        )}

        {/* Bus stops — blue dots */}
        {stops.map((stop, idx) => {
          const isNearestUser = nearestStopToUser?.index === idx;
          const isNearestDriver = driverStopInfo?.driverNearestStopIdx === idx;
          return (
            <Marker
              key={`stop-${idx}`}
              position={[stop.lat, stop.lon]}
              icon={stopIcon(isNearestUser)}
              zIndexOffset={isNearestUser ? 500 : 100}
            >
              <Popup minWidth={200}>
                <div style={{ fontFamily: 'Inter, sans-serif' }}>
                  <div style={{ fontWeight: 700, color: isNearestUser ? '#1d4ed8' : '#111827', fontSize: 13, marginBottom: 4 }}>
                    {stop.name}
                  </div>
                  {isNearestUser && nearestStopToUser && (
                    <div style={{ color: '#1d4ed8', fontSize: 12, lineHeight: 1.5 }}>
                      Nearest to you
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{formatDistance(nearestStopToUser.distanceM)}</div>
                      {walkPath && (
                        <div style={{ marginTop: 2 }}>
                          {formatDistance(walkPath.distanceM)} walk · {formatDuration(walkPath.durationS)}
                        </div>
                      )}
                      {driverStopInfo && (
                        <div style={{ marginTop: 4, color: '#d97706', fontWeight: 600 }}>
                          Bus arrives in ~{driverStopInfo.etaMin} min
                        </div>
                      )}
                    </div>
                  )}
                  {isNearestDriver && !isNearestUser && (
                    <div style={{ color: '#d97706', fontSize: 12, fontWeight: 600 }}>
                      Bus is near here
                    </div>
                  )}
                </div>
              </Popup>
              <Tooltip direction="right" offset={[8, 0]} permanent={isNearestUser} opacity={1}>
                <span style={{ fontSize: 11, fontWeight: isNearestUser ? 700 : 400 }}>
                  {isNearestUser ? `Near · ${stop.name}` : stop.name}
                </span>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Walking route from user → nearest stop */}
        {walkPath?.coords && walkPath.coords.length > 1 && (
          <Polyline
            positions={walkPath.coords}
            pathOptions={{
              color: '#2563eb',
              weight: 4,
              opacity: 0.85,
              dashArray: '8, 10',
              lineCap: 'round',
            }}
          />
        )}

        {/* Fallback straight dashed line while OSRM loads */}
        {!walkPath && walkLoading && nearestStopToUser && userLocation?.latitude && (
          <Polyline
            positions={[
              [userLocation.latitude, userLocation.longitude],
              [nearestStopToUser.lat, nearestStopToUser.lon],
            ]}
            pathOptions={{ color: '#93c5fd', weight: 2, opacity: 0.7, dashArray: '6, 8' }}
          />
        )}

        {/* Live bus marker */}
        {selectedVehicle && (
          <Marker
            position={[selectedVehicle.latitude, selectedVehicle.longitude]}
            icon={busIcon(selectedVehicle.busNumber)}
            zIndexOffset={1000}
          >
            <Popup minWidth={200}>
              <div style={{ fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  {selectedVehicle.label} · {selectedVehicle.busNumber}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {selectedVehicle.latitude.toFixed(5)}, {selectedVehicle.longitude.toFixed(5)}
                </div>
                {driverStopInfo && (
                  <div style={{ color: '#d97706', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                    ~{driverStopInfo.etaMin} min to your nearest stop
                  </div>
                )}
                {selectedVehicle.lastSeen && (
                  <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 3 }}>
                    Updated {new Date(selectedVehicle.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* User location */}
        {userLocation?.latitude && userLocation?.longitude && (
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon} zIndexOffset={900}>
            <Popup minWidth={200}>
              <div style={{ fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Your location</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
                </div>
                {nearestStopToUser && (
                  <div style={{ color: '#1d4ed8', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                    Nearest stop: <span style={{ fontWeight: 600 }}>{nearestStopToUser.name}</span>
                    <div>
                      {walkPath
                        ? `${formatDistance(walkPath.distanceM)} · ${formatDuration(walkPath.durationS)} walk`
                        : formatDistance(nearestStopToUser.distanceM)}
                    </div>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* ─── Custom Map Controls ─── */}
      <MapControls
        mapRef={mapRef}
        userLocation={userLocation}
        selectedVehicle={selectedVehicle}
        hasRoute={hasRoute}
        routeCoordinates={routeCoordinates}
        stops={stops}
      />

      {/* ─── Nearest Stop Overlay ─── */}
      {nearestStopToUser && userLocation && (
        <div
          style={{ zIndex: 1000 }}
          className="absolute bottom-2 left-2 max-w-[220px] rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-lifted backdrop-blur-md sm:bottom-4 sm:left-4 sm:max-w-[280px] sm:px-4 sm:py-3"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Nearest stop
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">{nearestStopToUser.name}</div>
          {walkPath ? (
            <div className="mt-1 text-xs font-medium text-primary">
              {formatDistance(walkPath.distanceM)} · {formatDuration(walkPath.durationS)} walk
            </div>
          ) : walkLoading ? (
            <div className="mt-1 text-xs text-muted-foreground">Calculating route…</div>
          ) : (
            <div className="mt-1 text-xs text-primary font-medium">
              {formatDistance(nearestStopToUser.distanceM)} away
            </div>
          )}
        </div>
      )}

      {/* ─── Bus ETA Overlay (live tracking) ─── */}
      {driverStopInfo && selectedVehicle && (
        <div
          style={{ zIndex: 1000 }}
          className="absolute bottom-2 right-2 max-w-[200px] rounded-2xl border border-amber-200 bg-amber-50/95 px-3 py-2 shadow-lifted backdrop-blur-md sm:bottom-4 sm:right-4 sm:max-w-[260px] sm:px-4 sm:py-3"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700/70 font-semibold">
            Bus ETA
          </div>
          <div className="mt-1 font-display text-2xl text-amber-700">
            ~{driverStopInfo.etaMin} min
          </div>
          <div className="mt-0.5 text-xs text-amber-600">
            {selectedVehicle.busNumber} → {nearestStopToUser?.name || 'your nearest stop'}
          </div>
          <div className="mt-1 text-[10px] text-amber-500">
            {formatDistance(driverStopInfo.distToUserStopM)} away
          </div>
        </div>
      )}
    </div>
  );
}
