import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as Cesium from "cesium";
import { useNavigate } from "react-router-dom";
import { addLatLonGrid } from "./latlongGrid";
import SatelliteInfoPanel from "./SatelliteInfoPanel";
import LoadingOverlay from "./LoadingOverlay";
import { ORBIT_HEX } from "../utils/orbitColors";

// How much position history each satellite entity keeps for Cesium's
// interpolation/extrapolation. Without a cap, SampledPositionProperty
// accumulates a sample on every update (roughly once a second) for as
// long as the page stays open, growing memory unboundedly over a long
// session — this bounds it to a rolling window instead.
const SAMPLE_RETENTION_SECONDS = 30;

// How long a newly-created satellite dot takes to fade from transparent to
// full opacity. Only entities actively fading cost anything per frame —
// once an entity finishes it's dropped from the fade queue entirely, so
// this doesn't add ongoing per-frame cost across the whole catalogue.
const FADE_IN_MS = 600;

const DEFAULT_PIXEL_SIZE = 3;
const SELECTED_PIXEL_SIZE = 9;

const EARTH_RADIUS_M = 6378137;
// A mild latitude offset for the camera position gives a slight top-down
// tilt (seeing some of the limb/curvature) purely by *where* the camera
// sits — the boresight below always points exactly at Earth's center
// regardless of this value, so changing it can never push the globe
// off-center.
const CAMERA_LATITUDE_DEG = 20;
const CAMERA_LONGITUDE_DEG = 0;
// The globe's angular radius, as seen by the camera, as a fraction of the
// half-angle of whichever field-of-view dimension is more constraining
// for the current aspect ratio. Comfortably fills the frame without
// touching the edges, on any aspect ratio.
const GLOBE_FIT_FRACTION = 0.72;

/**
 * Computes a camera position + orientation that (a) is always pointed
 * exactly at Earth's center — guaranteeing the globe is perfectly
 * centered in the viewport regardless of tilt, distance, or aspect ratio
 * — and (b) sits far enough back to comfortably fit the whole globe given
 * the canvas's *current* aspect ratio, instead of a fixed distance tuned
 * for one screen size.
 */
function computeCenteredGlobeView(viewer) {
  const canvas = viewer.scene.canvas;
  const aspectRatio = canvas.clientWidth / canvas.clientHeight;
  // frustum.fovy already accounts for the current aspect ratio (Cesium
  // locks the *larger* of the horizontal/vertical FOV to the configured
  // `fov`, and derives the smaller one from aspect ratio) — fovx is
  // derived the same way Cesium derives it internally.
  const fovY = viewer.camera.frustum.fovy;
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspectRatio);
  const constrainingHalfAngle = Math.min(fovX, fovY) / 2;

  const distance =
    EARTH_RADIUS_M / Math.sin(constrainingHalfAngle * GLOBE_FIT_FRACTION);

  const lat = Cesium.Math.toRadians(CAMERA_LATITUDE_DEG);
  const lon = Cesium.Math.toRadians(CAMERA_LONGITUDE_DEG);
  const position = new Cesium.Cartesian3(
    distance * Math.cos(lat) * Math.cos(lon),
    distance * Math.cos(lat) * Math.sin(lon),
    distance * Math.sin(lat)
  );

  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.negate(position, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );

  return { destination: position, orientation: { direction, up: Cesium.Cartesian3.UNIT_Z } };
}

