import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BusFront, Building2, LogIn, Route, MapPin, Undo2, Users2, Search, X, Edit2, GripVertical } from "lucide-react";
import { Badge, Button, Card, Input, Label } from "../components/ui.jsx";
import { supabase, hasSupabase } from "../lib/supabase";
import ProfileMenu from "../components/ProfileMenu";
import { clearStoredAuthAccess } from "../lib/authAccess";
import { fetchFullDrivingRoute } from "../data/vizagRoutes";

// Leaflet
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapClickHandler({ onMapClick, isDrawing }) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, map.getZoom());
    }
  }, [map, center]);
  return null;
}

function MapSearchControl({ activeTab, onPlaceSelected }) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const containerRef = useCallback((node) => {
    if (node) {
      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);
    }
  }, []);

  if (activeTab !== "create") return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    try {
      // Bounding box for Visakhapatnam area to improve results
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=83.1,17.9,83.5,17.5`);
      const data = await res.json();
      if (!data || data.length === 0) {
        toast.error("No places found.");
      } else {
        setResults(data);
      }
    } catch {
      toast.error("Failed to search map. Please try again.");
    }
  };

  const handleSelect = (r) => {
    map.flyTo([r.lat, r.lon], 15);
    if (onPlaceSelected) {
      onPlaceSelected(r);
    }
    setResults([]);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="absolute top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-[400px] sm:translate-x-0 z-[1000] w-[90%] sm:w-64 pointer-events-auto">
      <form onSubmit={handleSearch} className="relative shadow-[0_8px_32px_rgba(0,0,0,0.15)] rounded-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search place to zoom..."
          className="pl-9 pr-4 h-10 bg-background/90 backdrop-blur-3xl border-border text-foreground rounded-full shadow-sm"
        />
        {results.length > 0 && (
          <button type="button" onClick={() => setResults([])} className="absolute right-3 top-1/2 -translate-y-1/2">
             <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </form>
      {results.length > 0 && (
        <div className="mt-2 rounded-2xl bg-background/95 backdrop-blur-3xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.2)] max-h-60 overflow-y-auto">
          {results.map(r => (
            <button key={r.place_id} type="button" onClick={() => handleSelect(r)} className="w-full text-left px-4 py-2.5 text-xs hover:bg-secondary border-b border-border last:border-0 truncate text-foreground transition-colors">
              {r.display_name.split(",").slice(0, 3).join(", ")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function generateAccessCode(prefix = "DRV") {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

export function InstitutionPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Tabs: "fleet" | "create"
  const [activeTab, setActiveTab] = useState("fleet");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasSupabase || !supabase) {
        setAuthReady(true);
        return;
      }
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) {
          setCurrentUser(data?.user || null);
          setAuthReady(true);
        }
      } catch {
        if (mounted) setAuthReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    clearStoredAuthAccess('private');
    setCurrentUser(null);
    navigate('/auth?mode=login&role=private');
  };

  const [institution, setInstitution] = useState(null);
  const [routes, setRoutes] = useState([]);
  
  // Drag and drop state
  const [draggedStopIndex, setDraggedStopIndex] = useState(null);
  
  // New Bus Profile Form State
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [busForm, setBusForm] = useState({ busCode: "", routeName: "" });
  const [stops, setStops] = useState([]);
  const [createRouteCoords, setCreateRouteCoords] = useState([]);

  useEffect(() => {
    if (!currentUser || !supabase) return;
    let mounted = true;

    async function loadInstitutionData() {
      try {
        const { data: instData, error: instError } = await supabase
          .from("institutions")
          .select("*")
          .eq("owner_user_id", currentUser.id)
          .maybeSingle();

        if (instError) throw instError;
        if (!instData && mounted) {
          toast.error("No institution found for your account.");
          return;
        }

        if (mounted) setInstitution(instData);

        const { data: routesRes } = await supabase
          .from("routes")
          .select("*")
          .eq("institution_id", instData.id)
          .eq("public_mode", false)
          .order('created_at', { ascending: false });

        if (mounted) {
          setRoutes(routesRes || []);
        }
      } catch (err) {
        console.error(err);
        if (mounted) toast.error("Failed to load institution data.");
      }
    }

    loadInstitutionData();
    return () => { mounted = false; };
  }, [currentUser]);

  const institutionCode = institution?.institution_code || "INST-....";

  const handleMapClick = async (latlng) => {
    if (activeTab === "create") {
      const tempId = Date.now();
      const currentLength = stops.length;
      
      // Add immediately for fast UI response
      setStops((prev) => [...prev, { id: tempId, lat: latlng.lat, lng: latlng.lng, name: `Loading Stop ${currentLength + 1}...` }]);
      
      try {
        // Reverse geocode to get the place name
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`);
        const data = await res.json();
        const placeName = data.display_name ? data.display_name.split(",")[0] : `Stop ${currentLength + 1}`;
        
        setStops((prev) => prev.map(s => s.id === tempId ? { ...s, name: placeName } : s));
      } catch {
        setStops((prev) => prev.map(s => s.id === tempId ? { ...s, name: `Stop ${currentLength + 1}` } : s));
      }
    }
  };

  const handlePlaceSelected = (r) => {
    if (activeTab === "create") {
      const tempId = Date.now();
      const placeName = r.display_name ? r.display_name.split(",")[0] : `Stop ${stops.length + 1}`;
      setStops((prev) => [...prev, { id: tempId, lat: Number(r.lat), lng: Number(r.lon), name: placeName }]);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (idx) => setDraggedStopIndex(idx);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (idx) => {
    if (draggedStopIndex === null || draggedStopIndex === idx) return;
    setStops(prev => {
      const next = [...prev];
      const [item] = next.splice(draggedStopIndex, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDraggedStopIndex(null);
  };

  // Fetch full OSRM driving route when stops change
  useEffect(() => {
    let mounted = true;
    if (activeTab === "create" && stops.length > 1) {
      fetchFullDrivingRoute(stops).then(coords => {
        if (mounted && coords && coords.length > 0) {
          setCreateRouteCoords(coords);
        }
      });
    } else {
      setCreateRouteCoords([]);
    }
    return () => { mounted = false; };
  }, [stops, activeTab]);

  const undoLastStop = () => {
    setStops((prev) => prev.slice(0, -1));
  };
  
  const removeStop = (idToRemove) => {
    setStops((prev) => prev.filter(s => s.id !== idToRemove));
  };

  const startEditRoute = (route) => {
    setEditingRouteId(route.id);
    setBusForm({ busCode: route.bus_number || "", routeName: route.route_name || "" });
    setStops(route.stops || []);
    setActiveTab("create");
  };

  const resetForm = () => {
    setEditingRouteId(null);
    setBusForm({ busCode: "", routeName: "" });
    setStops([]);
    setCreateRouteCoords([]);
  };

  const addBusProfile = async (event) => {
    event.preventDefault();
    if (!institution) return;
    if (!busForm.busCode || !busForm.routeName || stops.length === 0) {
      toast.error("Bus Code, Route Name, and at least one stop on the map are required.");
      return;
    }

    try {
      if (editingRouteId) {
        // UPDATE EXISTING ROUTE
        const { data: routeData, error: routeError } = await supabase.from("routes").update({
          route_name: busForm.routeName,
          bus_number: busForm.busCode,
          stops: stops
        }).eq("id", editingRouteId).select().single();

        if (routeError) throw routeError;

        setRoutes((current) => current.map(r => r.id === editingRouteId ? routeData : r));
        toast.success("Route updated successfully!");
      } else {
        // INSERT NEW ROUTE
        const accessCode = generateAccessCode(busForm.busCode.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4) || "BUS");
        const { data: routeData, error: routeError } = await supabase.from("routes").insert({
          institution_id: institution.id,
          public_mode: false,
          route_name: busForm.routeName,
          bus_number: busForm.busCode,
          driver_access_code: accessCode,
          stops: stops
        }).select().single();

        if (routeError) throw routeError;

        // Also create a vehicle entry quietly
        await supabase.from("vehicles").insert({
          institution_id: institution.id,
          mode: "private",
          vehicle_number: busForm.busCode,
          bus_number: busForm.busCode,
          bus_code: "P",
          active: true
        });

        setRoutes((current) => [routeData, ...current]);
        toast.success(
          <div className="flex flex-col gap-1">
            <div className="font-semibold">Route Created!</div>
            <div>Give the driver this Access Code:</div>
            <Badge className="w-max font-mono text-sm mt-1">{accessCode}</Badge>
          </div>, 
          { duration: 10000 }
        );
      }
      
      resetForm();
      setActiveTab("fleet");
      
    } catch (err) {
      toast.error(err.message || "Failed to save route profile.");
    }
  };

  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background bg-grain text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-primary/10 animate-pulse-ring" />
            <div className="absolute inset-0 grid place-items-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          </div>
          <span>Loading Admin Console…</span>
        </div>
      </div>
    );
  }

  if (!currentUser && hasSupabase) {
    return (
      <div className="min-h-screen bg-background bg-grain flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-6 text-center animate-rise-in">
          <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-secondary mb-4">
            <Building2 className="h-7 w-7 text-foreground" />
          </div>
          <h2 className="font-display text-2xl text-foreground">Institution Access</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            Private institution management requires authentication. Sign in or register to manage your fleet, drivers, and routes.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button to="/auth?mode=login&role=private" className="w-full sm:w-auto">
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
            <Button variant="outline" to="/auth?mode=register&role=private" className="w-full sm:w-auto">
              Register
            </Button>
          </div>
          <div className="mt-4">
            <Button variant="ghost" size="sm" to="/">
              Back to home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const defaultCenter = [17.6868, 83.2185];
  const mapCenter = (institution?.latitude && institution?.longitude) 
    ? [institution.latitude, institution.longitude] 
    : defaultCenter;
  
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-background bg-grain">
      
      {/* ── Full Bleed Map Layer (z-0) ── */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={defaultCenter} zoom={13} className="h-full w-full" zoomControl={false}>
          <MapRecenter center={mapCenter} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} isDrawing={activeTab === "create"} />
          <MapSearchControl activeTab={activeTab} onPlaceSelected={handlePlaceSelected} />
          
          {/* Render drawing stops */}
          {activeTab === "create" && stops.map((stop, idx) => (
            <Marker key={stop.id || idx} position={[stop.lat, stop.lng]}>
              <Popup>{stop.name}</Popup>
            </Marker>
          ))}
          {activeTab === "create" && createRouteCoords.length > 1 ? (
            <Polyline positions={createRouteCoords} color="#3b82f6" weight={4} opacity={0.8} />
          ) : activeTab === "create" && stops.length > 1 ? (
            <Polyline positions={stops.map(s => [s.lat, s.lng])} color="#3b82f6" weight={4} opacity={0.8} dashArray="5, 10" />
          ) : null}

          {/* Render fleet routes if viewing fleet */}
          {activeTab === "fleet" && routes.map((route, i) => {
            if (!route.stops || route.stops.length === 0) return null;
            return (
              <div key={i}>
                <Polyline positions={route.stops.map(s => [s.lat, s.lng])} color="#8b5cf6" weight={4} opacity={0.6} />
                {route.stops.map((stop, idx) => (
                  <Marker key={`${i}-${idx}`} position={[stop.lat, stop.lng]} opacity={0.7}>
                     <Popup>{route.bus_number}: {stop.name || `Stop ${idx + 1}`}</Popup>
                  </Marker>
                ))}
              </div>
            );
          })}
        </MapContainer>
      </div>

      {/* ── Mobile Split / Desktop Sidebar (z-10) ── */}
      <div className="absolute inset-x-4 top-4 bottom-4 sm:left-4 sm:right-auto sm:w-[380px] z-10 flex flex-col justify-between sm:justify-start gap-4 pointer-events-none">
        
        {/* Brand & Tabs Panel - Restored lighter frosted glass look */}
        <div className="shrink-0 pointer-events-auto flex flex-col gap-3 rounded-3xl border border-border bg-white/40 dark:bg-black/40 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] p-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-background/80 text-foreground shadow-sm backdrop-blur-md">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-lg leading-tight text-foreground">{institution?.institution_name || "Institution"}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Code: <span className="text-foreground">{institutionCode}</span></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-l border-border pl-2">Access: <span className="text-primary">{institution?.access_code || "..."}</span></div>
                </div>
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
              { id: "fleet", icon: Users2,  label: "Active Fleet" },
              { id: "create", icon: Route,  label: editingRouteId ? "Edit Route" : "Create Route" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => {
                  if (id === "create" && activeTab !== "create" && editingRouteId) {
                    resetForm();
                  }
                  setActiveTab(id);
                }}
                className={[
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all duration-200",
                  activeTab === id
                    ? "bg-background backdrop-blur-md text-foreground shadow-sm border border-border font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                ].join(" ")}
              >
                <Icon className={`h-3.5 w-3.5 transition-colors ${activeTab === id ? "text-primary" : ""}`} />
                {label}
                {id === "fleet" && routes.length > 0 && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-foreground border border-border">
                    {routes.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Content Panel */}
        <div className="flex-1 min-h-0 flex flex-col pointer-events-auto overflow-hidden rounded-3xl border border-border bg-white/40 dark:bg-black/40 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
          
          {activeTab === "fleet" ? (
            <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1.5 pr-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
              {routes.length === 0 ? (
                <div className="px-4 py-8 text-center mt-10">
                  <BusFront className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                  <div className="text-sm font-medium text-foreground">No fleet routes yet.</div>
                  <div className="text-xs text-muted-foreground mt-1">Head over to the Create Route tab to configure your first bus!</div>
                </div>
              ) : (
                routes.map((route) => (
                  <div key={route.id} className="w-full rounded-xl transition-all duration-200 group p-3 bg-background/60 border border-border shadow-sm hover:bg-background/80 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 border border-primary/20 text-primary font-bold shadow-sm">
                          {route.bus_number || "Bus"}
                        </div>
                        <div>
                          <div className="text-sm font-semibold leading-tight text-foreground">
                            {route.route_name}
                          </div>
                          <div className="text-[11px] font-medium text-muted-foreground mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {route.stops?.length || 0} stops configured
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => startEditRoute(route)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit Route"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                    {route.driver_access_code && (
                      <div className="rounded-lg bg-secondary/80 p-2.5 flex items-center justify-between border border-border">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Driver Code</div>
                        <code className="font-mono text-sm font-bold text-primary select-all">
                          {route.driver_access_code}
                        </code>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
               <div className="p-4 border-b border-border bg-background/50 shrink-0 flex justify-between items-start">
                 <div>
                   <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                     <MapPin className="h-4 w-4 text-primary" /> 
                     {editingRouteId ? "Edit Route Profile" : "Plot Route on Map"}
                   </div>
                   <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                     {editingRouteId 
                       ? "Modify the route details or adjust stops on the map below."
                       : "Search the map to zoom to a place, then click on the background to drop stops sequentially."}
                   </div>
                 </div>
                 {editingRouteId && (
                   <button onClick={() => { resetForm(); setActiveTab("fleet"); }} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                 )}
               </div>

               <form onSubmit={addBusProfile} className="p-4 flex flex-col gap-4 shrink-0 bg-background/40">
                  <div className="space-y-4">
                    <Field label="Bus Code (e.g. A, B, C)" value={busForm.busCode} onChange={(value) => setBusForm((current) => ({ ...current, busCode: value.toUpperCase() }))} />
                    <Field label="Route Name (e.g. Campus Route)" value={busForm.routeName} onChange={(value) => setBusForm((current) => ({ ...current, routeName: value }))} />
                  </div>
                  
                  {institution?.latitude && institution?.longitude && (
                    <Button 
                      type="button" 
                      variant="outline"
                      className="w-full shadow-sm text-xs border-dashed"
                      onClick={() => {
                        setStops(prev => [...prev, { id: Date.now(), lat: institution.latitude, lng: institution.longitude, name: institution.name || "Campus" }]);
                      }}
                    >
                      <Building2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
                      Add Institute as Stop
                    </Button>
                  )}

                  <Button type="submit" className="w-full mt-2 shadow-sm font-semibold" disabled={stops.length === 0}>
                    {editingRouteId ? "Save Changes" : "Save Route & Generate Code"}
                  </Button>
               </form>

               {stops.length > 0 && (
                 <div className="px-4 pb-4">
                   <div className="flex items-center justify-between mb-2 mt-2">
                     <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Placed Stops ({stops.length})</span>
                     <button type="button" onClick={undoLastStop} className="text-xs text-red-500 hover:text-red-600 font-medium">
                       Undo Last
                     </button>
                   </div>
                   <div className="space-y-2 border border-border bg-background/30 rounded-xl p-2">
                     {stops.map((stop, idx) => (
                       <div 
                         key={stop.id || idx} 
                         draggable
                         onDragStart={() => handleDragStart(idx)}
                         onDragOver={handleDragOver}
                         onDrop={() => handleDrop(idx)}
                         className={`flex items-center justify-between gap-2 p-2 rounded-lg bg-background hover:bg-secondary transition-colors group border ${draggedStopIndex === idx ? 'opacity-50 border-primary border-dashed' : 'border-transparent hover:border-border'} cursor-grab active:cursor-grabbing`}
                       >
                         <div className="flex items-center gap-2 min-w-0">
                           <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
                           <div className="h-5 w-5 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                             {idx + 1}
                           </div>
                           <div className="text-xs text-foreground truncate font-medium">{stop.name}</div>
                         </div>
                         <button 
                           type="button"
                           onClick={() => removeStop(stop.id)} 
                           className="text-muted-foreground hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                         >
                           <X className="h-3 w-3" />
                         </button>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-muted-foreground text-xs mb-1.5 font-medium">{label}</Label>
      <Input 
        value={value} 
        onChange={(event) => onChange(event.target.value)} 
        className="h-10 text-sm bg-background border-border focus:bg-background text-foreground transition-all shadow-sm"
      />
    </div>
  );
}
