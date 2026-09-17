# TransitFlow System Diagrams

Below are the accurate Mermaid diagrams representing the process flow and system architecture for the TransitFlow project. You can render these directly in markdown viewers (like GitHub) or use [Mermaid Live Editor](https://mermaid.live/) to export them as images for your presentation.

## 1. Live Tracking Sequence Diagram
This diagram shows the exact flow of data from the driver's physical phone to the commuter's screen.

```mermaid
sequenceDiagram
    participant DriverGPS as Driver Phone (GPS)
    participant DriverApp as Driver App (React)
    participant DB as Supabase PostgreSQL (drivers table)
    participant Realtime as Supabase Realtime (WebSockets)
    participant CommuterApp as Commuter App (React)
    participant Leaflet as Leaflet Map (OSM)

    DriverGPS->>DriverApp: watchPosition() triggers (New Lat/Lng)
    DriverApp->>DB: UPSERT to drivers table (user_id, lat, lng, timestamp)
    DB->>Realtime: Postgres Trigger / WAL detects row change
    Realtime-->>CommuterApp: Pushes 'postgres_changes' payload via WebSocket
    CommuterApp->>Leaflet: Updates state (setDrivers => newLocation)
    Leaflet->>Leaflet: Animates Bus Marker to new coordinates
```

---

## 2. System Architecture Graph
This flowchart illustrates the relationships between the Frontend Applications, the Supabase Backend Services, and External Mapping APIs.

```mermaid
graph TD
    subgraph Frontend Applications
        CWA[Commuter Web App<br/>React + Leaflet]
        DWA[Driver Web App<br/>React + Geolocation API]
        AD[Admin Dashboard<br/>React + Supabase Auth]
    end

    subgraph Backend Services
        SP[Supabase Platform<br/>Realtime Engine]
        SA[Supabase Auth]
        DB[(PostgreSQL Database)]
    end

    subgraph External APIs
        OSM[OpenStreetMap<br/>Tile Servers]
        RouteData[OSM Routing API<br/>Polylines]
    end

    %% Frontend to Backend Connections
    CWA <-->|Subscribes to Realtime Channels| SP
    DWA -->|Pushes Live GPS 5s interval| SP
    AD -->|User Registration or Login| SA
    AD -->|Manages Fleet & Routes| DB

    %% Backend internal connections
    SA -->|Manages Roles & UUIDs| DB
    SP -->|Reads/Writes Data via PostgREST| DB

    %% External APIs connections
    OSM -->|Fetches Map Tile PNGs| CWA
    RouteData -->|Provides Static Route Geometries| DB
```
