export const heroStats = [
  { value: "24/7", label: "GPS refresh" },
  { value: "5s", label: "live update interval" },
  { value: "4", label: "role types" },
  { value: "100%", label: "private data isolation" },
];

export const landingFeatures = [
  {
    title: "Public transport tracking",
    body: "See active buses, live GPS positions, ETA, and route details in one calm dashboard.",
  },
  {
    title: "Private institution mode",
    body: "Restrict access to school, college, corporate, and organization fleets with isolated data.",
  },
  {
    title: "Driver trip control",
    body: "Start and end trips, capture GPS automatically, and keep a visible status timeline.",
  },
  {
    title: "Real-time updates",
    body: "Supabase Realtime keeps every dashboard in sync without a manual refresh cycle.",
  },
  {
    title: "OpenStreetMap ready",
    body: "Uses Leaflet and OpenStreetMap tiles for directions, zoom, and user location support.",
  },
  {
    title: "Secure access control",
    body: "Role-based sign in, Google OAuth, row-level security, and private institution access rules.",
  },
];

export const howItWorks = [
  "A user selects public or private mode and signs in with email/password or Google.",
  "Drivers start a trip and the browser geolocation API captures their location every 5 seconds.",
  "Supabase stores the trip, live location, and role data with row-level access rules.",
  "Public and institution dashboards subscribe to realtime changes and render map markers using Leaflet.",
];

export const benefits = [
  "Less waiting at the stop because ETA stays current.",
  "One platform for public transit and private fleets.",
  "Strong privacy separation between public and institution data.",
  "Simple admin workflows for vehicles, routes, drivers, and users.",
];

export const publicBuses = [];

export const routeCards = [
  {
    routeName: "Orange Ring",
    startLocation: "Central Bus Terminal",
    endLocation: "Business District",
    scenicScore: 82,
    travelTime: 26,
  },
  {
    routeName: "Campus Link",
    startLocation: "University Gate",
    endLocation: "Metro Hub",
    scenicScore: 74,
    travelTime: 18,
  },
  {
    routeName: "Night Express",
    startLocation: "South Depot",
    endLocation: "Residential Loop",
    scenicScore: 63,
    travelTime: 32,
  },
];

export const modes = [
  {
    key: "public",
    title: "Public mode",
    body: "City buses and shared transportation.",
  },
  {
    key: "private",
    title: "Private mode",
    body: "Schools, colleges, companies, and private fleets.",
  },
];

export const roles = [
  "Public User",
  "Driver",
  "Private Institution Admin",
  "Private Institution User",
];

export const contactMethods = [
  { title: "Email", value: "hello@transitflow.ai" },
  { title: "Support", value: "+91 98765 43210" },
  { title: "Deployment", value: "Vercel + Render + Supabase" },
];

export const driverHighlights = [
  { title: "Trip status", value: "Active" },
  { title: "Bus number", value: "25P" },
  { title: "Last location", value: "12.9718, 77.5946" },
  { title: "Driver key", value: "Hidden internally" },
];

export const institutionHighlights = [
  { title: "Institution code", value: "INST-1001" },
  { title: "Access", value: "Private and isolated" },
  { title: "Drivers", value: "PDRV-000001" },
  { title: "Users", value: "Students and staff" },
];
