import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SideBar from "../components/SideBar";
import SatelliteInfoPanel from "../components/SatelliteInfoPanel";
import { ORBIT_HEX } from "../utils/orbitColors";

// Responsive breakpoints: the sidebar narrows (and the navbar shortens) on
// tablet-width viewports instead of eating a fixed, disproportionate slice
// of a smaller screen. Below the mobile breakpoint the sidebar leaves the
// layout flow entirely and becomes a toggleable bottom sheet over a
// fullscreen radar canvas instead of just shrinking further.
const MOBILE_BREAKPOINT = 600;
const TABLET_BREAKPOINT = 900;
// The ARIES-SSA site's own fixed header (see SiteHeader.jsx), which this
// page now sits below as a section of the site rather than a standalone
// fullscreen app — fixed at 80px site-wide, not responsive (verified:
// landing.css never overrides --header-height at any breakpoint).
const SITE_HEADER_HEIGHT = 80;
const VISUALIZER_FOOTER_HEIGHT = 32;
const getSidebarWidth = (width) => {
  if (width <= MOBILE_BREAKPOINT) return 0;
  return width <= TABLET_BREAKPOINT ? 240 : 360;
};
const getNavbarHeight = (width) => (width <= MOBILE_BREAKPOINT ? 52 : 60);

const HIGH_ELEVATION_LABEL_THRESHOLD = 70; // always-labeled regardless of hover
const DOT_HIT_RADIUS = 8; // px, generous enough to hit without pixel-perfect aim

