import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import { AnimatePresence, motion } from "framer-motion";
import type { Filters, SiteCollection, SiteFeature, SiteProps } from "../types";
import { loadSites, uniqueSorted, PRIME } from "../lib/data";
import AppHeader from "./AppHeader";
import Ticker from "./Ticker";
import AppFooter from "./AppFooter";
import type { Point } from "geojson";

const DATA_URL = "/data/weapons.geojson";
const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const SATELLITE = "https://api.maptiler.com/maps/hybrid/style.json?key=ArdcGJqknm37TVEzO4yP";
const CENTER: [number, number] = [132, -28];
const ZOOM = 3.4;
const ACCENT = "#d61f9a";
const OTHER = "#3b3b6d";

export default function WeaponsMap() {
  const mapRef = useRef<MLMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const [data, setData] = useState<SiteCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<SiteProps | null>(null);
  const [nearby, setNearby] = useState<number | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => {
    const q = new URLSearchParams(window.location.search).get("company") || "";
    return { facility: "", program: "", query: q };
  });

  useEffect(() => {
    loadSites(DATA_URL).then(setData).catch((e) => console.error(e));
  }, []);

  const facilities = useMemo(
    () => (data ? uniqueSorted(data.features.map((f) => f.properties.Facility)) : []),
    [data]
  );
  const programs = useMemo(
    () => (data ? uniqueSorted(data.features.map((f) => f.properties.Program)) : []),
    [data]
  );

  const filtered = useMemo<SiteFeature[]>(() => {
    if (!data) return [];
    const q = filters.query.trim().toLowerCase();
    return data.features.filter((f) => {
      const p = f.properties;
      if (filters.facility && p.Facility !== filters.facility) return false;
      if (filters.program && p.Program !== filters.program) return false;
      if (q && !p.Name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filters]);

  const primes = useMemo(
    () =>
      data
        ? [...new Set(data.features.filter((f) => f.properties.Program === PRIME).map((f) => f.properties.Name))].sort()
        : [],
    [data]
  );
  const others = useMemo(
    () =>
      data
        ? [...new Set(data.features.filter((f) => f.properties.Program !== PRIME).map((f) => f.properties.Name))].sort()
        : [],
    [data]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP,
      center: CENTER,
      zoom: ZOOM,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      map.addSource("sites", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 11,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "sites",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ACCENT,
          "circle-opacity": 0.9,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 30],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.6)",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "sites",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "sites",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["match", ["get", "Program"], PRIME, ACCENT, OTHER],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = feats[0].properties?.cluster_id;
        const src = map.getSource("sites") as GeoJSONSource;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({ center: (feats[0].geometry as Point).coordinates as [number, number], zoom });
        });
      });
      map.on("click", "unclustered", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelected(f.properties as SiteProps);
        map.flyTo({
          center: (f.geometry as Point).coordinates as [number, number],
          zoom: Math.min(Math.max(map.getZoom(), 7), 8),
          speed: 0.6,
        });
      });
      const pointer = (v: boolean) => () => (map.getCanvas().style.cursor = v ? "pointer" : "");
      ["clusters", "unclustered"].forEach((l) => {
        map.on("mouseenter", l, pointer(true));
        map.on("mouseleave", l, pointer(false));
      });

      mapRef.current = map;
      setReady(true);
      requestAnimationFrame(() => map.resize());
      setTimeout(() => map.resize(), 300);
      const collapseAttrib = () => {
        containerRef.current
          ?.querySelectorAll(".maplibregl-ctrl-attrib.maplibregl-compact-show")
          .forEach((el) => el.classList.remove("maplibregl-compact-show"));
      };
      collapseAttrib();
      setTimeout(collapseAttrib, 400);
    });
    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const src = mapRef.current.getSource("sites") as GeoJSONSource | undefined;
    if (src) src.setData({ type: "FeatureCollection", features: filtered });
  }, [filtered, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(satellite ? SATELLITE : BASEMAP);
    const reAdd = () => {
      if (map.getSource("sites")) return;
      map.addSource("sites", { type: "geojson", data: { type: "FeatureCollection", features: filtered }, cluster: true, clusterRadius: 45, clusterMaxZoom: 11 });
      map.addLayer({ id: "clusters", type: "circle", source: "sites", filter: ["has", "point_count"], paint: { "circle-color": ACCENT, "circle-opacity": 0.9, "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 30], "circle-stroke-width": 2, "circle-stroke-color": "rgba(255,255,255,0.6)" } });
      map.addLayer({ id: "cluster-count", type: "symbol", source: "sites", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#ffffff" } });
      map.addLayer({ id: "unclustered", type: "circle", source: "sites", filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["match", ["get", "Program"], PRIME, ACCENT, OTHER], "circle-radius": 7, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
    };
    map.on("styledata", reAdd);
    return () => { map.off("styledata", reAdd); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellite, ready]);

  const flyToName = useCallback(
    (name: string) => {
      const matches = data?.features.filter((x) => x.properties.Name === name) ?? [];
      if (!matches.length || !mapRef.current) return;
      setFilters((s) => ({ ...s, facility: "", program: "", query: name }));
      setSelected(matches[0].properties);
      if (matches.length === 1) {
        mapRef.current.flyTo({ center: matches[0].geometry.coordinates as [number, number], zoom: 8, speed: 0.6 });
      } else {
        const b = new maplibregl.LngLatBounds();
        matches.forEach((mm) => b.extend(mm.geometry.coordinates as [number, number]));
        mapRef.current.fitBounds(b, { padding: 90, maxZoom: 8, duration: 800 });
      }
      const u = new URL(window.location.href);
      u.searchParams.set("company", name);
      window.history.replaceState({}, "", u);
    },
    [data]
  );

  const resetView = useCallback(() => {
    setFilters({ facility: "", program: "", query: "" });
    setSelected(null);
    mapRef.current?.flyTo({ center: CENTER, zoom: ZOOM, speed: 1.0 });
  }, []);

  const downloadCSV = useCallback(() => {
    const cols = ["Name", "Program", "Facility", "Street Address", "Suburb", "Postcode", "Source"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((f) => cols.map((c) => esc((f.properties as unknown as Record<string, unknown>)[c])).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "weapons-companies.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const shareCompany = useCallback((name: string) => {
    const u = new URL(window.location.href);
    u.searchParams.set("company", name);
    navigator.clipboard.writeText(u.toString());
    alert("Link copied — share it to show this company directly.");
  }, []);

  const goToMyLocation = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        meMarker.current?.remove();
        meMarker.current = new maplibregl.Marker({ color: "#1d4ed8" }).setLngLat(c).addTo(mapRef.current!);
        const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
        const within = (data?.features ?? []).filter((f) => {
          const [lo, la] = f.geometry.coordinates as [number, number];
          const dLat = rad(la - c[1]), dLon = rad(lo - c[0]);
          const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(c[1])) * Math.cos(rad(la)) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.asin(Math.sqrt(h)) <= 25;
        }).length;
        setNearby(within);
        mapRef.current!.flyTo({ center: c, zoom: 9, speed: 0.9 });
      },
      () => alert("Could not get your location. Please allow location access in your browser."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [data]);

  const stats = useMemo(() => {
    const by = (k: keyof SiteProps) => {
      const m = new Map<string, number>();
      filtered.forEach((f) => {
        const v = (f.properties[k] as string) || "—";
        m.set(v, (m.get(v) || 0) + 1);
      });
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return { program: by("Program") };
  }, [filtered]);

  const totals = useMemo(() => {
    const states = new Set((data?.features ?? []).map((f) => String(f.properties.Postcode || "").charAt(0)));
    return { sites: data?.features.length ?? 0, primes: primes.length, states: states.size };
  }, [data, primes]);

  return (
    <div className="wp-app">
      <AppHeader />
      <Ticker />

      <div className="wp-app-body">
        <aside className="wp-sidebar wp-scroll">
          <p className="wp-side-lede">Every marker is a company helping build the weapons used in Gaza and West Papua. This is where they operate.</p>
          <p className="wp-eyebrow-sm">Filter the record</p>
          <input
            aria-label="Search companies"
            placeholder="Search company…"
            value={filters.query}
            onChange={(e) => setFilters((s) => ({ ...s, query: e.target.value }))}
            className="wp-field w-full px-3 py-2 text-sm rounded-lg mb-2"
          />
          <select
            aria-label="Facility type"
            value={filters.facility}
            onChange={(e) => setFilters((s) => ({ ...s, facility: e.target.value }))}
            className="wp-field w-full px-3 py-2 text-sm rounded-lg mb-2"
          >
            <option value="">All facilities</option>
            {facilities.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            aria-label="Program or group"
            value={filters.program}
            onChange={(e) => setFilters((s) => ({ ...s, program: e.target.value }))}
            className="wp-field w-full px-3 py-2 text-sm rounded-lg mb-3"
          >
            <option value="">All programs</option>
            {programs.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
          </select>

          <div className="wp-side-actions grid grid-cols-3 gap-2 mb-4">
            <button onClick={goToMyLocation} className="wp-btn px-2 py-2 text-xs rounded-lg">My location</button>
            <button onClick={downloadCSV} className="wp-btn px-2 py-2 text-xs rounded-lg">Download</button>
            <button onClick={resetView} className="wp-btn px-2 py-2 text-xs rounded-lg">Reset</button>
          </div>

          <div className="wp-side-stats">
            <div><span className="wp-side-stat-num">{filtered.length}</span><span className="wp-side-stat-lbl">shown</span></div>
            <div><span className="wp-side-stat-num">{totals.primes}</span><span className="wp-side-stat-lbl">primes</span></div>
            <div><span className="wp-side-stat-num">{totals.states}</span><span className="wp-side-stat-lbl">states</span></div>
          </div>

          <div className="wp-side-block">
            <p className="wp-eyebrow-sm">By program</p>
            {stats.program.map(([label, n]) => {
              const max = stats.program[0]?.[1] || 1;
              return (
                <div key={label} className="mb-2">
                  <div className="flex justify-between items-baseline gap-2 mb-1 text-xs">
                    <span className="truncate">{label}</span>
                    <span className="wp-mono opacity-80 shrink-0">{n}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <motion.div className="h-full rounded-full" style={{ background: ACCENT }}
                      initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="wp-side-block">
            <p className="wp-eyebrow-sm">Prime contractors</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {primes.map((n) => (
                <button key={n} onClick={() => flyToName(n)} className="wp-chip wp-chip-dark"
                  style={n === selected?.Name ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>{n}</button>
              ))}
            </div>
            <p className="wp-eyebrow-sm">Other companies</p>
            <div className="flex flex-wrap gap-1.5">
              {others.map((n) => (
                <button key={n} onClick={() => flyToName(n)} className="wp-chip wp-chip-dark"
                  style={n === selected?.Name ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>{n}</button>
              ))}
            </div>
          </div>
        </aside>

        <div className="wp-mapzone">
          <div ref={containerRef} className="absolute inset-0" />

          <div className="wp-map-actions absolute left-3 z-10 flex flex-col gap-2" style={{ top: 52 }}>
            <button onClick={goToMyLocation} aria-label="My location" title="My location" className="wp-map-iconbtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            </button>
            <button onClick={downloadCSV} aria-label="Download data" title="Download data" className="wp-map-iconbtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>
            </button>
            <button onClick={resetView} aria-label="Reset view" title="Reset view" className="wp-map-iconbtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
          </div>

          <div className="wp-panel absolute left-3 top-3 z-10 flex rounded-lg overflow-hidden text-xs">

            <button onClick={() => setSatellite(false)} className={`px-3 py-1.5 ${!satellite ? "wp-btn-active" : ""}`}>Map</button>

            <button onClick={() => setSatellite(true)} className={`px-3 py-1.5 ${satellite ? "wp-btn-active" : ""}`}>Satellite</button>

          </div>

          {nearby !== null && !selected && (
            <div className="wp-panel absolute left-1/2 z-30 px-4 py-2 rounded-full text-xs whitespace-nowrap text-center" style={{ transform: "translateX(-50%)", bottom: 16 }}>
              {nearby > 0
                ? <><b style={{ color: ACCENT }}>{nearby}</b>{" weapons "}{nearby === 1 ? "site" : "sites"}{" within 25 km of you"}</>
                : <>{"No sites within 25 km — but they operate across your state."}</>}
            </div>
          )}

          <AnimatePresence>
            {selected && (
              <motion.aside
                key={selected.Name}
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className="wp-panel wp-scroll absolute right-0 top-0 bottom-0 z-20 w-[380px] max-w-[88%] overflow-y-auto p-6"
              >
                <button onClick={() => setSelected(null)} aria-label="Close panel"
                  className="absolute right-4 top-4 opacity-50 hover:opacity-100 text-2xl leading-none">×</button>
                <h3 className="text-xl font-semibold pr-8 leading-tight" style={{ color: ACCENT }}>{selected.Name}</h3>
                {selected.Program && (
                  <span className="wp-mono inline-block mt-3 px-2.5 py-1 text-[11px] rounded-full"
                    style={{ background: "rgba(214,31,154,0.16)", color: "#f7a8dc" }}>{selected.Program}</span>
                )}
                <p className="wp-panel-lede">This site is part of the supply chain arming genocide. Its work doesn't stay in Australia.</p>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    [selected.Name, selected["Street Address"], selected.Suburb, selected.Postcode, "Australia"].filter(Boolean).join(", ")
                  )}`} target="_blank" rel="noopener noreferrer"
                  className="wp-btn wp-btn-active flex items-center justify-center gap-2 mt-4 mb-3 px-3 py-2 text-sm rounded-lg font-medium">View on Google Maps</a>
                <button onClick={() => shareCompany(selected.Name)} className="wp-btn w-full mb-3 px-3 py-2 text-sm rounded-lg">Share this company</button>
                <div className="mb-3 p-3 rounded-lg text-xs leading-relaxed" style={{ background: "rgba(214,31,154,0.12)", border: "1px solid rgba(214,31,154,0.3)" }}>
                  <b>Take action:</b> contact this company or your MP to demand they stop arming genocide. Email{" "}
                  <a href="mailto:info@wagepeaceau.org" className="underline" style={{ color: "#f7a8dc" }}>Wage Peace</a> to get involved.
                </div>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `${selected.Name} is helping arm genocide from right here in Australia. These weapons companies operate in our backyard and most people have no idea. See who is on the map: #WagePeace #DisruptWar #StopArmingIsrael `
                  )}${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer"
                  className="wp-btn w-full mb-5 px-3 py-2 text-sm rounded-lg block text-center">Spread the word</a>
                <dl className="text-sm space-y-4">
                  {selected.Facility && <Row label="Facility"><span>{selected.Facility}</span></Row>}
                  {(selected["Street Address"] || selected.Suburb) && (
                    <Row label="Address">{[selected["Street Address"], selected.Suburb, selected.Postcode].filter(Boolean).join(", ")}</Row>
                  )}
                  {selected.Details && <Row label="Details"><span className="whitespace-pre-line leading-relaxed">{selected.Details}</span></Row>}
                  {selected.Source && (
                    <Row label="Source">
                      <a href={selected.Source} target="_blank" rel="noopener noreferrer" className="underline break-all" style={{ color: "#f7a8dc" }}>{selected.Source}</a>
                    </Row>
                  )}
                </dl>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="wp-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-1">{label}</dt>
      <dd className="opacity-95">{children}</dd>
    </div>
  );
}
