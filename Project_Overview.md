# TransitFlow: Intelligent Bus Tracking System Overview

## 1. Introduction
TransitFlow is a dual-tier, real-time transit tracking system designed to eliminate the uncertainty of bus wait times. It serves both the general public (for city-wide transit tracking) and private institutions (like schools and corporate fleets) on a single platform. 

The core value proposition is **real-time visibility**. Instead of relying on static timetables, TransitFlow uses modern WebSockets to stream precise GPS data from driver devices directly to commuter screens with minimal latency.

## 2. Technology Stack & Architecture
The project leverages a modern, robust JavaScript stack:
- **Frontend**: React 19 built with Vite. It uses Tailwind CSS and shadcn-style UI primitives for a highly responsive, modern interface.
- **Mapping Engine**: Leaflet.js paired with React-Leaflet and OpenStreetMap (OSM) tiles for rendering maps without requiring paid API keys like Google Maps.
- **Backend & Realtime**: Supabase (PostgreSQL-as-a-Service) is the backbone of the system.
  - **Database**: Stores users, fleets, routes, and live driver location data.
  - **Realtime (WebSockets)**: Propagates driver GPS coordinates instantly to connected clients.
  - **Auth**: Manages user roles and JWTs.

## 3. How It Works: The Core Data Flow
The defining feature of TransitFlow is the live tracking pipeline. Here is the sequence of how a bus's location reaches the commuter:
1. **Geolocation Gathering**: A driver opens the Driver Web App on their smartphone and clicks "Start Trip." The browser's native Geolocation API captures their latitude and longitude.
2. **Data Upsert**: The React app sends an upsert request (every 5 seconds) to the Supabase `drivers` table with the new coordinates and timestamp.
3. **Realtime Broadcast**: A PostgreSQL trigger detects the row change. Supabase Realtime picks up this change via Postgres Write-Ahead Logging (WAL) and pushes a `postgres_changes` payload over WebSockets.
4. **Map Update**: Commuters viewing the Live Map (Public or Private) receive the WebSocket event. The React app updates its state, and Leaflet dynamically animates the bus marker to the new coordinates.

## 4. Dual-Tier System
A major challenge in transit solutions is data mixing. TransitFlow solves this using a two-tier approach securely separated at the database level:

- **Public Tier**: Open for general commuters. Drivers broadcast their location globally. Commuters can view all active city buses on the map without needing to log in.
- **Private Tier (Institutional)**: Designed for schools and corporate fleets. This mode requires an `institution_code`. Admins manage dedicated drivers and routes. Crucially, **Row-Level Security (RLS)** in PostgreSQL guarantees that a private driver's location is *only* visible to authenticated users belonging to that specific institution. The public cannot see private school buses.

## 5. Main Application Modules
- **Authentication (`AuthPage.jsx`)**: Manages role-based routing (Admin, Driver, User) and handles onboarding.
- **Driver Hub (`DriverPage.jsx`)**: The broadcast center where drivers share their coordinates. Includes a fallback pulse mechanism to maintain tracking even if the browser drops connection.
- **Live Maps (`PublicPage.jsx` / `PrivatePage.jsx`)**: The commuter interfaces that subscribe to database changes for rendering bus locations.
- **Admin Dashboard (`InstitutionPage.jsx`)**: Allows private institutions to register drivers, generate secure keys, and manage their fleet.

---

## 6. Suggested Extensions & Future Improvements
While TransitFlow provides a strong foundation, the following enhancements could significantly elevate the platform:

**1. Offline-First Capabilities for Drivers**
Buses frequently pass through cellular dead zones. The Driver app could use Service Workers and IndexedDB to cache GPS coordinates when offline and batch-upload them once the connection is restored, ensuring no data loss.

**2. AI-Powered Predictive ETAs**
Currently, the system shows live locations. By integrating historical travel time data and live traffic APIs (like Mapbox Traffic), the system could run predictive models to calculate highly accurate Estimated Times of Arrival (ETA) for each specific stop.

**3. Automated Push Notifications**
Commuters could "subscribe" to a specific route or bus stop. When a bus enters a certain geofenced radius (e.g., 2 kilometers away), the system could send a push notification (via Web Push API) alerting the commuter to leave their house.

**4. Route Optimization for Institutions**
For private schools and companies, the Admin Dashboard could feature a route planning tool. By inputting student/employee home addresses, the system could suggest the most efficient, time-saving bus routes.

**5. Ticketing and Pass Integration**
TransitFlow could evolve into a full transit management system by integrating QR-code-based ticketing. Commuters could purchase daily/monthly passes in the app, and drivers could scan them upon entry.

**6. Fleet Telemetry & OBD-II Integration**
Beyond just smartphones, the system could accept data from physical OBD-II dongles installed in buses, providing admins with real-time data on vehicle health, fuel consumption, and driver behavior (e.g., harsh braking).
