import { ORBIT_BADGE_CLASS } from "../utils/orbitColors";
import { formatNumber, formatDateTime } from "../utils/formatters";

/**
 * Shared satellite detail panel — used by both the 3D globe view and the
 * radar page, so clicking a satellite in either place produces the same
 * information card instead of two parallel implementations.
 */
export default function SatelliteInfoPanel({ satellite, lastUpdated, onClose }) {
  if (!satellite) return null;

  const badgeClass = ORBIT_BADGE_CLASS[satellite.orbit_type] || "";

  const rows = [
    ["NORAD ID", satellite.norad_id ?? "—"],
    ["Orbit Type", satellite.orbit_type ?? "—"],
    ["Altitude", formatNumber(satellite.alt_km, 1, " km")],
    ["Latitude", formatNumber(satellite.lat, 4, "°")],
    ["Longitude", formatNumber(satellite.lon, 4, "°")],
    ["Inclination", formatNumber(satellite.inclination_deg, 2, "°")],
    ["Velocity", formatNumber(satellite.speed_km_s, 3, " km/s")],
    ["Epoch", formatDateTime(satellite.epoch)],
    ["Last Updated", formatDateTime(lastUpdated)],
  ];

  return (
    <div className="sv-panel sv-fade-in" style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={nameStyle} title={satellite.name}>
            {satellite.name}
          </div>
          {satellite.orbit_type && (
            <span className={`sv-badge ${badgeClass}`} style={{ marginTop: 6 }}>
              <span className="sv-badge-dot" />
              {satellite.orbit_type}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close satellite info panel"
          className="sv-icon-btn"
          style={{ flexShrink: 0 }}
        >
          ✕
        </button>
      </div>

      <dl style={gridStyle}>
        {rows.map(([label, value]) => (
          <div key={label} style={rowStyle}>
            <dt style={labelStyle}>{label}</dt>
            <dd style={valueStyle}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const panelStyle = {
  width: 320,
  maxWidth: "calc(100vw - 32px)",
  padding: "18px 20px",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
  paddingBottom: 14,
  borderBottom: "1px solid var(--sv-panel-border)",
};

const nameStyle = {
  fontFamily: "var(--sv-font-mono)",
  fontSize: "clamp(13px, 3.5vw, 15px)",
  fontWeight: 700,
  color: "#ffffff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 8,
  margin: 0,
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  fontSize: 13,
};

const labelStyle = {
  margin: 0,
  color: "var(--sv-text-muted)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};

const valueStyle = {
  margin: 0,
  fontFamily: "var(--sv-font-mono)",
  color: "var(--sv-text)",
  textAlign: "right",
};
