import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BusFront, MapPinned, Search, Route, Radio,
  Loader2, ChevronRight, Navigation, Clock,
  AlertCircle, Signal, MapPin
} from "lucide-react";
import { Badge, Button, Card, Input, Label } from "../components/ui.jsx";
import { PublicLiveMap } from "../components/PublicLiveMap.jsx";
import ProfileMenu from "../components/ProfileMenu";
import { usePublicDrivers } from "../hooks/usePublicDrivers";
import { supabase } from "../lib/supabase";
import { clearStoredAuthAccess, getDashboardPath, getPreferredDisplayName } from "../lib/authAccess";
import { haversineDistanceKm } from "../lib/tracking";
import VIZAG_ROUTES, { searchRoutes, fetchRouteGeometry, findRouteByBusCode } from "../data/vizagRoutes.js";

const getRoutePoints = (routeName) => {
  if (!routeName || typeof routeName !== "string") return { from: "", to: "" };
  const parts = routeName.split(/\s+(?:to|→|-|->)\s+/i);
  return {
    from: parts[0] ? parts[0].trim() : "",
    to: parts[1] ? parts[1].trim() : "",
  };
};

export function PublicPage() {
  const liveDrivers = usePublicDrivers();
  const navigate = useNavigate();
  const { userId: routeUserId = "" } = useParams();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("routes");
  const [busCode, setBusCode] = useState("");
  const [selectedBusId, setSelectedBusId] = useState("");
  const [liveFrom, setLiveFrom] = useState("");
  const [liveTo, setLiveTo] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [routeSearch, setRouteSearch] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [routeError, setRouteError] = useState("");

  // Live tracking route state (separate from browse routes)
  const [liveRouteCoords, setLiveRouteCoords] = useState(null);
  const [liveRouteStops, setLiveRouteStops] = useState([]);
  const [liveRouteInfo, setLiveRouteInfo] = useState(null);
  const [liveRouteLoading, setLiveRouteLoading] = useState(false);
  const [followBus, setFollowBus] = useState(true);
  const searchInputRef = useRef(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const nextUser = data?.user || null;
        if (!mounted) return;
        setCurrentUser(nextUser);
        setAuthReady(true);

        if (!nextUser) {
          navigate("/auth?mode=login&role=public-user", { replace: true });
          return;
        }

        // Check auth_accounts for role — this is the source of truth
        const { data: accountRow } = await supabase
          .from("auth_accounts")
          .select("role, display_name")
          .eq("user_id", nextUser.id)
          .maybeSingle();

        // If commuter profile is incomplete (no display name), redirect to setup
        if (accountRow && !accountRow.display_name) {
          navigate("/auth?mode=register&role=public-user", { replace: true });
          return;
        }

        // User is a public-user (or no account row yet) — stay here
        const targetPath = getDashboardPath("public-user", nextUser.id);
        if (window.location.pathname !== targetPath) navigate(targetPath, { replace: true });
      } catch {
        if (mounted) { setAuthReady(true); navigate("/auth?mode=login&role=public-user", { replace: true }); }
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearStoredAuthAccess("public-user");
    navigate("/auth?mode=login&role=public-user");
  };

  // ── User GPS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const tick = () => navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
    );
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Routes ─────────────────────────────────────────────────────────────────
  const filteredRoutes = useMemo(() => searchRoutes(routeSearch), [routeSearch]);

  const handleViewRoute = useCallback(async (route) => {
    setSelectedRoute(route);
    setRouteCoordinates(null);
    setRouteStops([]);
    setRouteError("");
    setLoadingMessage("Fetching from OpenStreetMap…");
    setLoadingRoute(true);
    try {
      const { coordinates, stops } = await fetchRouteGeometry(route.osmRelationId);
      if (!coordinates || coordinates.length === 0) {
        setRouteError("No route geometry found. The OSM mapping may be incomplete.");
      } else {
        setRouteCoordinates(coordinates);
        setRouteStops(stops || []);
      }
    } catch (err) {
      const msg = err.message || "Failed to load route.";
      setRouteError(
        msg.includes("429") || msg.includes("unavailable") || msg.includes("mirrors")
          ? "Map data servers are busy — please wait a moment and try again."
          : msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "Network error loading route data. Please check your connection and try again."
          : msg,
      );
    } finally {
      setLoadingRoute(false);
      setLoadingMessage("");
    }
  }, []);

  // ── Live tracking ──────────────────────────────────────────────────────────
  const uniquePlaces = useMemo(() => {
    const places = new Set();
    if (Array.isArray(VIZAG_ROUTES)) {
      VIZAG_ROUTES.forEach((r) => {
        if (r && r.routeName) {
          const { from, to } = getRoutePoints(r.routeName);
          if (from) places.add(from);
          if (to) places.add(to);
        }
      });
    }
    return Array.from(places).filter(Boolean).sort();
  }, []);

  const matchedRoutes = useMemo(() => {
    let list = Array.isArray(VIZAG_ROUTES) ? VIZAG_ROUTES : [];

    if (liveFrom) {
      list = list.filter((r) => {
        if (!r || !r.routeName) return false;
        const { from } = getRoutePoints(r.routeName);
        return String(from).toLowerCase() === String(liveFrom).toLowerCase();
      });
    }

    if (liveTo) {
      list = list.filter((r) => {
        if (!r || !r.routeName) return false;
        const { to } = getRoutePoints(r.routeName);
        return String(to).toLowerCase() === String(liveTo).toLowerCase();
      });
    }

    if (busCode && typeof busCode === "string" && busCode.trim()) {
      const q = busCode.trim().toLowerCase();
      list = list.filter((r) => {
        if (!r) return false;
        const numberMatch = r.routeNumber ? String(r.routeNumber).toLowerCase().includes(q) : false;
        const nameMatch = r.routeName ? String(r.routeName).toLowerCase().includes(q) : false;
        const viaMatch = r.via ? String(r.via).toLowerCase().includes(q) : false;
        return numberMatch || nameMatch || viaMatch;
      });
    }

    return list;
  }, [liveFrom, liveTo, busCode]);

  const filteredVehicles = useMemo(() => {
    const matchedRouteNumbers = new Set(
      matchedRoutes
        .map((r) => (r && r.routeNumber ? String(r.routeNumber).toLowerCase() : ""))
        .filter(Boolean)
    );

    const driversList = Array.isArray(liveDrivers) ? liveDrivers : [];
    const vehicles = driversList
      .map((d) => {
        if (!d) return null;
        return {
          id: d.id,
          busNumber: d.bus_number || d.bus_code || "?",
          busCode: d.bus_code || "",
          label: d.display_name || `Bus ${d.bus_code || ""}`,
          latitude: Number(d.latitude) || 0,
          longitude: Number(d.longitude) || 0,
          driver: d.display_name || "Driver",
          lastSeen: d.last_seen || null,
        };
      })
      .filter(Boolean);

    return vehicles.filter((v) => v.busCode && matchedRouteNumbers.has(String(v.busCode).toLowerCase()));
  }, [matchedRoutes, liveDrivers]);

  const selectedVehicle = useMemo(
    () => (Array.isArray(filteredVehicles) ? filteredVehicles.find((v) => v && v.id === selectedBusId) || null : null),
    [filteredVehicles, selectedBusId],
  );

  const displayItems = useMemo(() => {
    const items = [];
    if (Array.isArray(matchedRoutes)) {
      matchedRoutes.forEach((route) => {
        if (!route) return;
        const routeNumLower = route.routeNumber ? String(route.routeNumber).toLowerCase() : "";
        const vehiclesOnRoute = Array.isArray(filteredVehicles)
          ? filteredVehicles.filter(
              (v) => v && v.busCode && String(v.busCode).toLowerCase() === routeNumLower
            )
          : [];

        if (vehiclesOnRoute.length > 0) {
          vehiclesOnRoute.forEach((vehicle) => {
            if (!vehicle) return;
            items.push({
              type: "live",
              id: vehicle.id,
              routeNumber: route.routeNumber,
              routeName: route.routeName,
              via: route.via,
              vehicle,
            });
          });
        } else {
          items.push({
            type: "route",
            id: `route:${route.osmRelationId || ""}`,
            routeNumber: route.routeNumber,
            routeName: route.routeName,
            via: route.via,
          });
        }
      });
    }
    return items;
  }, [matchedRoutes, filteredVehicles]);

  const userToBusDistance = useMemo(() => {
    if (!userLocation || !selectedVehicle) return null;
    return haversineDistanceKm(
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: selectedVehicle.latitude, longitude: selectedVehicle.longitude },
    );
  }, [selectedVehicle, userLocation]);

  // When a live bus or offline route is selected, fetch its route geometry + stops
  useEffect(() => {
    let targetOsmRelationId = null;
    let routeInfoObj = null;

    if (selectedVehicle) {
      const route = findRouteByBusCode(selectedVehicle.busCode);
      if (route) {
        targetOsmRelationId = route.osmRelationId;
        routeInfoObj = route;
      }
    } else if (selectedBusId && selectedBusId.startsWith("route:")) {
      const relationId = selectedBusId.replace("route:", "");
      const route = VIZAG_ROUTES.find((r) => r.osmRelationId === relationId);
      if (route) {
        targetOsmRelationId = route.osmRelationId;
        routeInfoObj = route;
      }
    }

    if (!targetOsmRelationId) {
      setLiveRouteCoords(null);
      setLiveRouteStops([]);
      setLiveRouteInfo(null);
      return;
    }

    setLiveRouteInfo(routeInfoObj);
    setLiveRouteLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const { coordinates, stops } = await fetchRouteGeometry(targetOsmRelationId);
        if (cancelled) return;
        setLiveRouteCoords(coordinates?.length > 0 ? coordinates : null);
        setLiveRouteStops(stops || []);
      } catch {
        if (!cancelled) { setLiveRouteCoords(null); setLiveRouteStops([]); }
      } finally {
        if (!cancelled) setLiveRouteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedVehicle?.busCode, selectedBusId]);

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background bg-grain">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-primary/10 animate-pulse-ring" />
            <div className="absolute inset-0 grid place-items-center">
              <BusFront className="h-5 w-5 text-primary" />
            </div>
          </div>
          <span className="text-sm text-muted-foreground">Loading TransitFlow…</span>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      
      {/* ── Full Bleed Map Layer (z-0) ── */}
      <div className="absolute inset-0 z-0">
        {activeTab === "routes" ? (
          <PublicLiveMap
            selectedVehicle={null}
            userLocation={userLocation}
            routeCoordinates={routeCoordinates}
            routeStops={routeStops}
            routeInfo={selectedRoute}
          />
        ) : (
          <PublicLiveMap
            selectedVehicle={selectedVehicle}
            userLocation={userLocation}
            routeCoordinates={liveRouteCoords}
            routeStops={liveRouteStops}
            routeInfo={liveRouteInfo}
            followBus={followBus}
          />
        )}

        {/* Loading / Error states overlaid centrally on the map */}
        {(loadingRoute || liveRouteLoading) && (
          <div className="absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 px-7 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.15)] text-center max-w-xs animate-rise-in backdrop-blur-3xl bg-white/10">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <div className="text-sm font-semibold">{loadingMessage || "Loading route..."}</div>
            </div>
          </div>
        )}
        
        {routeError && !loadingRoute && activeTab === "routes" && (
          <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 w-full max-w-sm pointer-events-none">
            <div className="mx-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm text-red-600 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-3xl pointer-events-auto font-medium">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{routeError}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Top Right Controls (z-20) ── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3 pointer-events-none">

        {userLocation && (
          <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/10 backdrop-blur-3xl px-3 py-1.5 text-xs text-foreground sm:flex shadow-[0_4px_16px_rgba(0,0,0,0.15)] pointer-events-auto font-medium">
            <Navigation className="h-3 w-3 text-green-500" />
            GPS active
          </div>
        )}

      </div>

      {/* ── Mobile Split / Desktop Sidebar (z-10) ── */}
      <div className="absolute inset-x-4 top-4 bottom-4 sm:left-4 sm:right-auto sm:w-[380px] z-10 flex flex-col justify-between sm:justify-start gap-4 pointer-events-none">
        
        {/* Brand & Tabs Panel */}
        <div className={`shrink-0 pointer-events-auto flex-col gap-2.5 sm:gap-4 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/10 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] p-2.5 sm:p-4 ${
          ((activeTab === "routes" && selectedRoute) || (activeTab === "live" && (selectedBusId || liveRouteInfo))) 
            ? "hidden sm:flex" 
            : "flex"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="relative">
                <div className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                  <BusFront className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-green-400 ring-2 ring-background animate-pulse" />
              </div>
              <div>
                <h1 className="font-display text-base sm:text-lg leading-tight text-foreground">TransitFlow</h1>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visakhapatnam</div>
              </div>
            </div>
            
            {currentUser && (
              <div className="pointer-events-auto shadow-soft rounded-full">
                <ProfileMenu user={currentUser} onSignOut={handleSignOut} />
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 rounded-2xl border border-white/5 bg-white/5 p-1 w-full backdrop-blur-3xl">
            {[
              { id: "routes", icon: Route,  label: "Browse Routes" },
              { id: "live",   icon: Radio,  label: "Live Tracking" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={[
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 sm:py-2 text-xs font-medium transition-all duration-200",
                  activeTab === id
                    ? "bg-white/20 backdrop-blur-md text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-white/10 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10",
                ].join(" ")}
              >
                <Icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-colors ${activeTab === id ? "text-primary" : ""}`} />
                {label}
                {id === "live" && filteredVehicles.length > 0 && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
                    {filteredVehicles.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Content Wrapper */}
        <div className="flex flex-col justify-end sm:justify-start pointer-events-none flex-1 min-h-0">
          
          {/* Dynamic Content Panel (Search & List) */}
          <div className={`flex-1 min-h-0 max-h-[35vh] sm:max-h-none flex-col pointer-events-auto overflow-hidden rounded-3xl border border-white/10 bg-white/10 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] ${
            ((activeTab === "routes" && selectedRoute) || (activeTab === "live" && (selectedBusId || liveRouteInfo))) 
              ? "hidden sm:flex" 
              : "flex"
          }`}>
            
            {/* SEARCH HEADER */}
            <div className="p-4 border-b border-white/10 shrink-0 bg-white/5">
              {activeTab === "routes" ? (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      value={routeSearch}
                    onChange={(e) => setRouteSearch(e.target.value)}
                    placeholder="Search route number, name, via..."
                    className="pl-9 h-9 text-sm bg-white/10 border-white/10 focus:bg-white/20 text-foreground placeholder:text-foreground/50 transition-all backdrop-blur-md"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                  <span>{filteredRoutes.length} routes</span>
                  {routeSearch && (
                    <button onClick={() => setRouteSearch("")} className="text-primary hover:underline">Clear</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Signal className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold">Find a bus</span>
                  </div>
                  {(liveFrom || liveTo || busCode) && (
                    <button
                      onClick={() => { setLiveFrom(""); setLiveTo(""); setBusCode(""); setSelectedBusId(""); }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="w-full rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-xs transition-all hover:bg-white/20 focus:bg-white/20 focus:outline-none text-foreground backdrop-blur-md"
                    value={liveFrom}
                    onChange={(e) => { setLiveFrom(e.target.value); setSelectedBusId(""); }}
                  >
                    <option value="">Origin...</option>
                    {uniquePlaces.map((place) => (
                      <option key={`from-${place}`} value={place}>{place}</option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-xs transition-all hover:bg-white/20 focus:bg-white/20 focus:outline-none text-foreground backdrop-blur-md"
                    value={liveTo}
                    onChange={(e) => { setLiveTo(e.target.value); setSelectedBusId(""); }}
                  >
                    <option value="">Destination...</option>
                    {uniquePlaces.map((place) => (
                      <option key={`to-${place}`} value={place}>{place}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busCode}
                    onChange={(e) => { setBusCode(e.target.value); setSelectedBusId(""); }}
                    placeholder="Search code (e.g. 25P)"
                    className="pl-8 text-xs py-1.5 h-8 bg-white/10 border-white/10 focus:bg-white/20 text-foreground placeholder:text-foreground/50 transition-all backdrop-blur-md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* LIST */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1.5 pr-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/50">
            {activeTab === "routes" && filteredRoutes.map((route, idx) => {
              const isSelected = selectedRoute?.osmRelationId === route.osmRelationId;
              return (
                <button
                  key={`${route.osmRelationId}-${idx}`}
                  onClick={() => handleViewRoute(route)}
                  className={[
                    "w-full rounded-xl text-left transition-all duration-200 group px-3 py-2.5",
                    isSelected
                      ? "bg-primary/20 border-primary/30 shadow-sm backdrop-blur-md"
                      : "bg-transparent hover:bg-white/10 border border-transparent",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span className={[
                      "shrink-0 rounded-lg px-2 py-1 text-xs font-bold tracking-wide transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-white/10 text-foreground group-hover:bg-white/20 group-hover:backdrop-blur-md group-hover:shadow-sm border border-white/5",
                    ].join(" ")}>
                      {route.routeNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`truncate text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {route.routeName}
                      </div>
                      {route.via && (
                        <div className="truncate text-[11px] text-muted-foreground">via {route.via}</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {activeTab === "live" && displayItems.length === 0 && (
              <div className="px-4 py-8 text-center">
                <BusFront className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                <div className="text-sm font-medium text-muted-foreground">No matches found</div>
              </div>
            )}

            {activeTab === "live" && displayItems.map((item) => {
              const isSelected = selectedBusId === item.id;
              const isLive = item.type === "live";

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedBusId(isSelected ? "" : item.id)}
                  className={[
                    "w-full rounded-xl text-left transition-all duration-200 group p-3 border",
                    isSelected
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-transparent bg-transparent hover:bg-secondary/60",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={[
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold transition-colors shadow-sm",
                        isSelected
                          ? (isLive ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground")
                          : (isLive ? "bg-amber-100 text-amber-700" : "bg-card text-foreground border border-border/50"),
                      ].join(" ")}>
                        {item.routeNumber}
                      </div>
                      <div>
                        <div className={`text-sm font-semibold leading-tight ${isSelected ? "text-foreground" : "text-foreground/90"}`}>
                          {item.routeName}
                        </div>
                        {isLive ? (
                          <div className="text-[11px] font-medium text-amber-600/90 mt-0.5 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {item.vehicle.label}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            via {item.via || "Direct"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          </div>

          {/* Selected Item Info Panel (Bottom of left sidebar) */}
          {((activeTab === "routes" && selectedRoute) || (activeTab === "live" && (selectedBusId || liveRouteInfo))) && (
            <div className="shrink-0 pointer-events-auto p-4 animate-rise-in relative rounded-3xl border border-white/10 bg-white/10 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] mt-3 sm:mt-0">
              <button 
              onClick={() => {
                if (activeTab === "routes") setSelectedRoute(null);
                else setSelectedBusId("");
              }}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary p-1 rounded-full transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l8 8M10 2l-8 8"/></svg>
            </button>
            
            {activeTab === "routes" && selectedRoute && (
              <>
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-md shadow-sm">
                    {selectedRoute.routeNumber}
                  </div>
                  <div className="text-sm font-bold truncate">{selectedRoute.routeName}</div>
                </div>
                
                <div className="text-xs text-muted-foreground mb-3">
                  {routeStops.length > 0 ? (
                    <span className="flex items-center gap-1 text-foreground font-medium"><MapPin className="h-3 w-3 text-blue-500"/> {routeStops.length} stops mapped</span>
                  ) : loadingRoute ? (
                    <span className="animate-pulse">Loading map data...</span>
                  ) : (
                    "No stop data available."
                  )}
                </div>

                {routeStops.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="default" className="w-full h-8 text-xs bg-primary/90 hover:bg-primary">
                      View full schedule
                    </Button>
                  </div>
                )}
              </>
            )}

            {activeTab === "live" && selectedVehicle && (
              <>
                <div className="flex items-center gap-2 mb-2 pr-6">
                   <div className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-sm">
                    {selectedVehicle.busNumber}
                  </div>
                  <div className="text-sm font-bold truncate">{selectedVehicle.label}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-2 text-muted-foreground">
                     <Clock className="h-3 w-3" />
                     {selectedVehicle.lastSeen ? new Date(selectedVehicle.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-2 text-muted-foreground">
                    <Navigation className="h-3 w-3" /> 
                    <span className="truncate">{selectedVehicle.latitude.toFixed(4)}, {selectedVehicle.longitude.toFixed(4)}</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className={`w-full h-8 text-xs transition-colors ${followBus ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : ''}`}
                  onClick={() => setFollowBus(!followBus)}
                >
                   {followBus ? 'Following Bus' : 'Follow on Map'}
                </Button>
              </>
            )}

            {activeTab === "live" && !selectedVehicle && liveRouteInfo && (
              <>
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-md shadow-sm">
                    {liveRouteInfo.routeNumber}
                  </div>
                  <div className="text-sm font-bold truncate">{liveRouteInfo.routeName}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                   Viewing route path. No active buses currently matching this selection.
                </div>
              </>
            )}

          </div>
        )}

        </div>
      </div>
    </div>
  );
}

