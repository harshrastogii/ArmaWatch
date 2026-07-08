import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WeaponsMap from "./components/WeaponsMap";
import "./index.css";

function mount() {
  const el = document.getElementById("thisisthemap") ?? document.getElementById("root");
  if (!el) return;
  el.classList.add("wp-weapons-map");
  createRoot(el).render(<StrictMode><WeaponsMap /></StrictMode>);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
