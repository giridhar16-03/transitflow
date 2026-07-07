import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BusFront, Square, Play } from "lucide-react";
import { Badge, Button, Card } from "../components/ui.jsx";
import ProfileMenu from "../components/ProfileMenu";
import { clearActiveTrip } from "../lib/tracking";
import { clearStoredAuthAccess, getDashboardPath, getPreferredDisplayName, getUserRole } from "../lib/authAccess";
import { supabase } from "../lib/supabase";
import { useDriverLocation } from "../hooks/useDriverLocation";
import { findRouteByBusCode } from "../data/vizagRoutes";

const initialLocation = { latitude: 12.9718, longitude: 77.5946 };

export function DriverPage() {
  const navigate = useNavigate();
  const { userId: routeUserId = "" } = useParams();
  const [tripStatus, setTripStatus] = useState("Completed");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [tripHistory, setTripHistory] = useState([]);
  const [lastLocation, setLastLocation] = useState(initialLocation);
  const [positionLabel, setPositionLabel] = useState("GPS idle");
  const watchIdRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const tripIntervalRef = useRef(null);
  const tripRecordIdRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [driverRecord, setDriverRecord] = useState(null);
  const trackingScope = currentUser?.id || routeUserId || "";

  const driverDisplayName = driverRecord?.display_name || getPreferredDisplayName(currentUser);
  const driverBusCode = driverRecord?.bus_code || "25P";
  const driverBusNumber = driverRecord?.bus_number || driverBusCode;

  const tripRouteName = useMemo(() => {
    const route = findRouteByBusCode(driverBusCode);
    return route ? `${route.routeNumber} : ${route.routeName}` : "Unknown Route";
  }, [driverBusCode]);

  useDriverLocation({
    enabled: authReady && Boolean(currentUser) && tripStatus === "Active",
    busCode: driverBusCode,
    busNumber: driverBusNumber,
    driverKeyId: driverRecord?.driver_key_id,
    onError: (error) => console.error(error),
  });

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
          navigate("/auth?mode=login&role=public-driver", { replace: true });
          return;
        }

        // Check auth_accounts for role — source of truth
        const { data: accountRow } = await supabase
          .from("auth_accounts")
          .select("role")
          .eq("user_id", nextUser.id)
          .maybeSingle();

        if (accountRow?.role === "public-user") {
          // This user is a commuter — redirect to the public page
          navigate(getDashboardPath("public-user", nextUser.id), { replace: true });
          return;
        }

        const targetPath = getDashboardPath("public-driver", nextUser.id);
        if (window.location.pathname !== targetPath) {
          navigate(targetPath, { replace: true });
          return;
        }
      } catch (e) {
        if (mounted) {
          setAuthReady(true);
          navigate("/auth?mode=login&role=public-driver", { replace: true });
        }
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) {
      setDriverRecord(null);
      return undefined;
    }

    let mounted = true;
    let channel = null;

    (async () => {
      const [{ data: driverData, error: driverError }, { data: accountData, error: accountError }] = await Promise.all([
        supabase.from("drivers").select("id, user_id, driver_key_id, display_name, email, bus_code, bus_number, latitude, longitude, last_seen, created_at").eq("user_id", currentUser.id).maybeSingle(),
        supabase.from("auth_accounts").select("user_id, email, role, provider, display_name, bus_code").eq("user_id", currentUser.id).maybeSingle(),
      ]);

      if (driverError) {
        console.error(driverError);
      }
      if (accountError) {
        console.error(accountError);
      }
      if (!mounted) return;

      // If this user has no driver row, they need to complete their profile
      if (!driverData) {
        navigate("/auth?mode=register&role=public-driver", { replace: true });
        return;
      }

      setDriverRecord({
        ...driverData,
        ...(accountData || {}),
        display_name: driverData.display_name || accountData?.display_name || getPreferredDisplayName(currentUser),
        bus_code: driverData.bus_code || accountData?.bus_code || "",
        latitude: driverData.latitude ?? null,
        longitude: driverData.longitude ?? null,
        last_seen: driverData.last_seen || null,
      });

      channel = supabase
        .channel(`driver:${currentUser.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "drivers", filter: `user_id=eq.${currentUser.id}` },
          async (payload) => {
            const nextDriver = payload.new || payload.record || null;
            if (!nextDriver || !mounted) return;

            const { data: nextAccount } = await supabase
              .from("auth_accounts")
              .select("user_id, email, role, provider, display_name, bus_code")
              .eq("user_id", currentUser.id)
              .maybeSingle();

            if (!mounted) return;

            setDriverRecord({
              ...nextDriver,
              ...(nextAccount || {}),
              display_name: nextDriver.display_name || nextAccount?.display_name || getPreferredDisplayName(currentUser),
              bus_code: nextDriver.bus_code || nextAccount?.bus_code || "",
            });
          },
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setTripHistory([]);
      tripRecordIdRef.current = null;
      return undefined;
    }

    let mounted = true;
    let channel = null;

    const normalizeTrip = (trip) => ({
      id: trip.id,
      route: trip.route_name || tripRouteName,
      busNumber: trip.bus_number || driverBusNumber,
      busCode: trip.bus_code || driverBusCode,
      startedAt: trip.start_time ? new Date(trip.start_time).toLocaleTimeString() : new Date(trip.created_at).toLocaleTimeString(),
      endedAt: trip.end_time ? new Date(trip.end_time).toLocaleTimeString() : (trip.status === "active" ? "In progress" : "Waiting"),
      status: String(trip.status || "completed").replace(/^./, (character) => character.toUpperCase()),
    });

    const loadTripHistory = async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("id, user_id, bus_number, bus_code, route_name, status, start_time, end_time, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
      }

      if (mounted) {
        setTripHistory((data || []).map(normalizeTrip));
      }
    };

    loadTripHistory();

    channel = supabase
      .channel(`driver-trips:${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `user_id=eq.${currentUser.id}` },
        () => {
          loadTripHistory();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser, driverBusCode, driverBusNumber]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error(error);
      setCurrentUser(null);
      setDriverRecord(null);
      clearStoredAuthAccess("public-driver");
      navigate('/auth?mode=login&role=public-driver');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const resolvedRole = getUserRole(currentUser, "public-driver");
    if (resolvedRole !== "public-driver") {
      navigate(getDashboardPath(resolvedRole, currentUser.id), { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (tripStatus !== "Active") {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (fallbackTimerRef.current !== null) {
        window.clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      return undefined;
    }

    const fallbackStep = () => {
      setLastLocation((current) => ({
        latitude: Number((current.latitude + (Math.random() - 0.5) * 0.0015).toFixed(6)),
        longitude: Number((current.longitude + (Math.random() - 0.5) * 0.0015).toFixed(6)),
      }));
      setPositionLabel("Fallback GPS pulse");
    };

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setLastLocation({
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
          });
          setPositionLabel("Browser geolocation");
        },
        () => {
          fallbackStep();
          fallbackTimerRef.current = window.setInterval(fallbackStep, 5000);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        },
      );
    } else {
      fallbackTimerRef.current = window.setInterval(fallbackStep, 5000);
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (fallbackTimerRef.current !== null) {
        window.clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      if (tripIntervalRef.current) {
        window.clearInterval(tripIntervalRef.current);
        tripIntervalRef.current = null;
      }
    };
  }, [tripStatus]);

  const syncTripRecord = async (updates) => {
    if (!tripRecordIdRef.current) return;

    const { error } = await supabase
      .from("trips")
      .update(updates)
      .eq("id", tripRecordIdRef.current);

    if (error) {
      console.error(error);
    }
  };

  const syncDriverLocation = async (lat, lng) => {
    if (!currentUser || !supabase) return;
    try {
      const fallbackKey =
        driverRecord?.driver_key_id ||
        `DRV-${String(currentUser.id).replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      const payload = {
        user_id: currentUser.id,
        driver_key_id: fallbackKey,
        display_name: driverDisplayName,
        email: currentUser.email,
        bus_code: driverBusCode,
        bus_number: driverBusNumber,
        latitude: lat,
        longitude: lng,
        trip_status: 'active',
        last_seen: new Date().toISOString(),
      };
      await supabase.from("drivers").upsert(payload, { onConflict: "user_id" });
    } catch (e) {
      console.error("Error syncing driver location to Supabase:", e);
    }
  };

  const startTrip = async () => {
    if (!currentUser) {
      toast.error("You must be logged in to start a trip.");
      return;
    }

    // Generate a fallback driver key if the DB row doesn't have one yet
    const effectiveDriverKeyId =
      driverRecord?.driver_key_id ||
      `DRV-${String(currentUser.id).replace(/-/g, "").slice(0, 12).toUpperCase()}`;

    setTripStatus("Active");
    setStartTime(new Date());
    setEndTime(null);
    toast.success(`Trip started for ${driverDisplayName}. GPS tracking active — location syncs every 5 s.`);

    const { data, error } = await supabase.from("trips").insert({
      user_id: currentUser.id,
      driver_key_id: effectiveDriverKeyId,
      bus_number: driverBusNumber,
      bus_code: driverBusCode,
      route_name: tripRouteName,
      driver_name: driverDisplayName,
      status: "active",
      start_time: new Date().toISOString(),
      last_latitude: lastLocation.latitude,
      last_longitude: lastLocation.longitude,
    }).select("id").single();

    if (error) {
      toast.error(error.message || "Trip could not be saved.");
    } else {
      tripRecordIdRef.current = data?.id || null;
    }

    // Upsert initial driver location immediately
    await syncDriverLocation(lastLocation.latitude, lastLocation.longitude);

    // Every 5 seconds push the real GPS position (lastLocation is kept fresh by watchPosition)
    tripIntervalRef.current = window.setInterval(() => {
      setLastLocation((loc) => {
        syncTripRecord({ last_latitude: loc.latitude, last_longitude: loc.longitude, status: "active" });
        syncDriverLocation(loc.latitude, loc.longitude);
        return loc;
      });
    }, 5000);
  };

  const endTrip = async () => {
    const endedAt = new Date();
    setTripStatus("Completed");
    setEndTime(endedAt);
    toast.success("Trip completed and tracking stopped.");
    clearActiveTrip(trackingScope);

    // Stop the 5-second sync interval first
    if (tripIntervalRef.current) {
      window.clearInterval(tripIntervalRef.current);
      tripIntervalRef.current = null;
    }

    // Mark trip as completed in DB
    await syncTripRecord({
      status: "completed",
      end_time: endedAt.toISOString(),
      last_latitude: lastLocation.latitude,
      last_longitude: lastLocation.longitude,
    });

    // Mark driver as idle so they disappear from the public active list
    try {
      await supabase.from("drivers").update({ trip_status: 'idle' }).eq("user_id", currentUser.id);
    } catch (e) {
      console.error("Error setting driver idle:", e);
    }

    if (startTime) {
      setTripHistory((current) => [
        {
          id: `${trackingScope || "driver"}-${endedAt.getTime()}`,
          route: tripRouteName,
          busNumber: driverBusNumber,
          busCode: driverBusCode,
          startedAt: startTime.toLocaleTimeString(),
          endedAt: endedAt.toLocaleTimeString(),
          status: "Completed",
        },
        ...current,
      ].slice(0, 6));
    }
    tripRecordIdRef.current = null;
  };

  return (
    !authReady ? (
      <div className="grid min-h-screen place-items-center bg-background bg-grain text-sm text-muted-foreground">
        Loading TransitFlow...
      </div>
    ) : (
    <div className="min-h-screen bg-background bg-grain">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Button variant="ghost" to="/" className="px-0 hover:bg-transparent">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
              <BusFront className="h-4 w-4" />
            </div>
            <span className="font-display text-lg">TransitFlow Driver</span>
          </Button>
          {currentUser ? <ProfileMenu user={currentUser} onSignOut={handleSignOut} /> : null}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Welcome</div>
              <div className="mt-2 font-display text-3xl leading-tight md:text-4xl">
                Welcome, {driverDisplayName}
              </div>
            </Card>

            <Badge className="gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.22em]"><Play className="h-3 w-3" /> driver dashboard</Badge>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Trip status", value: tripStatus },
                { title: "Bus number", value: driverBusNumber },
                { title: "Bus code", value: driverBusCode },
                { title: "Driver", value: driverDisplayName },
              ].map((item) => (
                <Card key={item.title} className="p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{item.title}</div>
                  <div className="mt-2 text-sm font-medium">{item.value}</div>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={startTrip} disabled={tripStatus === "Active"}>
                <Play className="h-4 w-4" /> Start trip
              </Button>
              <Button size="lg" variant="outline" onClick={endTrip} disabled={tripStatus !== "Active"}>
                <Square className="h-4 w-4" /> End trip
              </Button>
            </div>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Trip history</div>
                  <div className="mt-2 font-display text-2xl">Recent trips</div>
                </div>
                <Badge>{tripHistory.length} saved</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {tripHistory.length > 0 ? (
                  tripHistory.map((trip) => (
                    <div key={trip.id} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{trip.route}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {trip.busNumber} · {trip.busCode}
                          </div>
                        </div>
                        <Badge variant="outline">{trip.status}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>Started: {trip.startedAt}</div>
                        <div>Ended: {trip.endedAt}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-5 text-sm text-muted-foreground">
                    No trip history yet. Start and end a trip to save it here.
                  </div>
                )}
              </div>
            </Card>

          </div>

          <Card className="overflow-hidden p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current trip status</div>
                <div className="mt-2 font-display text-4xl">{tripStatus}</div>
              </div>
              <Badge>{positionLabel}</Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Bus number" value={driverBusNumber} />
              <Metric label="Bus code" value={driverBusCode} />
              <Metric label="Start time" value={startTime ? startTime.toLocaleTimeString() : "Not started"} />
              <Metric label="End time" value={endTime ? endTime.toLocaleTimeString() : "Waiting"} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Metric label="Last location" value={`${lastLocation.latitude.toFixed(4)}, ${lastLocation.longitude.toFixed(4)}`} />
              <Metric label="Driver row" value={driverRecord?.id ? "Live from database" : "Pending"} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.8rem] border border-border bg-sage p-5 shadow-soft">
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">GPS status</div>
                <div className="mt-2 font-display text-3xl">{tripStatus === "Active" ? "Tracking" : "Idle"}</div>
                <div className="mt-2 text-sm text-muted-foreground">{positionLabel}</div>
                <div className="mt-4 rounded-2xl bg-card p-3 text-sm shadow-soft">
                  Last location: {lastLocation.latitude.toFixed(4)}, {lastLocation.longitude.toFixed(4)}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-border bg-sage p-5 shadow-soft">
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Trip snapshot</div>
                <div className="mt-2 font-display text-3xl">{tripStatus}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {tripStatus === "Active" ? `Trip is running with live GPS capture for ${driverDisplayName}.` : "Start the trip to begin live tracking."}
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="rounded-2xl bg-card px-4 py-3 shadow-soft">Start: {startTime ? startTime.toLocaleTimeString() : "Not started"}</div>
                  <div className="rounded-2xl bg-card px-4 py-3 shadow-soft">End: {endTime ? endTime.toLocaleTimeString() : "Waiting"}</div>
                </div>
              </div>
            </div>

          </Card>
        </div>
      </main>
    </div>
    )
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-right text-xs text-muted-foreground">{value}</span>
    </div>
  );
}
