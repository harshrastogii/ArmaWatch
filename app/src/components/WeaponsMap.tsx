import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import { AnimatePresence, motion } from "framer-motion";
import type { Filters, SiteCollection, SiteFeature, SiteProps } from "../types";
import { loadSites, uniqueSorted, PRIME } from "../lib/data";
import type { FeatureCollection, Point } from "geojson";

const DATA_URL = "/data/weapons.geojson";
const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
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
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("links", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "links",
        type: "line",
        source: "links",
        layout: { "line-cap": "round" },
        paint: { "line-color": ACCENT, "line-opacity": 0.55, "line-width": 1.5, "line-dasharray": [2, 1.5] },
      });
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
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const src = mapRef.current.getSource("sites") as GeoJSONSource | undefined;
    if (src) src.setData({ type: "FeatureCollection", features: filtered });
  }, [filtered, ready]);

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
        matches.forEach((m) => b.extend(m.geometry.coordinates as [number, number]));
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

  const linkData = useMemo<FeatureCollection>(() => {
    if (!data || !selected) return { type: "FeatureCollection", features: [] };
    const origin = data.features.find((f) => f.properties.Name === selected.Name);
    if (!origin) return { type: "FeatureCollection", features: [] };
    const peers = data.features.filter(
      (f) => f.properties.Program === selected.Program && f.properties.Name !== selected.Name
    );
    return {
      type: "FeatureCollection",
      features: peers.map((peer) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [origin.geometry.coordinates, peer.geometry.coordinates] },
        properties: {},
      })),
    };
  }, [data, selected]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const src = mapRef.current.getSource("links") as GeoJSONSource | undefined;
    const visible = false;
    if (src) src.setData(visible ? linkData : { type: "FeatureCollection", features: [] });
  }, [linkData, selected, ready]);

  const totals = useMemo(() => {
    const states = new Set((data?.features ?? []).map((f) => String(f.properties.Postcode || "").charAt(0)));
    return { sites: data?.features.length ?? 0, primes: primes.length, states: states.size };
  }, [data, primes]);

  return (
    <div className="wp-weapons-map w-full">
      <div className="wp-mono text-xs opacity-70 mb-2 tracking-wide">
        {totals.sites} sites · {totals.primes} prime contractors · {totals.states} states
      </div>
      <div className="relative w-full" style={{ height: 620 }}>
        <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" style={{ height: 620 }} />

        <div className="wp-panel absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 p-2.5 rounded-2xl max-w-[calc(100%-1.5rem)]">
          <input
            aria-label="Search companies"
            placeholder="Search company…"
            value={filters.query}
            onChange={(e) => setFilters((s) => ({ ...s, query: e.target.value }))}
            className="wp-field px-3 py-1.5 text-sm rounded-lg w-44"
          />
          <select
            aria-label="Facility type"
            value={filters.facility}
            onChange={(e) => setFilters((s) => ({ ...s, facility: e.target.value }))}
            className="wp-field px-3 py-1.5 text-sm rounded-lg"
          >
            <option value="">All facilities</option>
            {facilities.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            aria-label="Program or group"
            value={filters.program}
            onChange={(e) => setFilters((s) => ({ ...s, program: e.target.value }))}
            className="wp-field px-3 py-1.5 text-sm rounded-lg max-w-[220px]"
          >
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button onClick={goToMyLocation} className="wp-btn px-3 py-1.5 text-sm rounded-lg">
            My location
          </button>
          <button onClick={resetView} className="wp-btn px-3 py-1.5 text-sm rounded-lg">
            Reset
          </button>
          <button onClick={downloadCSV} className="wp-btn px-3 py-1.5 text-sm rounded-lg">
            Download data
          </button>
          <span className="wp-mono px-1.5 text-xs self-center opacity-70">{filtered.length} sites</span>
        </div>


        {nearby !== null && (
          <div className="wp-panel absolute left-1/2 z-30 px-4 py-2.5 rounded-full text-sm text-center" style={{ transform: "translateX(-50%)", bottom: 16 }}>
            {nearby > 0
              ? <><b style={{ color: ACCENT }}>{nearby}</b>{" weapons "}{nearby === 1 ? "site" : "sites"}{" within 25 km of you"}</>
              : <>{"No sites within 25 km — but they operate across your state."}</>}
          </div>
        )}

        <div className="wp-panel absolute left-3 bottom-3 z-10 p-3.5 rounded-2xl w-64 text-xs">
          <p className="font-semibold mb-2.5 uppercase tracking-[0.14em] text-[10px] opacity-55">By program</p>
          {stats.program.map(([label, n]) => {
            const max = stats.program[0]?.[1] || 1;
            return (
              <div key={label} className="mb-2 last:mb-0">
                <div className="flex justify-between items-baseline gap-2 mb-1">
                  <span className="truncate">{label}</span>
                  <span className="wp-mono opacity-80 shrink-0">{n}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: ACCENT }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(n / max) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <AnimatePresence>
          {selected && (
            <motion.aside
              key={selected.Name}
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="wp-panel wp-scroll absolute right-0 top-0 bottom-0 z-20 w-[380px] max-w-[88%] overflow-y-auto p-6 rounded-none"
            >
              <button
                onClick={() => setSelected(null)}
                aria-label="Close panel"
                className="absolute right-4 top-4 opacity-50 hover:opacity-100 text-2xl leading-none"
              >
                ×
              </button>

              <h3 className="text-xl font-semibold pr-8 leading-tight" style={{ color: ACCENT }}>
                {selected.Name}
              </h3>

              {selected.Program && (
                <span
                  className="wp-mono inline-block mt-3 px-2.5 py-1 text-[11px] rounded-full"
                  style={{ background: "rgba(214,31,154,0.16)", color: "#f7a8dc" }}
                >
                  {selected.Program}
                </span>
              )}

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [selected.Name, selected["Street Address"], selected.Suburb, selected.Postcode, "Australia"]
                    .filter(Boolean)
                    .join(", ")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="wp-btn wp-btn-active flex items-center justify-center gap-2 mt-4 mb-5 px-3 py-2 text-sm rounded-lg font-medium"
              >
                View on Google Maps
              </a>

              <button
                onClick={() => shareCompany(selected.Name)}
                className="wp-btn w-full mb-5 px-3 py-2 text-sm rounded-lg"
              >
                Share this company
              </button>

              <div className="mb-5 p-3 rounded-lg text-xs leading-relaxed" style={{ background: "rgba(214,31,154,0.12)", border: "1px solid rgba(214,31,154,0.3)" }}>
                <b>Take action:</b> contact this company or your MP to demand they stop arming genocide. Email{" "}
                <a href="mailto:info@wagepeaceau.org" className="underline" style={{ color: "#f7a8dc" }}>Wage Peace</a> to get involved.
              </div>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `🚨 ${selected.Name} is helping arm genocide from right here in Australia.\n\nThese weapons companies operate in our backyard — and most people have no idea.\n\nSee who\'s on the map 👇\n#WagePeace #DisruptWar #StopArmingIsrael\n\n`
                )}${encodeURIComponent(window.location.href)}`}
                target="_blank" rel="noopener noreferrer"
                className="wp-btn w-full mb-5 px-3 py-2 text-sm rounded-lg block text-center"
              >
                Spread the word
              </a>

              <dl className="text-sm space-y-4">
                {selected.Facility && (
                  <Row label="Facility">
                    <span>{selected.Facility}</span>
                  </Row>
                )}
                {(selected["Street Address"] || selected.Suburb) && (
                  <Row label="Address">
                    {[selected["Street Address"], selected.Suburb, selected.Postcode].filter(Boolean).join(", ")}
                  </Row>
                )}
                {selected.Details && (
                  <Row label="Details">
                    <span className="whitespace-pre-line leading-relaxed">{selected.Details}</span>
                  </Row>
                )}
                {selected.Source && (
                  <Row label="Source">
                    <a
                      href={selected.Source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline break-all"
                      style={{ color: "#f7a8dc" }}
                    >
                      {selected.Source}
                    </a>
                  </Row>
                )}
              </dl>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <CompanyLists primes={primes} others={others} onPick={flyToName} activeName={selected?.Name} />
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

function CompanyLists({
  primes,
  others,
  onPick,
  activeName,
}: {
  primes: string[];
  others: string[];
  onPick: (n: string) => void;
  activeName?: string;
}) {
  const chip = (n: string) => {
    const active = n === activeName;
    return (
      <button
        key={n}
        onClick={() => onPick(n)}
        className="wp-chip"
        style={active ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}
      >
        {n}
      </button>
    );
  };
  return (
    <div className="mt-6">
      <p className="wp-mono text-[10px] uppercase tracking-[0.16em] opacity-55 mb-2">Prime contractors</p>
      <div className="flex flex-wrap gap-2 mb-5">{primes.map(chip)}</div>
      <p className="wp-mono text-[10px] uppercase tracking-[0.16em] opacity-55 mb-2">Other weapons companies</p>
      <div className="flex flex-wrap gap-2">{others.map(chip)}</div>
    </div>
  );
}
