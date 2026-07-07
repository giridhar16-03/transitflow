import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const clientOrigins = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()) : true;

const db = {
  users: [],
  institutions: [],
  drivers: [],
  vehicles: [
    { id: "veh-public-1", mode: "public", busNumber: "25P", busCode: "25P", vehicleNumber: "KA-01-TR-1022", routeName: "Central Station → Tech Park", status: "Active" },
    { id: "veh-public-2", mode: "public", busNumber: "25P", busCode: "25P", vehicleNumber: "KA-01-TR-1045", routeName: "Depot → North Loop", status: "Active" },
    { id: "veh-private-1", mode: "private", institutionCode: "INST-1001", busNumber: "ST-12", busCode: "ST12", vehicleNumber: "KA-01-TR-3022", routeName: "Campus Loop", status: "Active" },
  ],
  routes: [
    { id: "route-public-1", publicMode: true, routeName: "Orange Ring", startLocation: "Central Bus Terminal", endLocation: "Business District" },
    { id: "route-private-1", publicMode: false, institutionCode: "INST-1001", routeName: "Campus Loop", startLocation: "Main Gate", endLocation: "Library Block" },
  ],
  trips: [],
  liveLocations: [],
  counters: {
    driver: 1,
    privateDriver: 1,
    institution: 1001,
    user: 1,
    trip: 1,
  },
};

app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json());

function nextCode(prefix, count, width) {
  return `${prefix}${String(count).padStart(width, "0")}`;
}

function nextDriverKey() {
  const key = nextCode("DRV-", db.counters.driver, 6);
  db.counters.driver += 1;
  return key;
}

function nextPrivateDriverKey() {
  const key = nextCode("PDRV-", db.counters.privateDriver, 6);
  db.counters.privateDriver += 1;
  return key;
}

function nextInstitutionCode() {
  const code = nextCode("INST-", db.counters.institution, 4);
  db.counters.institution += 1;
  return code;
}

function signToken(payload) {
  if (!process.env.JWT_SECRET) {
    return null;
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function findInstitutionByCode(institutionCode) {
  return db.institutions.find((institution) => institution.institutionCode === institutionCode);
}

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "transitflow-api", timestamp: new Date().toISOString() });
});

app.get("/api/public/buses", (request, response) => {
  const busCode = String(request.query.busCode || "").trim().toLowerCase();
  const buses = db.vehicles.filter((vehicle) => vehicle.mode === "public" && (!busCode || vehicle.busCode.toLowerCase().includes(busCode)));
  response.json({ buses });
});

app.get("/api/public/routes", (_request, response) => {
  response.json({ routes: db.routes.filter((route) => route.publicMode) });
});

app.get("/api/public/live", (request, response) => {
  const busCode = String(request.query.busCode || "").trim().toLowerCase();
  const locations = db.liveLocations.filter((location) => !busCode || location.busCode.toLowerCase().includes(busCode));
  response.json({ locations });
});

app.get("/api/institutions/:institutionCode/buses", (request, response) => {
  const institution = findInstitutionByCode(request.params.institutionCode);
  if (!institution) {
    response.status(404).json({ error: "Institution not found" });
    return;
  }

  const buses = db.vehicles.filter((vehicle) => vehicle.institutionCode === institution.institutionCode);
  response.json({ institution: { institutionCode: institution.institutionCode, institutionName: institution.institutionName }, buses });
});

app.get("/api/institutions/:institutionCode/dashboard", (request, response) => {
  const institution = findInstitutionByCode(request.params.institutionCode);
  if (!institution) {
    response.status(404).json({ error: "Institution not found" });
    return;
  }

  response.json({
    institution: {
      institutionCode: institution.institutionCode,
      institutionName: institution.institutionName,
      institutionType: institution.institutionType,
      address: institution.address,
      contactPerson: institution.contactPerson,
      email: institution.email,
      phoneNumber: institution.phoneNumber,
    },
    drivers: db.drivers.filter((driver) => driver.institutionCode === institution.institutionCode),
    vehicles: db.vehicles.filter((vehicle) => vehicle.institutionCode === institution.institutionCode),
    routes: db.routes.filter((route) => route.institutionCode === institution.institutionCode),
    trips: db.trips.filter((trip) => trip.institutionCode === institution.institutionCode),
  });
});

