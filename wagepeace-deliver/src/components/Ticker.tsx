import { useEffect, useState } from "react";
import { loadSites } from "../lib/data";

export default function Ticker() {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    loadSites("/data/weapons.geojson")
      .then((d) => setNames([...new Set(d.features.map((f) => f.properties.Name))]))
      .catch(() => {});
  }, []);
  if (!names.length) return null;
  const doubled = [...names, ...names];
  return (
    <div className="wp-ticker" aria-hidden="true">
      <div className="wp-ticker-track">
        {doubled.map((n, i) => (
          <span key={i} className="wp-ticker-item">
            {n}<span className="wp-ticker-dot">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
