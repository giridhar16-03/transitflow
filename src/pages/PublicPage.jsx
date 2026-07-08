import { useMemo, useState, useEffect, useCallback } from "react";
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
    <div className="min-h-screen bg-background bg-grain">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                <BusFront className="h-4 w-4" />
              </div>
              {/* live pulse */}
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-background animate-pulse" />
            </div>
            <div>
              <span className="font-display text-base leading-none">TransitFlow</span>
              <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">Visakhapatnam</div>
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center gap-3">
              {userLocation && (
                <div className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                  <Navigation className="h-3 w-3 text-green-500" />
                  GPS active
                </div>
              )}
              <ProfileMenu user={currentUser} onSignOut={handleSignOut} />
            </div>
          )}
        </div>
      </header>

      {/* ── Hero strip ── */}
      <div className="bg-ambient border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl text-foreground sm:text-2xl">
                {currentUser ? `Hi, ${getPreferredDisplayName(currentUser)}` : "TransitFlow"}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Track buses across Visakhapatnam</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 md:py-10">

        {/* ── Tab bar ── */}
        <div className="mb-5 flex gap-1 rounded-2xl border border-border bg-secondary/50 p-1 w-full sm:w-fit sm:mb-8 sm:gap-2 sm:p-1.5">
          {[
            { id: "routes", icon: Route,  label: "Browse Routes" },
            { id: "live",   icon: Radio,  label: "Live Tracking" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 sm:flex-initial sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm",
                activeTab === id
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Icon className={`h-4 w-4 transition-colors ${activeTab === id ? "text-primary" : ""}`} />
              {label}
              {id === "live" && filteredVehicles.length > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
                  {filteredVehicles.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════ ROUTES TAB ══════════════════ */}
        {activeTab === "routes" && (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[420px_1fr]">

            {/* Left column */}
            <div className="space-y-4">

              {/* Search */}
              <Card className="p-4 shadow-soft">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={routeSearch}
                    onChange={(e) => setRouteSearch(e.target.value)}
                    placeholder="Search route number, name, via…"
                    className="pl-9"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filteredRoutes.length} routes found</span>
                  {routeSearch && (
                    <button
                      onClick={() => setRouteSearch("")}
                      className="text-primary hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </Card>

              {/* Route list */}
              <div className="max-h-[calc(100vh-320px)] min-h-[24rem] space-y-2 overflow-y-auto pr-1">
                {filteredRoutes.map((route, idx) => {
                  const isSelected = selectedRoute?.osmRelationId === route.osmRelationId;
                  return (
                    <button
                      key={`${route.osmRelationId}-${idx}`}
                      onClick={() => handleViewRoute(route)}
                      className={[
                        "w-full rounded-2xl border text-left transition-all duration-200 group",
                        isSelected
                          ? "border-primary/40 bg-card shadow-lifted"
                          : "border-border bg-card/60 hover:border-border hover:bg-card hover:shadow-soft",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3 p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={[
                              "shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tracking-wide",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground",
                            ].join(" ")}>
                              {route.routeNumber}
                            </span>
                            <span className="truncate text-sm font-medium">{route.routeName}</span>
                          </div>
                          {route.via && (
                            <div className="mt-1.5 truncate text-xs text-muted-foreground">
                              via {route.via}
                            </div>
                          )}
                        </div>
                        <ChevronRight className={[
                          "h-4 w-4 shrink-0 transition-all duration-200",
                          isSelected
                            ? "text-primary rotate-90"
                            : "text-muted-foreground group-hover:translate-x-0.5",
                        ].join(" ")} />
                      </div>

                      {/* Selected expanded footer */}
                      {isSelected && !loadingRoute && (
                        <div className="border-t border-border/50 px-4 py-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {routeStops.length > 0 ? (
                              <>
                                <MapPin className="h-3 w-3 text-blue-500" />
                                <span>{routeStops.length} stops mapped</span>
                              </>
                            ) : routeError ? (
                              <>
                                <AlertCircle className="h-3 w-3 text-destructive" />
                                <span className="text-destructive">Could not load stops</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground/60">Loading stops…</span>
                            )}
                          </div>
                          {routeCoordinates && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                              Route loaded
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: map */}
            <div className="flex flex-col gap-4">
              {/* Map header */}
              <div className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedRoute
                    ? `Route ${selectedRoute.routeNumber} · ${selectedRoute.routeName}`
                    : "Select a route to view"}
                </span>
              </div>

              {/* Map card */}
              <Card className="relative overflow-hidden p-0 shadow-lifted flex-1">

                {/* Loading overlay */}
                {loadingRoute && (
                  <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/70 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card border border-border px-7 py-5 shadow-lifted text-center max-w-xs animate-rise-in">
                      <div className="relative">
                        <Loader2 className="h-7 w-7 animate-spin text-primary" />
                        <div className="absolute inset-0 h-7 w-7 rounded-full border-2 border-primary/20" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{loadingMessage || "Loading route…"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Retries automatically on rate limits
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {routeError && !loadingRoute && (
                  <div className="absolute top-4 left-1/2 z-[999] -translate-x-1/2 w-[calc(100%-2rem)]">
                    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-soft backdrop-blur-sm">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>{routeError}</div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!selectedRoute && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-secondary/30">
                    <div className="flex flex-col items-center gap-3 text-center px-8">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary border border-border shadow-soft">
                        <Route className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="text-sm font-medium text-foreground">No route selected</div>
                      <div className="text-xs text-muted-foreground max-w-[200px]">
                        Click any route on the left to view its path and bus stops
                      </div>
                    </div>
                  </div>
                )}

                <div className="h-[50vh] min-h-[18rem] sm:h-[calc(100vh-340px)] sm:min-h-[26rem]">
                  <PublicLiveMap
                    selectedVehicle={null}
                    userLocation={userLocation}
                    routeCoordinates={routeCoordinates}
                    routeStops={routeStops}
                    routeInfo={selectedRoute}
                  />
                </div>
              </Card>

              {/* Route info strip — icon-based, no emoji */}
              {selectedRoute && routeCoordinates && !loadingRoute && (
                <div className="flex flex-wrap items-center gap-3 animate-fade-up">
                  <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Origin
                  </div>
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                  {routeStops.length > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                      <MapPin className="h-3 w-3" />
                      {routeStops.length} stops
                    </div>
                  )}
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                  <div className="flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/5 px-3 py-1 text-xs font-semibold text-destructive">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    Destination
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ LIVE TRACKING TAB ══════════════════ */}
        {activeTab === "live" && (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[420px_1fr]">

            {/* Left column */}
            <div className="space-y-4">

              {/* Search card */}
              <Card className="p-4 shadow-soft space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Signal className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Find a bus</span>
                  </div>
                  {(liveFrom || liveTo || busCode) && (
                    <button
                      onClick={() => { setLiveFrom(""); setLiveTo(""); setBusCode(""); setSelectedBusId(""); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                {/* From / To dropdown selects */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label htmlFor="liveFrom" className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
                    <select
                      id="liveFrom"
                      className="mt-1 w-full rounded-xl border border-border bg-secondary/60 px-2.5 py-2 text-xs transition-colors hover:border-primary focus:border-primary focus:outline-none"
                      value={liveFrom}
                      onChange={(e) => { setLiveFrom(e.target.value); setSelectedBusId(""); }}
                    >
                      <option value="">— Any Origin —</option>
                      {uniquePlaces.map((place) => (
                        <option key={`from-${place}`} value={place}>{place}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="liveTo" className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
                    <select
                      id="liveTo"
                      className="mt-1 w-full rounded-xl border border-border bg-secondary/60 px-2.5 py-2 text-xs transition-colors hover:border-primary focus:border-primary focus:outline-none"
                      value={liveTo}
                      onChange={(e) => { setLiveTo(e.target.value); setSelectedBusId(""); }}
                    >
                      <option value="">— Any Destination —</option>
                      {uniquePlaces.map((place) => (
                        <option key={`to-${place}`} value={place}>{place}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="busSearch" className="text-[10px] uppercase tracking-wider text-muted-foreground">Search code or number</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="busSearch"
                      value={busCode}
                      onChange={(e) => { setBusCode(e.target.value); setSelectedBusId(""); }}
                      placeholder="e.g. 25P, 10K"
                      className="pl-9 text-xs py-2 h-9"
                    />
                  </div>
                </div>
              </Card>

              {/* Stats strip */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 text-center shadow-soft">
                  <div className="font-display text-3xl text-gradient-warm">{filteredVehicles.length}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Active buses</div>
                </Card>
                <Card className="p-4 text-center shadow-soft">
                  <div className="font-display text-3xl text-gradient-warm">
                    {displayItems.length}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    Matching routes
                  </div>
                </Card>
              </div>

              {/* Bus cards / Routes cards list */}
              <div className="max-h-[40vh] min-h-[10rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[calc(100vh-400px)] sm:min-h-[18rem]">
                {displayItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-5 py-8 text-center">
                    <BusFront className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                    <div className="text-sm font-medium text-foreground">No matches found</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Try adjusting origin/destination filters or search query.
                    </div>
                  </div>
                ) : (
                  displayItems.map((item) => {
                    const isSelected = selectedBusId === item.id;
                    const isLive = item.type === "live";

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedBusId(isSelected ? "" : item.id)}
                        className={[
                          "w-full rounded-2xl border text-left transition-all duration-200 group",
                          isSelected
                            ? "border-primary/40 bg-card shadow-lifted"
                            : "border-border bg-card/60 hover:bg-card hover:shadow-soft",
                        ].join(" ")}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className={[
                                "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold transition-colors",
                                isSelected
                                  ? (isLive ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground")
                                  : (isLive ? "bg-amber-100 text-amber-700" : "bg-secondary text-secondary-foreground"),
                              ].join(" ")}>
                                {item.routeNumber}
                              </div>
                              <div>
                                <div className="text-sm font-semibold">{item.routeName}</div>
                                {isLive ? (
                                  <div className="text-xs text-muted-foreground">{item.vehicle.label} · Active</div>
                                ) : (
                                  <div className="text-xs text-muted-foreground/70">via {item.via || "Direct"}</div>
                                )}
                              </div>
                            </div>
                            {isLive ? (
                              <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                Live
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 rounded-full bg-secondary border border-border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Route Only
                              </div>
                            )}
                          </div>

                          {isLive && (
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-2">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground truncate">
                                  {item.vehicle.latitude.toFixed(4)}, {item.vehicle.longitude.toFixed(4)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-2">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {item.vehicle.lastSeen
                                    ? new Date(item.vehicle.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

              {/* Right: live map */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Radio className="h-4 w-4 text-primary" />
                    {selectedVehicle && (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {selectedVehicle
                      ? `Tracking ${selectedVehicle.busNumber} · ${selectedVehicle.label}`
                      : (liveRouteInfo
                        ? `Viewing Route ${liveRouteInfo.routeNumber} · ${liveRouteInfo.routeName}`
                        : "Real-time tracking")}
                  </span>
                </div>
                {userLocation && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <Navigation className="h-3 w-3" /> Your GPS is active
                  </div>
                )}
              </div>

              <Card className="relative overflow-hidden p-0 shadow-lifted flex-1">

                {/* Empty state */}
                {!selectedVehicle && !liveRouteInfo && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-secondary/30">
                    <div className="flex flex-col items-center gap-3 text-center px-8">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary border border-border shadow-soft">
                        <Radio className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="text-sm font-medium">Select a route or live bus</div>
                      <div className="text-xs text-muted-foreground max-w-[220px]">
                        Select any route/live bus card from the list to view route path and stops
                      </div>
                    </div>
                  </div>
                )}

                {liveRouteLoading && (
                  <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/70 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card border border-border px-7 py-5 shadow-lifted text-center max-w-xs animate-rise-in">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      <div className="text-sm font-semibold">Loading route for {selectedVehicle?.busCode}…</div>
                    </div>
                  </div>
                )}

                <div className="h-[50vh] min-h-[18rem] sm:h-[calc(100vh-340px)] sm:min-h-[26rem]">
                  <PublicLiveMap
                    selectedVehicle={selectedVehicle}
                    userLocation={userLocation}
                    routeCoordinates={liveRouteCoords}
                    routeStops={liveRouteStops}
                    routeInfo={liveRouteInfo}
                    followBus={followBus}
                  />
                </div>
              </Card>

              {/* Selected bus info strip */}
              {(selectedVehicle || liveRouteInfo) && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 animate-fade-up">
                  <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                    <BusFront className="h-3.5 w-3.5" /> {selectedVehicle ? selectedVehicle.busNumber : liveRouteInfo.routeNumber}
                  </div>
                  {selectedVehicle ? (
                    <>
                      {userToBusDistance != null && (
                        <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                          <MapPin className="h-3 w-3" /> {userToBusDistance.toFixed(2)} km
                        </div>
                      )}
                      {selectedVehicle.lastSeen && (
                        <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                          <Clock className="h-3 w-3" />
                          {new Date(selectedVehicle.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      <button
                        onClick={() => setFollowBus((p) => !p)}
                        className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shadow-sm ${
                          followBus
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        <Navigation className="h-3 w-3" /> {followBus ? 'Following' : 'Follow'}
                      </button>
                    </>
                  ) : (
                    <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                      <Route className="h-3 w-3" /> Route view
                    </div>
                  )}
                  {liveRouteStops.length > 0 && (
                    <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                      <MapPin className="h-3 w-3" /> {liveRouteStops.length} stops
                    </div>
                  )}
                  <button
                    onClick={() => { setSelectedBusId(""); setFollowBus(true); }}
                    className="shrink-0 ml-auto flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
