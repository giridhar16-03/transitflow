import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { PublicLiveMap } from "../components/PublicLiveMap.jsx";
import { Button, Input, Card } from "../components/ui.jsx";
import { BusFront, ShieldCheck, ArrowLeft, Loader2, Signal, Clock, Navigation } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function PrivateTrackingPage() {
  const navigate = useNavigate();
  const [instCode, setInstCode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedBusId, setSelectedBusId] = useState("");
  const [followBus, setFollowBus] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const tick = () => navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  const fetchBuses = async (code, access) => {
    const { data, error } = await supabase.rpc('get_private_buses', {
      p_inst_code: code,
      p_access_code: access
    });
    
    if (error) {
      if (error.message.includes("Invalid institution")) {
        return { success: false, error: "Invalid Institution Code or Access Code." };
      }
      return { success: false, error: "Failed to connect to the database." };
    }
    
    // If it returns an empty array, it could mean invalid credentials or no active buses.
    // However, if we didn't throw an error in the RPC, we'll assume it's just no buses.
    setBuses(data || []);
    return { success: true };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!instCode.trim() || !accessCode.trim()) {
      toast.error("Please enter both codes.");
      return;
    }
    setLoading(true);
    const result = await fetchBuses(instCode.trim(), accessCode.trim());
    setLoading(false);
    
    if (result.success) {
      setIsAuthenticated(true);
      toast.success("Successfully connected to private network.");
      
      intervalRef.current = setInterval(() => {
        fetchBuses(instCode.trim(), accessCode.trim());
      }, 5000);
    } else {
      toast.error(result.error || "Authentication failed. Please verify your codes.");
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setBuses([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setInstCode("");
    setAccessCode("");
  };

  const selectedVehicle = buses.find(b => b.id === selectedBusId) || null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background bg-grain px-4 py-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-md absolute top-4 left-4">
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </div>
        
        <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-card/60 backdrop-blur-xl border-border shadow-soft animate-rise-in">
          <div className="text-center space-y-2">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Private Tracking</h1>
            <p className="text-sm text-muted-foreground">
              Enter your institution credentials to view live private buses.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Institution Code</label>
              <Input
                placeholder="e.g. INST-1001"
                value={instCode}
                onChange={(e) => setInstCode(e.target.value)}
                autoComplete="off"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Access Code</label>
              <Input
                type="password"
                placeholder="e.g. STUDENT123"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full mt-4" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Access Live Map"
              )}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // Authenticated State (Live Map)
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      
      {/* ── Full Bleed Map Layer (z-0) ── */}
      <div className="absolute inset-0 z-0">
        <PublicLiveMap
          selectedVehicle={selectedVehicle}
          userLocation={userLocation}
          routeCoordinates={selectedVehicle ? selectedVehicle.route_stops : null}
          routeStops={[]}
          routeInfo={selectedVehicle ? { routeName: selectedVehicle.route_name } : null}
          followBus={followBus}
        />
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
        
        {/* Brand & Stats Panel */}
        <div className="shrink-0 pointer-events-auto flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/10 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-background animate-pulse" />
              </div>
              <div>
                <h1 className="font-display text-lg leading-tight text-foreground">Private Tracking</h1>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{instCode}</div>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs">
              Disconnect
            </Button>
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-3 text-center backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Active Buses</div>
              <div className="text-2xl font-display font-medium text-foreground leading-none">{buses.length}</div>
            </div>
          </div>
        </div>

        {/* Bottom Content Wrapper */}
        <div className="flex flex-col justify-end sm:justify-start pointer-events-none flex-1 min-h-0">
          
          {/* List Panel */}
          <div className="flex-1 min-h-0 max-h-[35vh] sm:max-h-none flex flex-col pointer-events-auto overflow-hidden rounded-3xl border border-white/10 bg-white/10 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            <div className="p-4 border-b border-white/10 shrink-0 bg-white/5 flex items-center gap-2">
               <Signal className="h-4 w-4 text-green-500" />
               <span className="text-sm font-semibold">Live Fleet</span>
            </div>
            
            <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1.5 pr-3">
              {buses.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <BusFront className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                  <div className="text-sm font-medium text-muted-foreground">No active buses right now.</div>
                </div>
              ) : (
                buses.map((bus) => {
                  const isSelected = selectedBusId === bus.id;
                  return (
                    <button
                      key={bus.id}
                      onClick={() => setSelectedBusId(isSelected ? "" : bus.id)}
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
                              ? "bg-amber-500 text-white"
                              : "bg-amber-100 text-amber-700",
                          ].join(" ")}>
                            {bus.bus_number}
                          </div>
                          <div>
                            <div className={`text-sm font-semibold leading-tight ${isSelected ? "text-foreground" : "text-foreground/90"}`}>
                              {bus.display_name}
                            </div>
                            <div className="text-[11px] font-medium text-amber-600/90 mt-0.5 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              {bus.route_name || "No Route Assigned"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Selected Item Info Panel */}
          {selectedVehicle && (
            <div className="shrink-0 pointer-events-auto p-4 animate-rise-in relative rounded-3xl border border-white/10 bg-white/10 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] mt-3 sm:mt-4">
              <button 
                onClick={() => setSelectedBusId("")}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary p-1 rounded-full transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            
              <div className="flex items-center gap-2 mb-2 pr-6">
                 <div className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-sm">
                  {selectedVehicle.bus_number}
                </div>
                <div className="text-sm font-bold truncate">{selectedVehicle.display_name}</div>
              </div>
              
              <div className="text-xs font-medium text-foreground/80 mb-3 truncate">
                {selectedVehicle.route_name}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-2 text-muted-foreground">
                   <Clock className="h-3 w-3" />
                   {selectedVehicle.last_seen ? new Date(selectedVehicle.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
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
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