export default function GlobeViewer() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const tooltipRef = useRef(null);
  // Keyed by norad_id, not satellite name: names in the live catalog are
  // NOT guaranteed unique (confirmed on the active feed — e.g. two
  // distinct satellites both named "OTTER", five distinct ones all named
  // "HULIANWANG JISHU SHIYAN*"). Keying by name would collide multiple
  // physically different satellites onto one Cesium entity, with each
  // one's addSample() call overwriting the others' for that tick.
  // norad_id is the NORAD catalog number, which is unique per object.
  const entityMapRef = useRef(new Map()); // norad_id -> Cesium.Entity
  const fadeQueueRef = useRef([]); // [{ entity, start, color }]
  const selectedEntityRef = useRef(null);
  const selectedNoradIdRef = useRef(null);
  const hoveredNameRef = useRef(null);
  const hasRenderedOnceRef = useRef(false);
  const earthReadyRef = useRef(false);

  // The full satellite catalogue (14,000+ entries, updated ~1Hz by the
  // backend) is intentionally NOT React state. It only ever needs to
  // drive imperative Cesium calls (renderGlobal, below) and the on-demand
  // search lookup — neither needs React to re-render when it changes.
  // Putting it in state would re-render this entire component, re-run
  // every memo, and reconcile the whole overlay JSX once a second even
  // when nothing the user can see actually needs to change.
  const globalDataRef = useRef([]);
  const lastUpdatedRef = useRef(null);

  const [loadingStage, setLoadingStage] = useState("earth");
  const [hoveredName, setHoveredName] = useState(null);
  // Only set when a satellite is actually selected, and only updated on
  // WS ticks while one remains selected — this is the one case where a
  // per-second re-render is legitimate (the open info panel's numbers are
  // supposed to stay live), and it's scoped to just that small object
  // instead of the full catalogue.
  const [selectedSatData, setSelectedSatData] = useState(null);
  const [selectedLastUpdated, setSelectedLastUpdated] = useState(null);
  const [satQuery, setSatQuery] = useState("");
  const [satMatches, setSatMatches] = useState([]);

  const ORBIT_COLORS = useMemo(
    () => ({
      LEO: Cesium.Color.fromCssColorString(ORBIT_HEX.LEO),
      MEO: Cesium.Color.fromCssColorString(ORBIT_HEX.MEO),
      GEO: Cesium.Color.fromCssColorString(ORBIT_HEX.GEO),
      HEO: Cesium.Color.fromCssColorString(ORBIT_HEX.HEO),
    }),
    []
  );

  const resetHighlight = (entity) => {
    if (!entity?.point) return;
    entity.point.pixelSize = DEFAULT_PIXEL_SIZE;
    entity.point.outlineWidth = 0;
  };

  const selectEntity = useCallback((entity) => {
    if (!entity?.satData) return;
    if (selectedEntityRef.current && selectedEntityRef.current !== entity) {
      resetHighlight(selectedEntityRef.current);
    }
    entity.point.pixelSize = SELECTED_PIXEL_SIZE;
    entity.point.outlineColor = Cesium.Color.WHITE;
    entity.point.outlineWidth = 2;
    selectedEntityRef.current = entity;
    selectedNoradIdRef.current = entity.satData.norad_id;
    setSelectedSatData(entity.satData);
    setSelectedLastUpdated(lastUpdatedRef.current);
  }, []);

  const clearSelection = useCallback(() => {
    if (selectedEntityRef.current) {
      resetHighlight(selectedEntityRef.current);
      selectedEntityRef.current = null;
    }
    selectedNoradIdRef.current = null;
    setSelectedSatData(null);
  }, []);

  const renderGlobal = useCallback(
    (viewer, sats) => {
      const time = Cesium.JulianDate.now();
      const retentionCutoff = Cesium.JulianDate.addSeconds(
        time,
        -SAMPLE_RETENTION_SECONDS,
        new Cesium.JulianDate()
      );
      const oldSamplesInterval = new Cesium.TimeInterval({
        start: Cesium.Iso8601.MINIMUM_VALUE,
        stop: retentionCutoff,
        isStartIncluded: true,
        isStopIncluded: false,
      });

      sats.forEach((sat) => {
        if (!sat?.orbit_type || sat.norad_id == null) return;

        let entity = entityMapRef.current.get(sat.norad_id);

        const position = Cesium.Cartesian3.fromDegrees(
          sat.lon,
          sat.lat,
          sat.alt_km * 1000
        );

        if (!entity) {
          // New satellite never seen before — the only case that creates
          // a Cesium entity. Every subsequent update for this name reuses
          // it (the `else` branch below), never recreated.
          const property = new Cesium.SampledPositionProperty();
          // SampledPositionProperty defaults forward/backward extrapolation
          // to NONE, meaning getValue() returns undefined (the entity
          // renders as nothing) for any clock time outside the sample
          // range. Since the render clock ticks continuously every frame
          // (viewer.clock.shouldAnimate = true) while samples only arrive
          // once per second from the backend, the entity would spend most
          // of each second past its last sample with no defined position
          // at all — this, not entity recreation, was the actual cause of
          // the once-a-second blink. HOLD renders the last known sample
          // instead of nothing until the next one arrives.
          property.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
          property.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
          property.addSample(time, position);
          const finalColor = ORBIT_COLORS[sat.orbit_type] || Cesium.Color.WHITE;

          entity = viewer.entities.add({
            position: property,
            point: {
              pixelSize: DEFAULT_PIXEL_SIZE,
              color: finalColor.withAlpha(0),
              outlineWidth: 0,
            },
          });
          entity.isSatellite = true;
          entity.satData = sat;

          fadeQueueRef.current.push({
            entity,
            start: performance.now(),
            color: finalColor,
          });

          entityMapRef.current.set(sat.norad_id, entity);
        } else {
          // Existing satellite — update position/metadata in place only.
          entity.position.addSample(time, position);
          entity.position.removeSamples(oldSamplesInterval);
          entity.satData = sat;
        }
      });
    },
    [ORBIT_COLORS]
  );

  // ---------------- Viewer init ----------------
  useEffect(() => {
    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      fullscreenButton: false,
      // Cesium defaults to fetching World Imagery from Cesium Ion, which
      // needs a token and a network round trip — that was the real cause
      // of the slow/dull-looking globe, not terrain (terrain was already
      // the lightweight default ellipsoid). We supply our own lightweight
      // imagery layer below instead.
      baseLayer: false,
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = true; // subtle day/night shading
    viewer.scene.fog.enabled = false;
    viewer.scene.skyAtmosphere.show = true;

    // Aspect-ratio-aware, always-centered default framing (see
    // computeCenteredGlobeView above) instead of a fixed heading/pitch/
    // roll tuned for one screen — a heading/pitch/roll orientation is
    // relative to the *local horizon at the destination point*, and any
    // pitch other than exactly -90° there does NOT point at Earth's
    // center, which is what was pushing the globe below viewport-center
    // (with empty space above) on the previous fixed framing. Supplying
    // an explicit direction/up instead guarantees the boresight passes
    // through the globe's center — an instant static "cinematic" default
    // rather than a flashy intro animation that would delay first paint.
    viewer.camera.setView(computeCenteredGlobeView(viewer));

    // Resizing the canvas only ever changes the frustum's aspect ratio —
    // Cesium never moves the camera or changes its direction on its own,
    // so the globe cannot "drift" off-center from a resize regardless of
    // what follows here. What resize CAN do is leave the initial framing
    // too tight/loose for the new aspect ratio (e.g. rotating a tablet
    // from landscape to portrait right after load), so this keeps the
    // comfortable fit current — but only until the user actually starts
    // navigating, tracked via camera.moveStart. Once they've manually
    // panned/zoomed, resize must never snap their view back to the
    // default framing.
    let hasUserNavigated = false;
    const stopTrackingDefaultFraming = () => {
      hasUserNavigated = true;
    };
    viewer.camera.moveStart.addEventListener(stopTrackingDefaultFraming);

    const onWindowResize = () => {
      if (hasUserNavigated) return;
      viewer.camera.setView(computeCenteredGlobeView(viewer));
    };
    window.addEventListener("resize", onWindowResize);

    // Mobile browsers frequently resize the *viewport* (the URL bar
    // sliding away after first paint, growing available height) without
    // ever firing a plain window 'resize' event — this is a well-known
    // gap, especially on Android Chrome/iOS Safari. When that happens,
    // Cesium's canvas is left sized against whatever the container's
    // dimensions were at mount and never catches up, which is what was
    // confining the whole globe to a small region at the top of the
    // screen with empty space below on phones. A ResizeObserver on the
    // actual container fires for that case too, since it tracks the
    // container's real box size rather than a window-level event —
    // explicitly resizing Cesium (its canvas doesn't auto-sync with CSS)
    // and re-centering the default framing for the new aspect ratio.
    const containerResizeObserver = new ResizeObserver(() => {
      if (viewer.isDestroyed()) return;
      viewer.resize();
      if (!hasUserNavigated) {
        viewer.camera.setView(computeCenteredGlobeView(viewer));
      }
    });
    containerResizeObserver.observe(containerRef.current);

    viewer.clock.shouldAnimate = true;
    addLatLonGrid(viewer);

    viewerRef.current = viewer;

    Cesium.SingleTileImageryProvider.fromUrl("/earth-blue-marble.jpg")
      .then((provider) => {
        if (viewerRef.current !== viewer) return; // unmounted mid-flight
        viewer.imageryLayers.addImageryProvider(provider);
        earthReadyRef.current = true;
        setLoadingStage("catalogue");
      })
      .catch(() => {
        // Don't get stuck on the loading screen if the texture fails —
        // fall back to the bare ellipsoid and continue.
        if (viewerRef.current !== viewer) return;
        earthReadyRef.current = true;
        setLoadingStage("catalogue");
      });

    // Drains the fade-in queue once per rendered frame. Purely imperative
    // Cesium/canvas work — never touches React state, so it costs nothing
    // in terms of re-renders regardless of how often it runs.
    const onPreRender = () => {
      if (!fadeQueueRef.current.length) return;
      const now = performance.now();
      fadeQueueRef.current = fadeQueueRef.current.filter(
        ({ entity, start, color }) => {
          const t = Math.min((now - start) / FADE_IN_MS, 1);
          if (entity.point) {
            entity.point.color = color.withAlpha(t);
          }
          return t < 1;
        }
      );
    };
    viewer.scene.preRender.addEventListener(onPreRender);

    // ---- Hover + click interaction ----
    const inputHandler = new Cesium.ScreenSpaceEventHandler(
      viewer.scene.canvas
    );

    inputHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.endPosition);
      const name = picked?.id?.isSatellite ? picked.id.satData.name : null;

      // The tooltip's screen position is updated directly on the DOM node
      // on every mouse-move — no React re-render for that, since it can
      // fire far more often than 1/sec while the mouse is moving. A React
      // state update only happens when the *hovered satellite itself*
      // changes (name in vs. out, or switching between two satellites),
      // which is what the visible tooltip text/badge actually depends on.
      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${movement.endPosition.x + 14}px`;
        tooltipRef.current.style.top = `${movement.endPosition.y + 14}px`;
        tooltipRef.current.style.display = name ? "block" : "none";
      }
      viewer.scene.canvas.style.cursor = name ? "pointer" : "default";

      if (name !== hoveredNameRef.current) {
        hoveredNameRef.current = name;
        setHoveredName(name);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    inputHandler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (picked && picked.id && picked.id.isSatellite) {
        selectEntity(picked.id);
      } else {
        clearSelection();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      viewer.scene.preRender.removeEventListener(onPreRender);
      viewer.camera.moveStart.removeEventListener(stopTrackingDefaultFraming);
      window.removeEventListener("resize", onWindowResize);
      containerResizeObserver.disconnect();
      inputHandler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [selectEntity, clearSelection]);

  // ---------------- WebSocket (through the gateway) ----------------
  useEffect(() => {
    // Relative to whatever origin this app is actually served from (the
    // integrated ARIES-SSA site in production, the Vite dev server's own
    // proxy in development — see vite.config.js) instead of a hardcoded
    // host/port, so the same build works wherever it's deployed.
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${wsProtocol}//${window.location.host}/visualizer-ws/global`
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const sats = Array.isArray(data.satellites) ? data.satellites : [];
      globalDataRef.current = sats;
      lastUpdatedRef.current = data.timestamp || null;

      if (!viewerRef.current || !earthReadyRef.current || !sats.length) return;

      // Every WS tick updates existing Cesium entities directly — no
      // React state, no component re-render, just the same incremental
      // addSample()/removeSamples() calls renderGlobal already made only
      // for genuinely new satellites.
      if (!hasRenderedOnceRef.current) {
        hasRenderedOnceRef.current = true;
        // Deferred into rAF callbacks (rather than synchronous here) so
        // the "preparing" stage is at least visible for one paint before
        // the — comparatively heavy, first-batch — entity creation runs.
        requestAnimationFrame(() => {
          setLoadingStage("preparing");
          requestAnimationFrame(() => {
            renderGlobal(viewerRef.current, sats);
            setLoadingStage(null);
          });
        });
      } else {
        renderGlobal(viewerRef.current, sats);
      }

      // Keep an open info panel's figures live — but this setState only
      // fires when a satellite is actually selected, so it costs nothing
      // the rest of the time.
      if (selectedNoradIdRef.current != null) {
        const updated = sats.find((s) => s.norad_id === selectedNoradIdRef.current);
        if (updated) {
          setSelectedSatData(updated);
          setSelectedLastUpdated(data.timestamp || null);
        }
      }
    };

    return () => ws.close();
  }, [renderGlobal]);

  const flyToSatellite = useCallback(
    (sat) => {
      const viewer = viewerRef.current;
      const entity = entityMapRef.current.get(sat.norad_id);
      if (!viewer || !entity) return;

      const viewDistanceM = Math.max(sat.alt_km * 3, 2000) * 1000;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          sat.lon,
          sat.lat,
          sat.alt_km * 1000 + viewDistanceM
        ),
        duration: 1.5,
      });
      selectEntity(entity);
    },
    [selectEntity]
  );

  // Computed on demand (query change / typing), not as a memo over the
  // full reactive catalogue — the catalogue isn't reactive state anymore,
  // and this way the 14k-item scan only ever runs when the user is
  // actually typing, not once a second regardless.
  const handleSatQueryChange = (value) => {
    setSatQuery(value);

    const q = value.trim().toLowerCase();
    if (!q) {
      setSatMatches([]);
      return;
    }

    const matches = globalDataRef.current
      .filter(
        (sat) =>
          sat.name?.toLowerCase().includes(q) ||
          String(sat.norad_id ?? "").includes(q)
      )
      .slice(0, 8);
    setSatMatches(matches);
  };

  const handleLocationSearch = (e) => {
    if (e.key !== "Enter") return;

    // Accepts "lat,lon". Altitude isn't collected from this field (the
    // backend/SkyRadarPage default to sea level when alt is absent from
    // the URL, so this stays backward compatible with old /radar links).
    const [lat, lon] = e.target.value.split(",").map(Number);
    if (isNaN(lat) || isNaN(lon)) return;

    navigate(`/radar?lat=${lat}&lon=${lon}`);
  };

  const handleSatelliteSelect = (sat) => {
    flyToSatellite(sat);
    setSatQuery("");
    setSatMatches([]);
  };

  return (
    // A single positioned frame — sized to sit below the site header and
    // above the footer strip — is the shared coordinate origin for the
    // canvas itself AND every overlay positioned within it (search
    // panels, tooltip, info panel). This matters beyond layout: Cesium's
    // mouse-event coordinates (movement.endPosition) are canvas-local, so
    // the hover tooltip below needs position:absolute within this same
    // frame (not position:fixed against the viewport) for its coordinates
    // to line up with the cursor — the canvas no longer starts at the
    // viewport's own origin now that it's below a fixed header.
    <div style={globeFrameStyle}>
      <div ref={containerRef} style={globeContainerStyle} />

      <LoadingOverlay stage={loadingStage} />

      <div className="sv-floating-panel" style={searchStackStyle}>
        <div className="sv-panel" style={searchGroupStyle}>
          <label style={searchLabelStyle}>Observer location</label>
          <input
            className="sv-input"
            placeholder="lat, lon"
            onKeyDown={handleLocationSearch}
          />
        </div>

        <div className="sv-panel" style={{ ...searchGroupStyle, position: "relative" }}>
          <label style={searchLabelStyle}>Find satellite</label>
          <input
            className="sv-input"
            placeholder="Name or NORAD ID"
            value={satQuery}
            onChange={(e) => handleSatQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && satMatches.length) {
                handleSatelliteSelect(satMatches[0]);
              }
            }}
          />
          {satMatches.length > 0 && (
            <ul className="sv-panel sv-scroll" style={suggestionListStyle}>
              {satMatches.map((sat) => (
                <li
                  key={sat.norad_id}
                  className="sv-row"
                  style={suggestionItemStyle}
                  onClick={() => handleSatelliteSelect(sat)}
                >
                  <span
                    className="sv-badge-dot"
                    style={{ color: ORBIT_HEX[sat.orbit_type] || "#fff" }}
                  />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {sat.name}
                  </span>
                  <span style={{ opacity: 0.5, fontSize: 11 }}>
                    {sat.norad_id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Always mounted; visibility and position are driven imperatively
          (see MOUSE_MOVE handler above) so cursor tracking never triggers
          a React re-render — display/left/top are deliberately absent
          from the React-managed style object below (starts hidden via
          the sv-tooltip CSS class instead) so React's re-render on a
          hoveredName change can never reconcile them back to a stale
          value and clobber the imperative position/visibility that was
          just set in the same mousemove event. Only the text content is
          React-driven, and only changes when the hovered satellite
          itself changes. */}
      <div
        ref={tooltipRef}
        className="sv-panel sv-tooltip"
        style={tooltipStyle}
      >
        {hoveredName}
      </div>

      {selectedSatData && (
        <div
          className="sv-floating-panel sv-mobile-bottom-sheet"
          style={infoPanelWrapStyle}
        >
          <SatelliteInfoPanel
            satellite={selectedSatData}
            lastUpdated={selectedLastUpdated}
            onClose={clearSelection}
          />
        </div>
      )}
    </div>
  );
}

const globeFrameStyle = {
  position: "fixed",
  top: "var(--header-height, 80px)",
  left: 0,
  right: 0,
  bottom: "var(--visualizer-footer-height, 32px)",
  overflow: "hidden",
};

const globeContainerStyle = {
  position: "absolute",
  inset: 0,
};

const searchStackStyle = {
  position: "absolute",
  top: 20,
  left: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  zIndex: 10,
  width: 260,
  maxWidth: "calc(100vw - 40px)",
};

const searchGroupStyle = {
  padding: "10px 12px",
};

const searchLabelStyle = {
  display: "block",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--sv-text-muted)",
  marginBottom: 6,
};

const suggestionListStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 6,
  padding: 6,
  listStyle: "none",
  maxHeight: 220,
  overflowY: "auto",
  zIndex: 11,
};

const suggestionItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  borderRadius: 6,
  fontSize: 12,
};

const tooltipStyle = {
  // left/top/display are deliberately absent — set only imperatively via
  // tooltipRef (see the JSX comment above) so React never manages them.
  // "absolute" (not "fixed") so it shares the same coordinate origin as
  // globeFrameStyle/the canvas — Cesium's movement.endPosition is
  // canvas-local, and the canvas no longer starts at the viewport's own
  // origin now that it sits below the fixed site header.
  position: "absolute",
  padding: "6px 10px",
  fontSize: 12,
  fontFamily: "var(--sv-font-mono)",
  pointerEvents: "none",
  zIndex: 30,
};

const infoPanelWrapStyle = {
  position: "absolute",
  top: 20,
  right: 20,
  zIndex: 20,
};
