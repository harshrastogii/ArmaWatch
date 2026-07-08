import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { loadSites, PRIME } from "../lib/data";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";
import Ticker from "./Ticker";
import type { SiteCollection } from "../types";

const ACCENT = "#d61f9a";
const PALETTE = ["#d61f9a", "#a21caf", "#7c3aed", "#4f46e5", "#0891b2", "#0d9488"];
const STATE: Record<string, string> = {
  "2": "NSW", "3": "VIC", "4": "QLD", "5": "SA", "6": "WA", "7": "TAS", "0": "NT/ACT",
};

export default function Dashboard() {
  const [data, setData] = useState<SiteCollection | null>(null);
  useEffect(() => { loadSites("/data/weapons.geojson").then(setData).catch(console.error); }, []);

  const m = useMemo(() => {
    const f = data?.features ?? [];
    const count = (key: (p: any) => string) => {
      const map = new Map<string, number>();
      f.forEach((x) => { const k = key(x.properties) || "-"; map.set(k, (map.get(k) || 0) + 1); });
      return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };
    const byProgram = count((p) => p.Program);
    const byFacility = count((p) => p.Facility);
    const byState = count((p) => STATE[String(p.Postcode || "").charAt(0)] || "Unknown");
    const names = [...new Set(f.map((x) => x.properties.Name))];
    const primeCount = new Set(f.filter((x) => x.properties.Program === PRIME).map((x) => x.properties.Name)).size;
    const topProgram = byProgram[0];
    const topState = byState.filter((x) => x.name !== "Unknown")[0];
    const primeShare = f.length ? Math.round((f.filter((x) => x.properties.Program === PRIME).length / f.length) * 100) : 0;
    const insights = [
      topProgram && `The largest program is "${topProgram.name}", tied to ${topProgram.value} of ${f.length} mapped sites.`,
      topState && `${topState.name} carries the heaviest concentration - ${topState.value} sites - more than any other state.`,
      `Prime contractors account for ${primeShare}% of sites; the remainder are smaller suppliers feeding their chains.`,
    ].filter(Boolean) as string[];
    return { total: f.length, companyCount: names.length, primeCount, byProgram, byFacility, byState, names, insights };
  }, [data]);

  if (!data) return <div className="wp-weapons-map p-10 text-center opacity-60">Loading data...</div>;

  return (
    <div className="wp-weapons-map wp-dash">
      <AppHeader />
      <Ticker />
      <header className="wp-hero">
        <div className="wp-hero-inner">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="wp-eyebrow">Weapons manufacturing in Australia · public accountability record</p>
            <h1 className="wp-hero-count">
              <span className="wp-count-num">{m.total}</span>
              <span className="wp-count-label">sites mapped, and counting.</span>
            </h1>
            <p className="wp-hero-sub">
              {m.companyCount} companies. {m.primeCount} prime contractors. Operating across your states, suburbs,
              and - for some - your street. This is the supply chain, made visible.
            </p>
          </motion.div>
        </div>
      </header>

      <div className="wp-dash-body">
        <div className="wp-kpis">
          <Kpi label="Total sites" value={m.total} />
          <Kpi label="Companies" value={m.companyCount} />
          <Kpi label="Prime contractors" value={m.primeCount} />
          <Kpi label="States covered" value={m.byState.filter((s) => s.name !== "Unknown").length} />
        </div>
        <div className="wp-grid">
          <Card title="Sites by program">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={m.byProgram} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#c9c9c9" }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#c9c9c9" }} />
                <Tooltip contentStyle={tooltip} />
                <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Sites by state">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={m.byState}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#c9c9c9" }} />
                <YAxis tick={{ fontSize: 11, fill: "#c9c9c9" }} />
                <Tooltip contentStyle={tooltip} />
                <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Facility type">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={m.byFacility} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {m.byFacility.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card title="What the data shows">
            <ul className="wp-insights">
              {m.insights.map((t, i) => (
                <li key={i}><span className="wp-insight-num">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
              ))}
            </ul>
          </Card>
        </div>
        <AppFooter />
      </div>
    </div>
  );
}

const tooltip = { background: "#0f1419", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f5f5f4" };

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="wp-kpi">
      <div className="wp-kpi-num">{value}</div>
      <div className="wp-kpi-label">{label}</div>
    </motion.div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wp-card">
      <p className="wp-card-title">{title}</p>
      {children}
    </div>
  );
}
