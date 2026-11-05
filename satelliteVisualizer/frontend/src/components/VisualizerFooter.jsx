/**
 * A slim, fixed-bottom footer strip — reuses the site's own
 * .footer-bottom-inner text styling (from /css/landing.css) for the
 * copyright line, but not the full multi-column .site-footer, which
 * would force the page to scroll underneath an interactive fullscreen
 * globe/radar view. This keeps the site's branding present at the
 * bottom of every visualizer page without breaking that experience.
 */
export default function VisualizerFooter() {
  return (
    <footer style={footerStyle}>
      <div className="footer-bottom-inner" style={innerStyle}>
        <span className="copyright">
          &copy; 2026 Aryabhatta Research Institute of Observational Sciences. Restricted Access.
        </span>
      </div>
    </footer>
  );
}

const footerStyle = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  height: "var(--visualizer-footer-height)",
  borderTop: "1px solid var(--color-border, rgba(255,255,255,0.06))",
  background: "var(--color-bg-alt, #080d1a)",
  zIndex: 15,
};

const innerStyle = {
  height: "100%",
  maxWidth: "var(--max-width, 1200px)",
  margin: "0 auto",
  padding: "0 24px",
  display: "flex",
  alignItems: "center",
  fontSize: 11,
};
