import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WeaponsMap from "./components/WeaponsMap";
import "./index.css";

function mount() {
  // Production: reuse the existing WordPress container (never changes the URL/DOM contract).
  // Dev: fall back to Vite's #root.
  const el =
    document.getElementById("thisisthemap") ??
    document.getElementById("root");
  if (!el) return;
  // Strip legacy inline sizing/offset so the modern layout controls dimensions.
  el.removeAttribute("style");
  el.classList.add("wp-weapons-map");
  createRoot(el).render(
    <StrictMode>
      <WeaponsMap />
    </StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