export default function SkyRadarPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const lat = parseFloat(searchParams.get("lat"));
  const lon = parseFloat(searchParams.get("lon"));
  // Observer altitude in km above the ellipsoid, from the URL (defaults to
  // sea level if not provided — backward compatible with old /radar links).
  const parsedAlt = parseFloat(searchParams.get("alt"));
  const alt = isNaN(parsedAlt) ? 0 : parsedAlt;

  const [minElevation, setMinElevation] = useState(30);
  const [altitudeFilter, setAltitudeFilter] = useState("all");

  const [satellites, setSatellites] = useState([]);
  const [passes, setPasses] = useState([]);
  const [hoveredName, setHoveredName] = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = viewportWidth <= MOBILE_BREAKPOINT;
  const sidebarWidth = getSidebarWidth(viewportWidth);
  const navbarHeight = getNavbarHeight(viewportWidth);

  const canvasRef = useRef(null);

  // The radar draw loop reads these via refs instead of closing over state
  // directly, so the requestAnimationFrame loop below can be created once
  // and kept running for the component's lifetime instead of being torn
  // down and recreated every time new data arrives (see RADAR DRAW below).
  const satellitesRef = useRef([]);
  const minElevationRef = useRef(minElevation);
  const altitudeFilterRef = useRef(altitudeFilter);
  const hoveredNameRef = useRef(null);
  const selectedNameRef = useRef(null);
  // Screen-space positions of the dots drawn on the most recent frame,
  // used for mouse hit-testing (hover/click) without re-deriving geometry.
  const drawnDotsRef = useRef([]);

  useEffect(() => {
    satellitesRef.current = satellites;
  }, [satellites]);

  useEffect(() => {
    minElevationRef.current = minElevation;
  }, [minElevation]);

  useEffect(() => {
    altitudeFilterRef.current = altitudeFilter;
  }, [altitudeFilter]);

  useEffect(() => {
    hoveredNameRef.current = hoveredName;
  }, [hoveredName]);

  useEffect(() => {
    selectedNameRef.current = selectedName;
  }, [selectedName]);

  // Derived, not synced via effect: always reflects the latest snapshot
  // for whichever satellite is selected.
  const selectedSat = useMemo(
    () =>
      selectedName
        ? satellites.find((s) => s.name === selectedName) || null
        : null,
    [selectedName, satellites]
  );

  useEffect(() => {
    if (isNaN(lat) || isNaN(lon)) return;

    async function fetchVisible() {
      const res = await fetch(
        `/visualizer-api/visible?lat=${lat}&lon=${lon}&alt=${alt}`
      );
      const data = await res.json();
      setSatellites(data);
    }

    fetchVisible();
    const interval = setInterval(fetchVisible, 1000);
    return () => clearInterval(interval);
  }, [lat, lon, alt]);

  // ---------------- FETCH PASSES ----------------
  useEffect(() => {
    if (isNaN(lat) || isNaN(lon)) return;

    async function fetchPasses() {
      const res = await fetch(
        `/visualizer-api/passes?lat=${lat}&lon=${lon}&alt=${alt}`
      );
      const data = await res.json();
      setPasses(data);
    }

    fetchPasses();
    const interval = setInterval(fetchPasses, 10000);
    return () => clearInterval(interval);
  }, [lat, lon, alt]);

  // ---------------- SIDEBAR LIST ----------------
  // Derived entirely from satellites/passes/filters, so it's computed
  // during render via useMemo rather than via an effect + setState (which
  // would cause an extra, unnecessary render pass every time the source
  // data changes). Only recomputes when those inputs actually change —
  // not on every animation frame like the radar dot-drawing below.
  const visibleSats = useMemo(() => {
    const visible = [];

    satellites.forEach((sat) => {
      const { azimuth, elevation, alt_km } = sat;

      if (typeof azimuth !== "number" || typeof elevation !== "number") return;
      if (elevation < minElevation || elevation > 90) return;
      if (altitudeFilter === "low" && alt_km >= 1000) return;
      if (altitudeFilter === "high" && alt_km < 1000) return;

      const pass = passes.find((p) => p.name?.trim() === sat.name?.trim());

      visible.push({
        name: sat.name,
        elevation,
        orbit_type: sat.orbit_type,
        norad_id: sat.norad_id,
        alt_km: sat.alt_km,
        // Every satellite in this list is, by construction, currently
        // visible (the backend's /visible endpoint only returns
        // elevation >= 30°) — so the status is always "currently visible";
        // what varies is whether we have a set time for it. A satellite
        // can legitimately have no set time within the queried window
        // (e.g. a near-geostationary one that simply doesn't set), so
        // this is an honest "unavailable" rather than a fabricated value.
        setTime: pass?.set_time ?? null,
      });
    });

    visible.sort((a, b) => b.elevation - a.elevation);
    return visible.slice(0, 30);
  }, [satellites, passes, minElevation, altitudeFilter]);

  // ---------------- RADAR DRAW ----------------
  // Created once and kept alive for the component's lifetime — reads
  // live values via refs (see above) instead of being torn down and
  // recreated every time `satellites` updates, which previously started a
  // brand-new requestAnimationFrame loop roughly once a second without
  // ever cancelling the previous one.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      // Computed fresh from window.innerWidth each time (not from React
      // state) since this handler is set up once and kept alive for the
      // component's lifetime — see RADAR DRAW below.
      canvas.width = window.innerWidth - getSidebarWidth(window.innerWidth);
      canvas.height =
        window.innerHeight -
        SITE_HEADER_HEIGHT -
        VISUALIZER_FOOTER_HEIGHT -
        getNavbarHeight(window.innerWidth);
    };

    resize();
    window.addEventListener("resize", resize);

    let sweepAngle = 0;
    let animationFrameId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius =
        Math.min(canvas.width, canvas.height) / 2 - 20;

      ctx.strokeStyle = "rgba(0,255,255,0.35)";
      ctx.lineWidth = 1;

      // Rings
      for (let el = 30; el <= 90; el += 15) {
        const r = (maxRadius * (90 - el)) / 60;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Azimuth lines
      for (let deg = 0; deg < 360; deg += 15) {
        const rad = (deg * Math.PI) / 180;
        const x = centerX + maxRadius * Math.sin(rad);
        const y = centerY - maxRadius * Math.cos(rad);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      // Sweep beam
      const beamWidth = (20 * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX,
        centerY,
        maxRadius,
        sweepAngle - beamWidth / 2,
        sweepAngle + beamWidth / 2
      );
      ctx.closePath();

      const beamGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        maxRadius
      );
      beamGradient.addColorStop(0, "rgba(0,255,255,0.35)");
      beamGradient.addColorStop(1, "rgba(0,255,255,0)");

      ctx.fillStyle = beamGradient;
      ctx.fill();

      sweepAngle += 0.01;
      if (sweepAngle > Math.PI * 2) sweepAngle = 0;

      const minElevation = minElevationRef.current;
      const altitudeFilter = altitudeFilterRef.current;
      const hoveredName = hoveredNameRef.current;
      const selectedName = selectedNameRef.current;
      const drawnDots = [];

      satellitesRef.current.forEach((sat) => {
        const { azimuth, elevation, alt_km } = sat;

        if (
          typeof azimuth !== "number" ||
          typeof elevation !== "number"
        )
          return;

        // Elevation filter
        if (elevation < minElevation || elevation > 90)
          return;

        // Altitude filter
        if (altitudeFilter === "low" && alt_km >= 1000)
          return;
        if (altitudeFilter === "high" && alt_km < 1000)
          return;

        const r = (maxRadius * (90 - elevation)) / 60;
        const rad = (azimuth * Math.PI) / 180;

        const px = centerX + r * Math.sin(rad);
        const py = centerY - r * Math.cos(rad);

        drawnDots.push({ name: sat.name, px, py });

        const isHovered = sat.name === hoveredName;
        const isSelected = sat.name === selectedName;
        const dotColor = ORBIT_HEX[sat.orbit_type] || "#00FFFF";

        // Selection ring — drawn under the dot so it reads as a highlight,
        // not a replacement for the orbit-color dot itself.
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Dot
        ctx.shadowBlur = 8;
        ctx.shadowColor = dotColor;
        ctx.fillStyle = dotColor;

        ctx.beginPath();
        ctx.arc(px, py, isHovered ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Label — only for the hovered/selected dot or high-elevation
        // (near-zenith) satellites, which are naturally sparser on
        // screen. With the full catalogue's typical density, labeling
        // everything makes the view unreadable; this keeps it clean by
        // default while staying fully informative on demand.
        const shouldLabel =
          isHovered || isSelected || elevation >= HIGH_ELEVATION_LABEL_THRESHOLD;
        if (!shouldLabel) return;

        const label =
          sat.name.length > 14
            ? sat.name.slice(0, 14) + "…"
            : sat.name;

        ctx.font = "11px monospace";
        ctx.textBaseline = "middle";

        const padding = 6;
        const textWidth = ctx.measureText(label).width;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = 18;

        const boxX = px + 10;
        const boxY = py - boxHeight / 2;

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#eaffff";
        ctx.fillText(label, boxX + padding, py);
      });

      drawnDotsRef.current = drawnDots;

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    const findDotAt = (offsetX, offsetY) =>
      drawnDotsRef.current.find(
        (d) => Math.hypot(d.px - offsetX, d.py - offsetY) <= DOT_HIT_RADIUS
      );

    const handleMouseMove = (e) => {
      const hit = findDotAt(e.offsetX, e.offsetY);
      const name = hit ? hit.name : null;
      canvas.style.cursor = hit ? "pointer" : "default";

      // Only triggers a re-render when the hovered dot actually changes,
      // not on every mousemove tick while the cursor drifts within (or
      // outside) the same hit area — mousemove can fire far more often
      // than the 1Hz data updates this page otherwise deals with.
      if (name !== hoveredNameRef.current) {
        hoveredNameRef.current = name;
        setHoveredName(name);
      }
    };

    const handleClick = (e) => {
      const hit = findDotAt(e.offsetX, e.offsetY);
      setSelectedName(hit ? hit.name : null);
      // On mobile, selecting a satellite shows its info sheet — close the
      // satellite-list sheet so the two don't stack on a small screen.
      if (hit) setDrawerOpen(false);
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const isNarrow = viewportWidth <= TABLET_BREAKPOINT;

  return (
    <div style={layout}>
      <div style={{ ...navbar, height: `${navbarHeight}px`, flexWrap: "wrap" }}>
        <button onClick={() => navigate("/")} className="sv-btn">
          ← Globe View
        </button>

        <div style={{ display: "flex", gap: isNarrow ? 8 : 12, flexWrap: "wrap" }}>
          <select
            value={minElevation}
            onChange={(e) =>
              setMinElevation(Number(e.target.value))
            }
            className="sv-select"
          >
            <option value={30}>Elevation ≥ 30°</option>
            <option value={60}>Elevation ≥ 60°</option>
            <option value={70}>Elevation ≥ 70°</option>
            <option value={80}>Elevation ≥ 80°</option>
          </select>

          <select
            value={altitudeFilter}
            onChange={(e) =>
              setAltitudeFilter(e.target.value)
            }
            className="sv-select"
          >
            <option value="all">All Altitudes</option>
            <option value="low">Below 1000 km</option>
            <option value="high">Above 1000 km</option>
          </select>
        </div>
      </div>

      <div
        style={{
          ...radarArea,
          top: `${navbarHeight}px`,
          width: `calc(100% - ${sidebarWidth}px)`,
          height: `calc(100% - ${navbarHeight}px)`,
        }}
      >
        <canvas ref={canvasRef} />
      </div>

      {/* Mobile-only floating toggle for the visible-satellites sheet —
          on desktop/tablet/laptop the sidebar is always visible in the
          layout, so this button doesn't render there at all. */}
      {isMobile && !selectedSat && (
        <button
          className="sv-fab"
          style={drawerFabStyle}
          onClick={() => setDrawerOpen((open) => !open)}
        >
          {drawerOpen ? "Close List" : `Satellites (${visibleSats.length})`}
        </button>
      )}

      {selectedSat && (
        <div
          className="sv-floating-panel sv-mobile-bottom-sheet"
          style={{ ...infoPanelWrapStyle, top: `${navbarHeight + 20}px` }}
        >
          <SatelliteInfoPanel
            satellite={selectedSat}
            lastUpdated={new Date().toISOString()}
            onClose={() => setSelectedName(null)}
          />
        </div>
      )}

      <div
        className={isMobile ? "sv-floating-panel sv-mobile-bottom-sheet" : undefined}
        style={{
          ...sidebarWrapper,
          top: `${navbarHeight}px`,
          width: `${sidebarWidth}px`,
          height: `calc(100% - ${navbarHeight}px)`,
          ...(isMobile
            ? { transform: `translateY(${drawerOpen ? "0" : "100%"})` }
            : null),
        }}
      >
        <SideBar
          satellites={visibleSats}
          selectedName={selectedName}
          onSelect={(sat) => {
            setSelectedName(sat.name);
            setDrawerOpen(false);
          }}
        />
      </div>
    </div>
  );
}



const layout = {
  position: "fixed",
  top: SITE_HEADER_HEIGHT,
  left: 0,
  right: 0,
  bottom: VISUALIZER_FOOTER_HEIGHT,
  background: "var(--sv-bg)",
  overflow: "hidden",
};

const navbar = {
  // height overridden inline per-render from getNavbarHeight(viewportWidth)
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 24px",
  background: "rgba(0,20,30,0.9)",
  borderBottom: "1px solid rgba(0,255,255,0.2)",
  zIndex: 20,
};

const radarArea = {
  // top/width/height overridden inline per-render (see above)
  position: "absolute",
  left: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const infoPanelWrapStyle = {
  // top overridden inline per-render
  position: "absolute",
  left: 20,
  zIndex: 25,
};

const drawerFabStyle = {
  left: "50%",
  bottom: 20,
  transform: "translateX(-50%)",
};

const sidebarWrapper = {
  // top/width/height overridden inline per-render
  position: "absolute",
  right: 0,
};