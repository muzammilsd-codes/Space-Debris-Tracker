# Space Debris Tracker

A real-time orbital telemetry dashboard that tracks satellites, space stations, and debris in Low Earth Orbit (LEO). Built with Next.js, it visualises live SGP4-propagated positions on both a 2D map and an interactive 3D globe.

---

## Features

- **Real-time SGP4 propagation** — orbital positions recalculated every 4 seconds using [satellite.js](https://github.com/shashwatak/satellite-js)
- **Dual view** — toggle between a 2D Leaflet map and a textured 3D WebGL globe (Three.js)
- **Multi-source telemetry** — combines the ISS live API (wheretheiss.at) with CelesTrak's active satellite catalogue
- **Category filtering** — filter by Stations, Satellites, or Debris
- **Telemetry inspector** — per-object cards showing altitude, velocity, inclination, orbital period, and radio footprint
- **Collision classification** — debris objects are flagged with risk indicators
- **Auto-refresh** — live polling with manual override and pause control

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| 2D Map | React-Leaflet + OpenStreetMap |
| 3D Globe | Three.js (WebGL) |
| Orbital mechanics | satellite.js (SGP4/SDP4) |
| Data sources | CelesTrak OMM JSON, wheretheiss.at API |

---

## Project Structure

```
app/
  page.tsx                  # Main dashboard UI
  globals.css               # Global styles & Leaflet theme
  api/satellites/route.ts   # API route — fetches & propagates telemetry
components/
  Map.tsx                   # 2D Leaflet map component
  Globe3D.tsx               # 3D Three.js globe component
lib/
  satellite-propagator.ts   # SGP4 propagation logic (satellite.js wrapper)
types/
  satellite.ts              # Shared TypeScript types
data/
  celestrak-cache.json      # Auto-generated disk cache (gitignored)
```

---

## Built with IBM Bob

This project was built entirely using **[IBM Bob](https://www.ibm.com/products/bob)**, IBM's AI software engineering assistant.

Bob was used throughout the full development lifecycle:

- **Architecture & planning** — designing the multi-source telemetry pipeline, SGP4 propagation strategy, and component structure
- **Feature implementation** — writing all source files including the API route, satellite propagator, 2D map, and 3D globe from scratch
- **Iterative refinement** — adding the 3D globe view, Earth texture, orbit tracks, and selection ring through conversational iteration
- **Code cleanup** — identifying and removing dead code (unused imports, redundant exports, orphaned components), gitignore hygiene, and TypeScript correctness
- **Debugging** — resolving SSR constraints with dynamic imports, TypeScript strict-mode errors, and WebGL renderer lifecycle issues

