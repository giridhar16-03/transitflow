import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, BusFront, Building2, KeyRound, Plus, Route, Users2 } from "lucide-react";
import { Badge, Button, Card, Input, Label, SectionTitle } from "../components/ui.jsx";
import { institutionHighlights } from "../data/mock";

function nextCode(prefix, count, digits) {
  return `${prefix}${String(count).padStart(digits, "0")}`;
}

export function InstitutionPage() {
  const [drivers, setDrivers] = useState([
    { driverKeyId: "PDRV-000001", name: "Anjali", busNumber: "ST-12", busCode: "ST12", vehicleNumber: "KA-01-TR-1022" },
  ]);
  const [vehicles, setVehicles] = useState([
    { id: "veh-1", vehicleNumber: "KA-01-TR-1022", busNumber: "ST-12", busCode: "ST12", status: "Active" },
    { id: "veh-2", vehicleNumber: "KA-01-TR-1045", busNumber: "ST-15", busCode: "ST15", status: "Idle" },
  ]);
  const [routes, setRoutes] = useState([
    { id: "route-1", routeName: "Campus Loop", startLocation: "Main Gate", endLocation: "Library Block" },
  ]);

  const [driverForm, setDriverForm] = useState({ name: "", age: "", vehicleNumber: "", busNumber: "", busCode: "", mobile: "" });
  const [vehicleForm, setVehicleForm] = useState({ vehicleNumber: "", busNumber: "", busCode: "" });
  const [routeForm, setRouteForm] = useState({ routeName: "", startLocation: "", endLocation: "" });

  const institutionCode = "INST-1001";
  const institutionPassword = "••••••••";

  const adminSummary = useMemo(() => [
    { title: "Private data", value: "Isolated per institution" },
    { title: "Drivers", value: `${drivers.length} active` },
    { title: "Vehicles", value: `${vehicles.length} registered` },
    { title: "Routes", value: `${routes.length} configured` },
  ], [drivers.length, vehicles.length, routes.length]);

  const addDriver = (event) => {
    event.preventDefault();
    if (!driverForm.name || !driverForm.busNumber || !driverForm.busCode) {
      toast.error("Add the driver name, bus number, and bus code first.");
      return;
    }

    const driverKeyId = nextCode("PDRV-", drivers.length + 1, 6);
    setDrivers((current) => [
      ...current,
      {
        driverKeyId,
        name: driverForm.name,
        busNumber: driverForm.busNumber,
        busCode: driverForm.busCode,
        vehicleNumber: driverForm.vehicleNumber || "Pending",
      },
    ]);
    setDriverForm({ name: "", age: "", vehicleNumber: "", busNumber: "", busCode: "", mobile: "" });
    toast.success(`${driverKeyId} created for ${driverForm.name}.`);
  };

  const addVehicle = (event) => {
    event.preventDefault();
    if (!vehicleForm.vehicleNumber || !vehicleForm.busNumber || !vehicleForm.busCode) {
      toast.error("Add the vehicle number, bus number, and bus code first.");
      return;
    }

    setVehicles((current) => [
      ...current,
      {
        id: `veh-${current.length + 1}`,
        vehicleNumber: vehicleForm.vehicleNumber,
        busNumber: vehicleForm.busNumber,
        busCode: vehicleForm.busCode,
        status: "Idle",
      },
    ]);
    setVehicleForm({ vehicleNumber: "", busNumber: "", busCode: "" });
    toast.success("Vehicle added to the private fleet.");
  };

  const addRoute = (event) => {
    event.preventDefault();
    if (!routeForm.routeName || !routeForm.startLocation || !routeForm.endLocation) {
      toast.error("Route name, start location, and end location are required.");
      return;
    }

    setRoutes((current) => [
      ...current,
      {
        id: `route-${current.length + 1}`,
        routeName: routeForm.routeName,
        startLocation: routeForm.startLocation,
        endLocation: routeForm.endLocation,
      },
    ]);
    setRouteForm({ routeName: "", startLocation: "", endLocation: "" });
    toast.success("Route saved for the institution.");
  };

  return (
    <div className="min-h-screen bg-background bg-grain">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Button variant="ghost" to="/" className="px-0 hover:bg-transparent">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-display text-lg">TransitFlow Institution</span>
          </Button>
          <Badge className="gap-2"><KeyRound className="h-3.5 w-3.5" /> {institutionCode}</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Badge className="gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.22em]"><Users2 className="h-3 w-3" /> private mode</Badge>
            <SectionTitle
              title="Institution admins manage their own isolated fleet, routes, drivers, and users."
              body="Public users never see private institution data. Every institution is fenced with its own code, password, and row-level access policy."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {institutionHighlights.map((item) => (
                <Card key={item.title} className="p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{item.title}</div>
                  <div className="mt-2 text-sm font-medium">{item.value}</div>
                </Card>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {adminSummary.map((item) => (
                <Card key={item.title} className="p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{item.title}</div>
                  <div className="mt-2 font-display text-2xl">{item.value}</div>
                </Card>
              ))}
            </div>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-2xl">Institution access</div>
                  <div className="text-sm text-muted-foreground">Generated after registration.</div>
                </div>
                <Badge>Secure</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoChip label="Institution code" value={institutionCode} />
                <InfoChip label="Access password" value={institutionPassword} />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary"><Plus className="h-5 w-5" /></div>
                <div>
                  <div className="font-display text-2xl">Add drivers, vehicles, and routes</div>
                  <div className="text-sm text-muted-foreground">Everything stays scoped to this institution.</div>
                </div>
              </div>

              <div className="mt-6 grid gap-6">
                <form onSubmit={addDriver} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
                  <div className="mb-4 font-medium">Add driver</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Driver name" value={driverForm.name} onChange={(value) => setDriverForm((current) => ({ ...current, name: value }))} />
                    <Field label="Age" value={driverForm.age} onChange={(value) => setDriverForm((current) => ({ ...current, age: value }))} />
                    <Field label="Vehicle number" value={driverForm.vehicleNumber} onChange={(value) => setDriverForm((current) => ({ ...current, vehicleNumber: value }))} />
                    <Field label="Bus number" value={driverForm.busNumber} onChange={(value) => setDriverForm((current) => ({ ...current, busNumber: value }))} />
                    <Field label="Bus code" value={driverForm.busCode} onChange={(value) => setDriverForm((current) => ({ ...current, busCode: value }))} />
                    <Field label="Mobile number" value={driverForm.mobile} onChange={(value) => setDriverForm((current) => ({ ...current, mobile: value }))} />
                  </div>
                  <div className="mt-4">
                    <Button type="submit">Create private driver key <ArrowRight className="h-4 w-4" /></Button>
                  </div>
                </form>

                <form onSubmit={addVehicle} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
                  <div className="mb-4 font-medium">Add vehicle</div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Vehicle number" value={vehicleForm.vehicleNumber} onChange={(value) => setVehicleForm((current) => ({ ...current, vehicleNumber: value }))} />
                    <Field label="Bus number" value={vehicleForm.busNumber} onChange={(value) => setVehicleForm((current) => ({ ...current, busNumber: value }))} />
                    <Field label="Bus code" value={vehicleForm.busCode} onChange={(value) => setVehicleForm((current) => ({ ...current, busCode: value }))} />
                  </div>
                  <div className="mt-4">
                    <Button type="submit">Save vehicle</Button>
                  </div>
                </form>

                <form onSubmit={addRoute} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
                  <div className="mb-4 font-medium">Add route</div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Route name" value={routeForm.routeName} onChange={(value) => setRouteForm((current) => ({ ...current, routeName: value }))} />
                    <Field label="Start location" value={routeForm.startLocation} onChange={(value) => setRouteForm((current) => ({ ...current, startLocation: value }))} />
                    <Field label="End location" value={routeForm.endLocation} onChange={(value) => setRouteForm((current) => ({ ...current, endLocation: value }))} />
                  </div>
                  <div className="mt-4">
                    <Button type="submit">Publish route</Button>
                  </div>
                </form>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <BusFront className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-display text-2xl">Fleet</div>
                    <div className="text-sm text-muted-foreground">Only institution vehicles.</div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{vehicle.vehicleNumber}</div>
                        <Badge>{vehicle.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{vehicle.busNumber} · {vehicle.busCode}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Route className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-display text-2xl">Routes</div>
                    <div className="text-sm text-muted-foreground">Configured by admin.</div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {routes.map((route) => (
                    <div key={route.id} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
                      <div className="font-medium">{route.routeName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{route.startLocation} → {route.endLocation}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div className="rounded-2xl bg-secondary p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}
