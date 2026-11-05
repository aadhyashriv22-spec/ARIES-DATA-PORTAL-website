import { ORBIT_BADGE_CLASS } from "../utils/orbitColors";
import { formatTimeOnly } from "../utils/formatters";

export default function SideBar({ satellites = [], selectedName, onSelect }) {
  if (!satellites.length) return null;

  const sorted = [...satellites]
    .filter((s) => typeof s.elevation === "number")
    .sort((a, b) => b.elevation - a.elevation)
    .slice(0, 30);

  return (
    <div className="sv-panel sv-scroll" style={panelStyle}>
      <div style={headerStyle}>
        Visible Satellites ({sorted.length})
      </div>

      <table style={tableStyle}>
        <thead>
          <tr style={headRow}>
            <th style={thLeft}>Name</th>
            <th style={thCenter}>Orbit</th>
            <th style={thCenter}>El°</th>
            <th style={thRight}>Status</th>
          </tr>
        </thead>

        <tbody>
          {sorted.map((sat) => {
            const badgeClass = ORBIT_BADGE_CLASS[sat.orbit_type] || "";
            const isSelected = sat.name === selectedName;

            return (
              <tr
                key={sat.name}
                className={`sv-row${isSelected ? " sv-row-selected" : ""}`}
                style={rowStyle}
                onClick={() => onSelect?.(sat)}
              >
                <td style={tdLeft}>
                  <span
                    className={`sv-badge-dot ${badgeClass}`}
                    style={{
                      color: badgeClass ? undefined : "#8ea1b8",
                      marginRight: 8,
                      display: "inline-block",
                    }}
                  />
                  <span style={nameTextStyle}>{sat.name}</span>
                </td>

                <td style={tdCenter}>
                  {sat.orbit_type && (
                    <span className={`sv-badge ${badgeClass}`}>
                      {sat.orbit_type}
                    </span>
                  )}
                </td>

                <td
                  style={{
                    ...tdCenter,
                    color: sat.elevation > 60 ? "#00ff99" : "#00e6d2",
                  }}
                >
                  {sat.elevation.toFixed(1)}
                </td>

                <td style={tdRight}>
                  <div style={statusPrimaryStyle}>Currently Visible</div>
                  <div style={statusSecondaryStyle}>
                    {sat.setTime
                      ? `Sets at ${formatTimeOnly(sat.setTime)}`
                      : "Set time unavailable"}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const panelStyle = {
  position: "absolute",
  top: 24,
  right: 24,
  padding: "16px 20px",
  fontSize: 13,
  minWidth: 340,
  maxHeight: "80vh",
  overflowY: "auto",
};

const headerStyle = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  opacity: 0.6,
  marginBottom: 12,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const headRow = {
  opacity: 0.5,
  fontSize: 11,
};

const rowStyle = {
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const thLeft = { textAlign: "left", paddingBottom: 6 };
const thCenter = { textAlign: "center", paddingBottom: 6 };
const thRight = { textAlign: "right", paddingBottom: 6 };

const tdLeft = { textAlign: "left", padding: "8px 4px", whiteSpace: "nowrap" };

const nameTextStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const tdCenter = {
  textAlign: "center",
  padding: "8px 4px",
  fontWeight: 500,
};

const tdRight = {
  textAlign: "right",
  padding: "8px 4px",
};

const statusPrimaryStyle = {
  color: "#7CFFC4",
  fontSize: 11,
  fontWeight: 600,
};

const statusSecondaryStyle = {
  opacity: 0.65,
  fontSize: 11,
  marginTop: 2,
};