app.post("/api/auth/register", async (request, response) => {
  const {
    role = "public",
    email,
    password,
    fullName,
    driverName,
    mobile,
    preferredBusNumber,
    preferredBusCode,
    age,
    busNumber,
    busCode,
    vehicleNumber,
    institutionName,
    institutionType,
    address,
    contactPerson,
    phoneNumber,
    institutionCode,
  } = request.body;

  if (!email || !password) {
    response.status(400).json({ error: "Email and password are required." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = `user-${db.counters.user++}`;
  const user = {
    id: userId,
    role,
    name: fullName || driverName || contactPerson || email.split("@")[0],
    email,
    mobile: mobile || phoneNumber || null,
    passwordHash,
    preferredBusNumber: preferredBusNumber || null,
    preferredBusCode: preferredBusCode || null,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);

  if (role === "driver") {
    const driver = {
      driverKeyId: nextDriverKey(),
      name: driverName || fullName || user.name,
      age: Number(age || 0),
      mobile: mobile || null,
      email,
      busNumber: busNumber || preferredBusNumber || "",
      busCode: busCode || preferredBusCode || "",
      vehicleNumber: vehicleNumber || null,
    };
    db.drivers.push(driver);
  }

  if (role === "private-admin") {
    const newInstitutionCode = nextInstitutionCode();
    const institution = {
      id: `institution-${newInstitutionCode}`,
      institutionCode: newInstitutionCode,
      institutionName: institutionName || "New Institution",
      institutionType: institutionType || "Organization",
      institutionPasswordHash: passwordHash,
      address: address || null,
      contactPerson: contactPerson || user.name,
      email,
      phoneNumber: phoneNumber || mobile || null,
      ownerUserId: userId,
    };
    db.institutions.push(institution);
  }

  if (role === "private-user" && institutionCode) {
    const institution = findInstitutionByCode(institutionCode);
    if (institution) {
      user.institutionCode = institution.institutionCode;
    }
  }

  const token = signToken({ sub: userId, role });
  response.json({ user: publicUser(user), token });
});

app.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body;
  const user = db.users.find((entry) => entry.email === email);
  if (!user) {
    response.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const matches = await bcrypt.compare(password || "", user.passwordHash);
  if (!matches) {
    response.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const token = signToken({ sub: user.id, role: user.role });
  response.json({ user: publicUser(user), token });
});

app.post("/api/institutions/:institutionCode/drivers", (request, response) => {
  const institution = findInstitutionByCode(request.params.institutionCode);
  if (!institution) {
    response.status(404).json({ error: "Institution not found" });
    return;
  }

  const driver = {
    driverKeyId: nextPrivateDriverKey(),
    institutionCode: institution.institutionCode,
    name: request.body.name || "Unknown",
    age: Number(request.body.age || 0),
    vehicleNumber: request.body.vehicleNumber || "Pending",
    busNumber: request.body.busNumber || "",
    busCode: request.body.busCode || "",
    mobile: request.body.mobile || null,
    email: request.body.email || null,
  };

  db.drivers.push(driver);
  response.status(201).json({ driver });
});

app.post("/api/institutions/:institutionCode/vehicles", (request, response) => {
  const institution = findInstitutionByCode(request.params.institutionCode);
  if (!institution) {
    response.status(404).json({ error: "Institution not found" });
    return;
  }

  const vehicle = {
    id: `veh-${db.vehicles.length + 1}`,
    mode: "private",
    institutionCode: institution.institutionCode,
    busNumber: request.body.busNumber || "",
    busCode: request.body.busCode || "",
    vehicleNumber: request.body.vehicleNumber || "",
    routeName: request.body.routeName || null,
    status: "Idle",
  };

  db.vehicles.push(vehicle);
  response.status(201).json({ vehicle });
});

app.post("/api/institutions/:institutionCode/routes", (request, response) => {
  const institution = findInstitutionByCode(request.params.institutionCode);
  if (!institution) {
    response.status(404).json({ error: "Institution not found" });
    return;
  }

  const route = {
    id: `route-${db.routes.length + 1}`,
    institutionCode: institution.institutionCode,
    publicMode: false,
    routeName: request.body.routeName || "New route",
    startLocation: request.body.startLocation || "Start",
    endLocation: request.body.endLocation || "End",
  };

  db.routes.push(route);
  response.status(201).json({ route });
});

app.post("/api/driver/start-trip", (request, response) => {
  const { driverKeyId, busNumber, busCode, latitude, longitude } = request.body;
  const trip = {
    id: `trip-${db.counters.trip++}`,
    driverKeyId,
    busNumber,
    busCode,
    status: "Active",
    startTime: new Date().toISOString(),
    endTime: null,
    lastLatitude: latitude || null,
    lastLongitude: longitude || null,
  };

  db.trips.push(trip);
  response.status(201).json({ trip });
});

app.post("/api/driver/location", (request, response) => {
  const { driverKeyId, tripId, latitude, longitude, speedKmh, heading } = request.body;
  const entry = {
    id: `loc-${db.liveLocations.length + 1}`,
    driverKeyId,
    tripId: tripId || null,
    busCode: request.body.busCode || "",
    latitude,
    longitude,
    speedKmh,
    heading,
    timestamp: new Date().toISOString(),
  };

  db.liveLocations.push(entry);

  const trip = db.trips.find((item) => item.id === tripId);
  if (trip) {
    trip.lastLatitude = latitude;
    trip.lastLongitude = longitude;
  }

  response.status(201).json({ location: entry });
});

app.post("/api/driver/end-trip", (request, response) => {
  const { tripId } = request.body;
  const trip = db.trips.find((item) => item.id === tripId);
  if (!trip) {
    response.status(404).json({ error: "Trip not found" });
    return;
  }

  trip.status = "Completed";
  trip.endTime = new Date().toISOString();
  response.json({ trip });
});

app.listen(port, () => {
  console.log(`TransitFlow API listening on http://localhost:${port}`);
});
