// Single source of truth for orbit-regime colors, shared by the globe
// (Cesium.Color), the radar canvas (CSS color strings), and the sidebar/
// info-panel badges (CSS classes) — avoids the same LEO/MEO/GEO/HEO
// mapping being redefined independently in three places.
export const ORBIT_HEX = {
  LEO: "#22d3ee",
  MEO: "#ffd60a",
  GEO: "#ff9f1c",
  HEO: "#b388ff",
};

export const ORBIT_BADGE_CLASS = {
  LEO: "sv-badge-leo",
  MEO: "sv-badge-meo",
  GEO: "sv-badge-geo",
  HEO: "sv-badge-heo",
};

export function orbitColor(orbitType) {
  return ORBIT_HEX[orbitType] || "#ffffff";
}
