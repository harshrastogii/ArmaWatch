# WagePeace — Weapons Map (Modernised)

An upgraded, interactive version of the Weapons Map at https://wagepeaceau.org/weaponsmap/ — rebuilt as a fast, modern, mobile-friendly map application while preserving all of the original data and functionality.

## What's new
- Modern interactive map (MapLibre GL): clustering, smooth fly-to, colour-coded companies.
- Search + filter by facility type and program, with a live counter.
- Company panel: facility, address, details, source, "View on Google Maps" (Street View), "Share this company", "Spread the word", and a "Take action" link to Wage Peace.
- Live analytics readout (sites by program) and header totals (sites / primes / states).
- "My location" — shows how many weapons sites are within 25 km of the viewer.
- "Download data" — exports the currently filtered companies as CSV for researchers/journalists.
- Fully responsive and accessible. No Google Maps API key needed for the map.

## What's in this folder
- app/dist/ — the finished, ready-to-host application (this is what gets published).
- app/ (source) — the full editable React + TypeScript code for future maintenance.
- app/dist/data/weapons.geojson — all 127 company locations (the data).

## The data
All locations live in app/dist/data/weapons.geojson (standard GeoJSON, 127 sites). To add/edit/remove a company, edit that file — no code changes needed. Fields: Name, Program, Facility, Street Address, Suburb, Postcode, Lat, Long, Details, Source.

## Preview it locally (needs Node.js from nodejs.org)
    cd app
    npm install
    npm run preview
Then open the address it prints (e.g. http://localhost:4173).

## Getting it onto the WagePeace site
The existing page already has a <div id="thisisthemap"> where the old map loaded. This new app mounts into that same container, so the URL (/weaponsmap/) and everything around it stays identical. Publishing = uploading the contents of app/dist/ and loading the built JS + CSS on that page. It's a short, low-risk change that affects no other page.

## Technology
React · TypeScript · MapLibre GL JS · Tailwind CSS · Framer Motion · Vite.
Basemap © CARTO, © OpenStreetMap contributors.

Prepared as a handover deliverable for Wage Peace.
