import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import WeaponsMap from "./components/WeaponsMap";
import Dashboard from "./components/Dashboard";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WeaponsMap />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

function mount() {
  const el = document.getElementById("thisisthemap") ?? document.getElementById("root");
  if (!el) return;
  el.removeAttribute("style");
  el.classList.add("wp-weapons-map");
  createRoot(el).render(<StrictMode><App /></StrictMode>);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
