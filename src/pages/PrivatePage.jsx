import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BusFront, Search, Route, Radio,
  Loader2, Navigation, Clock,
  AlertCircle, Signal, MapPin
} from "lucide-react";
import { Button, Input } from "../components/ui.jsx";
import { PublicLiveMap } from "../components/PublicLiveMap.jsx";
import ProfileMenu from "../components/ProfileMenu";
import { usePrivateDrivers } from "../hooks/usePrivateDrivers";
import { supabase } from "../lib/supabase";
import { clearStoredAuthAccess } from "../lib/authAccess";
import { fetchFullDrivingRoute } from "../data/vizagRoutes";

export function PrivatePage() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("routes");
  const [busCode, setBusCode] = useState("");
  const [selectedBusId, setSelectedBusId] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [routeSearch, setRouteSearch] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(null);
  
  const [followBus, setFollowBus] = useState(true);
  const searchInputRef = useRef(null);

  // Institution State
  const [institution, setInstitution] = useState(null);
  const [institutionRoutes, setInstitutionRoutes] = useState([]);
  const [loadingInst, setLoadingInst] = useState(true);

  // Pass institutionId to the hook
  const liveDrivers = usePrivateDrivers(institution?.id);

  // ── Auth & Institution Fetch ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        
        if (!user) {
          navigate("/auth?mode=login&role=private-user", { replace: true });
          return;
        }

        setCurrentUser(user);

        // Fetch user's institution mapping
        const { data: instUser } = await supabase
          .from("institution_users")
          .select("institution_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!instUser) {
          // Fallback check auth_accounts (for drivers/admins)
          const { data: accountRow } = await supabase
            .from("auth_accounts")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();
            
          if (!accountRow || !accountRow.role.startsWith("private")) {
             navigate("/auth?mode=login&role=private-user", { replace: true });
             return;
          }
        }

        const institutionId = instUser?.institution_id;
        
        if (institutionId) {
          // Fetch institution details
          const { data: instData } = await supabase
            .from("institutions")
            .select("*")
            .eq("id", institutionId)
            .single();
            
          if (mounted && instData) setInstitution(instData);

          // Fetch private routes
          const { data: routesData } = await supabase
            .from("routes")
            .select("*")
            .eq("institution_id", institutionId);
            
          if (mounted && routesData) setInstitutionRoutes(routesData);
        }

        setAuthReady(true);
        setLoadingInst(false);
      } catch {
        if (mounted) { setAuthReady(true); setLoadingInst(false); }
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearStoredAuthAccess("private-user");
    navigate("/auth?mode=login&role=private-user");
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

  // ── Routes Filtering ───────────────────────────────────────────────────────
  const filteredRoutes = useMemo(() => {
    if (!routeSearch) return institutionRoutes;
    const q = routeSearch.toLowerCase();
    return institutionRoutes.filter(r => 
      (r.bus_number && String(r.bus_number).toLowerCase().includes(q)) ||
      (r.route_name && r.route_name.toLowerCase().includes(q))
    );
  }, [routeSearch, institutionRoutes]);

  const handleViewRoute = useCallback((route) => {
    setSelectedRoute(route);
  }, []);

  // ── Live Tracking Filtering ────────────────────────────────────────────────
  const matchedVehicles = useMemo(() => {
    let list = Array.isArray(liveDrivers) ? liveDrivers : [];
    
    if (busCode && typeof busCode === "string" && busCode.trim()) {
      const q = busCode.trim().toLowerCase();
      list = list.filter(d => 
        (d.bus_code && String(d.bus_code).toLowerCase().includes(q)) ||
        (d.bus_number && String(d.bus_number).toLowerCase().includes(q))
      );
    }
    
    return list.map(d => ({
      id: d.id,
      busNumber: d.bus_number || d.bus_code || "?",
      busCode: d.bus_code || "",
      label: d.display_name || `Bus ${d.bus_number || d.bus_code || ""}`,
      latitude: Number(d.latitude) || 0,
      longitude: Number(d.longitude) || 0,
      driver: d.display_name || "Driver",
      lastSeen: d.last_seen || null,
    }));
  }, [liveDrivers, busCode]);

  const selectedVehicle = useMemo(
    () => matchedVehicles.find((v) => v.id === selectedBusId) || null,
    [matchedVehicles, selectedBusId],
  );
  
  // Find route info for the selected vehicle
  const liveRouteInfo = useMemo(() => {
    if (!selectedVehicle) return null;
    return institutionRoutes.find(r => r.bus_number === selectedVehicle.busNumber || r.bus_number === selectedVehicle.busCode) || null;
  }, [selectedVehicle, institutionRoutes]);

  // Extract stops logic
  const selectedRouteCoordinates = useMemo(() => {
    if (activeTab === "routes" && selectedRoute?.stops) {
      return selectedRoute.stops.map(s => [s.lat, s.lng]);
    }
    if (activeTab === "live" && liveRouteInfo?.stops) {
      return liveRouteInfo.stops.map(s => [s.lat, s.lng]);
    }
    return null;
  }, [activeTab, selectedRoute, liveRouteInfo]);

  const allInstitutionStops = useMemo(() => {
    const all = [];
    const seen = new Set();
    institutionRoutes.forEach(r => {
      if (r.stops) {
        r.stops.forEach(s => {
          const key = `${s.lat}-${s.lng || s.lon}`;
          if (!seen.has(key)) {
            seen.add(key);
            all.push(s);
          }
        });
      }
    });
    return all;
  }, [institutionRoutes]);

  const selectedRouteStops = useMemo(() => {
    if (activeTab === "routes" && selectedRoute?.stops) {
      return selectedRoute.stops;
    }
    if (activeTab === "live" && liveRouteInfo?.stops) {
      return liveRouteInfo.stops;
    }
    if (activeTab === "live" && !selectedVehicle) {
      return allInstitutionStops;
    }
    return [];
  }, [activeTab, selectedRoute, liveRouteInfo, selectedVehicle, allInstitutionStops]);

  const [routePolyline, setRoutePolyline] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (selectedRouteStops && selectedRouteStops.length > 1) {
      fetchFullDrivingRoute(selectedRouteStops).then(coords => {
        if (mounted && coords && coords.length > 0) {
          setRoutePolyline(coords);
        } else if (mounted) {
          setRoutePolyline(null);
        }
      });
    } else {
      setRoutePolyline(null);
    }
    return () => { mounted = false; };
  }, [selectedRouteStops]);

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (!authReady || loadingInst) {
    return (
      <div className="grid min-h-screen place-items-center bg-background bg-grain">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-primary/10 animate-pulse-ring" />
            <div className="absolute inset-0 grid place-items-center">
              <BusFront className="h-5 w-5 text-primary" />
            </div>
          </div>
          <span className="text-sm text-muted-foreground">Loading Private Dashboard…</span>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      
      {/* ── Full Bleed Map Layer (z-0) ── */}
      <div className="absolute inset-0 z-0">
        <PublicLiveMap
          selectedVehicle={activeTab === "live" ? selectedVehicle : null}
          allVehicles={activeTab === "live" ? matchedVehicles : []}
          userLocation={userLocation}
          routeCoordinates={routePolyline || selectedRouteCoordinates}
          routeStops={selectedRouteStops}
          routeInfo={activeTab === "routes" ? selectedRoute : liveRouteInfo}
          followBus={activeTab === "live" ? followBus : false}
        />
      </div>

      {/* ── Top Right Controls (z-20) ── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3 pointer-events-none">
        {userLocation && (
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-3xl px-3 py-1.5 text-xs text-foreground sm:flex shadow-sm pointer-events-auto font-medium">
            <Navigation className="h-3 w-3 text-green-500" />
            GPS active
          </div>
        )}
      </div>

      {/* ── Mobile Split / Desktop Sidebar (z-10) ── */}
      <div className="absolute inset-x-4 top-4 bottom-4 sm:left-4 sm:right-auto sm:w-[380px] z-10 flex flex-col justify-between sm:justify-start gap-4 pointer-events-none">
        
        {/* Brand & Tabs Panel */}
        <div className={`shrink-0 pointer-events-auto flex-col gap-2.5 sm:gap-4 rounded-2xl sm:rounded-3xl border border-border bg-white/40 dark:bg-black/40 backdrop-blur-3xl shadow-sm p-2.5 sm:p-4 ${
          ((activeTab === "routes" && selectedRoute) || (activeTab === "live" && selectedBusId)) 
            ? "hidden sm:flex" 
            : "flex"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="relative">
                <div className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <BusFront className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
              <div>
                <h1 className="font-display text-base sm:text-lg leading-tight text-foreground">{institution?.institution_name || "Institution Dashboard"}</h1>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{institution?.institution_code || "Private Fleet"}</div>
              </div>
            </div>
            
            {currentUser && (
              <div className="pointer-events-auto shadow-sm rounded-full bg-background/50">
                <ProfileMenu user={currentUser} onSignOut={handleSignOut} />
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 rounded-2xl border border-border bg-background/40 p-1 w-full backdrop-blur-3xl">
            {[
              { id: "routes", icon: Route,  label: "Institution Routes" },
              { id: "live",   icon: Radio,  label: "Live Tracking" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={[
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 sm:py-2 text-xs font-medium transition-all duration-200",
                  activeTab === id
                    ? "bg-background backdrop-blur-md text-foreground shadow-sm border border-border font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                ].join(" ")}
              >
                <Icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-colors ${activeTab === id ? "text-primary" : ""}`} />
                {label}
                {id === "live" && matchedVehicles.length > 0 && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
                    {matchedVehicles.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Content Wrapper */}
        <div className="flex flex-col justify-end sm:justify-start pointer-events-none flex-1 min-h-0">
          
          {/* Dynamic Content Panel (Search & List) */}
          <div className={`flex-1 min-h-0 max-h-[35vh] sm:max-h-none flex-col pointer-events-auto overflow-hidden rounded-3xl border border-border bg-white/40 dark:bg-black/40 backdrop-blur-3xl shadow-sm ${
            ((activeTab === "routes" && selectedRoute) || (activeTab === "live" && selectedBusId)) 
              ? "hidden sm:flex" 
              : "flex"
          }`}>
            
            {/* SEARCH HEADER */}
            <div className="p-4 border-b border-border shrink-0 bg-background/50">
              {activeTab === "routes" ? (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      value={routeSearch}
                    onChange={(e) => setRouteSearch(e.target.value)}
                    placeholder="Search route name or bus code..."
                    className="pl-9 h-9 text-sm bg-background border-border text-foreground transition-all shadow-sm"
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
                     <span className="text-sm font-semibold text-foreground">Find a live bus</span>
                  </div>
                  {busCode && (
                    <button
                      onClick={() => { setBusCode(""); setSelectedBusId(""); }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busCode}
                    onChange={(e) => { setBusCode(e.target.value); setSelectedBusId(""); }}
                    placeholder="Search bus code..."
                    className="pl-8 text-xs py-1.5 h-8 bg-background border-border text-foreground transition-all shadow-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* LIST */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1.5 pr-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
            {activeTab === "routes" && filteredRoutes.map((route) => {
              const isSelected = selectedRoute?.id === route.id;
              return (
                <button
                  key={route.id}
                  onClick={() => handleViewRoute(route)}
                  className={[
                    "w-full rounded-xl text-left transition-all duration-200 group px-3 py-2.5",
                    isSelected
                      ? "bg-primary/10 border-primary/30 shadow-sm backdrop-blur-md border"
                      : "bg-background/60 hover:bg-background border border-border shadow-sm",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span className={[
                      "shrink-0 rounded-lg px-2 py-1 text-xs font-bold tracking-wide transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-foreground border border-border",
                    ].join(" ")}>
                      {route.bus_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`truncate text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {route.route_name}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {route.stops?.length || 0} stops
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {activeTab === "live" && matchedVehicles.length === 0 && (
              <div className="px-4 py-8 text-center mt-10">
                <BusFront className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                <div className="text-sm font-medium text-foreground">No buses live right now.</div>
              </div>
            )}

            {activeTab === "live" && matchedVehicles.map((item) => {
              const isSelected = selectedBusId === item.id;
              
              // Find the route name for this live bus if we have it
              const localRoute = institutionRoutes.find(r => r.bus_number === item.busNumber || r.bus_number === item.busCode);

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedBusId(isSelected ? "" : item.id)}
                  className={[
                    "w-full rounded-xl text-left transition-all duration-200 group p-3 border",
                    isSelected
                      ? "border-primary/40 bg-primary/10 shadow-sm"
                      : "border-border bg-background/60 hover:bg-background shadow-sm",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={[
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold transition-colors shadow-sm",
                        isSelected
                          ? "bg-amber-500 text-white" 
                          : "bg-amber-100 text-amber-700 border border-amber-200/50",
                      ].join(" ")}>
                        {item.busNumber}
                      </div>
                      <div>
                        <div className={`text-sm font-semibold leading-tight ${isSelected ? "text-foreground" : "text-foreground/90"}`}>
                          {localRoute?.route_name || item.label}
                        </div>
                        <div className="text-[11px] font-medium text-amber-600/90 mt-0.5 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          {item.driver}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          </div>

          {/* Selected Item Info Panel (Bottom of left sidebar) */}
          {((activeTab === "routes" && selectedRoute) || (activeTab === "live" && selectedBusId)) && (
            <div className="shrink-0 pointer-events-auto p-4 animate-rise-in relative rounded-3xl border border-border bg-background shadow-sm mt-3 sm:mt-0">
              <button 
                onClick={() => {
                  if (activeTab === "routes") setSelectedRoute(null);
                  else setSelectedBusId("");
                }}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 p-1 rounded-full transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            
            {activeTab === "routes" && selectedRoute && (
              <>
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-md shadow-sm">
                    {selectedRoute.bus_number}
                  </div>
                  <div className="text-sm font-bold truncate">{selectedRoute.route_name}</div>
                </div>
                
                <div className="text-xs text-muted-foreground mb-3 flex flex-col gap-1">
                  {selectedRoute.stops?.length > 0 ? (
                    <span className="flex items-center gap-1 text-foreground font-medium"><MapPin className="h-3 w-3 text-blue-500"/> {selectedRoute.stops.length} stops mapped</span>
                  ) : (
                    "No stop data available."
                  )}
                </div>
              </>
            )}

            {activeTab === "live" && selectedVehicle && (
              <>
                <div className="flex items-center gap-2 mb-2 pr-6">
                   <div className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-sm">
                    {selectedVehicle.busNumber}
                  </div>
                  <div className="text-sm font-bold truncate">{liveRouteInfo?.route_name || selectedVehicle.label}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-2 text-muted-foreground">
                     <Clock className="h-3 w-3" />
                     {selectedVehicle.lastSeen ? new Date(selectedVehicle.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-2 text-muted-foreground">
                    <Navigation className="h-3 w-3" /> 
                    <span className="truncate">{selectedVehicle.latitude.toFixed(4)}, {selectedVehicle.longitude.toFixed(4)}</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className={`w-full h-8 text-xs transition-colors ${followBus ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30' : ''}`}
                  onClick={() => setFollowBus(!followBus)}
                >
                   {followBus ? 'Following Bus' : 'Follow on Map'}
                </Button>
              </>
            )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
