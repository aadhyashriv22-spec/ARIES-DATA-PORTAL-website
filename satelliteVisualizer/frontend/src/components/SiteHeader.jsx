import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Replicates the ARIES-SSA site's header + slide-out navigation drawer
 * (markup/classes from public/landing.html, styled by /css/landing.css
 * which this app loads on its own index.html) rather than building a
 * second, visually-inconsistent nav for this one page — same brand mark,
 * same desktop nav, same mobile hamburger drawer, just implemented with
 * React state instead of the site's vanilla-JS drawer controller.
 */
export default function SiteHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the drawer whenever internal navigation happens elsewhere in
  // the app (e.g. the globe's observer-location search calling
  // navigate("/radar?...")) — adjusted during render (React's documented
  // pattern for "reset state when a prop changes") rather than in an
  // effect, since an effect would commit one extra render with the
  // drawer still open before closing it on the next tick.
  const [lastPathname, setLastPathname] = useState(location.pathname);
  if (location.pathname !== lastPathname) {
    setLastPathname(location.pathname);
    setDrawerOpen(false);
  }

  // Matches landing.js's behavior: lock background scroll while the
  // drawer is open, and let Escape close it.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";

    if (!drawerOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <>
      <header className="site-header scrolled">
        <div className="header-inner">
          <div className="header-left">
            <button
              id="hamburger-btn"
              className="hamburger-btn"
              aria-label="Open navigation drawer"
              aria-expanded={drawerOpen}
              aria-controls="nav-drawer"
              onClick={() => setDrawerOpen(true)}
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
            <a href="/" className="brand" style={{ textDecoration: "none" }}>
              <img className="brand-logo-mark" src="/assets/brand/aries-observe-emblem.svg" alt="" aria-hidden="true" />
              <div className="brand-text">
                <span className="brand-name">ARIES</span>
                <span className="brand-subtitle">Observe</span>
              </div>
            </a>
          </div>

          <div className="header-menu">
              <nav className="desktop-nav" aria-label="Desktop Primary">
                <ul>
                  <li><a href="/#main-content">Home</a></li>
                  <li><a href="/#about">About</a></li>
                  <li><a href="/demonstration.html">Demonstration</a></li>
                  <li><a href="/team.html">Team</a></li>
                  <li><a href="/collaborators.html">Collaborators</a></li>
                  <li>
                    <a href="/visualizer" className="active" aria-current="page">
                      Satellite Visualizer
                    </a>
                  </li>
                  <li><a href="/#access">Data Access</a></li>
                  <li><a href="/#contact">Contact</a></li>
                </ul>
              </nav>

              <div className="header-actions">
                <a className="btn-portal-access" href="/portal">Access Portal</a>
              </div>
          </div>
        </div>
      </header>

      <div
        className={`drawer-overlay${drawerOpen ? " visible" : ""}`}
        aria-hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
      ></div>
      <nav
        id="nav-drawer"
        className={`nav-drawer${drawerOpen ? " open" : ""}`}
        aria-label="Main Navigation Drawer"
        aria-hidden={!drawerOpen}
      >
        <div className="drawer-header">
          <div className="drawer-brand">
            <img className="brand-logo-mark" src="/assets/brand/aries-observe-emblem.svg" alt="" aria-hidden="true" />
            <div>
              <h3>ARIES Observe</h3>
              <p>Observational Data Repository</p>
            </div>
          </div>
          <button
            className="close-drawer-btn"
            aria-label="Close navigation drawer"
            onClick={() => setDrawerOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="drawer-content">
          <div className="drawer-meta-info">
            <h4>Space Situational Awareness</h4>
            <p>Government Scientific Research Infrastructure</p>
          </div>

          <div className="drawer-groups">
            <div className="drawer-group">
              <h5>Home</h5>
              <ul>
                <li><a href="/#main-content">Portal Home</a></li>
              </ul>
            </div>

            <div className="drawer-group">
              <h5>Data Repository</h5>
              <ul>
                <li>
                  <a href="/visualizer" className="active">
                    Satellite Visualizer
                  </a>
                </li>
                <li><a href="/portal">Optical Tracking Data</a></li>
                <li><a href="/portal">Downloads</a></li>
              </ul>
            </div>

            <div className="drawer-group">
              <h5>Team &amp; Demonstration</h5>
              <ul>
                <li><a href="/team.html">Project Members</a></li>
                <li><a href="/collaborators.html">Collaborators</a></li>
                <li><a href="/demonstration.html">Optical Tracking Demo</a></li>
              </ul>
            </div>

            <div className="drawer-group">
              <h5>Contact</h5>
              <ul>
                <li><a href="/#contact">Contact ARIES</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <a className="btn-drawer-action primary" href="/portal">Access Data Portal</a>
          <a className="btn-drawer-action secondary" href="/#contact">Request Research Access</a>
        </div>
      </nav>
    </>
  );
}
