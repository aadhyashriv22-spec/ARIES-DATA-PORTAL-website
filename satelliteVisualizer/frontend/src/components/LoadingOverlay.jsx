const STAGE_LABELS = {
  earth: "Loading Earth…",
  catalogue: "Loading satellite catalogue…",
  preparing: "Preparing visualization…",
};

/**
 * Full-screen staged loading indicator. `stage` is one of the keys in
 * STAGE_LABELS, or null/undefined to hide it entirely. Kept as a simple
 * label swap rather than a progress bar since none of the three stages
 * have a meaningful "percent done" — a stage transition is the more
 * honest signal of what's actually happening.
 */
export default function LoadingOverlay({ stage }) {
  if (!stage) return null;

  const label = STAGE_LABELS[stage] || "Loading…";

  return (
    <div style={overlayStyle}>
      <div className="sv-panel" style={cardStyle}>
        <div className="sv-pulse" style={dotStyle} />
        <span style={textStyle}>{label}</span>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--sv-bg)",
  zIndex: 50,
  pointerEvents: "none",
};

const cardStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "16px 24px",
};

const dotStyle = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "var(--sv-accent)",
  boxShadow: "0 0 10px var(--sv-accent)",
  flexShrink: 0,
};

const textStyle = {
  fontFamily: "var(--sv-font-mono)",
  fontSize: 13,
  color: "var(--sv-text)",
  letterSpacing: "0.02em",
};
