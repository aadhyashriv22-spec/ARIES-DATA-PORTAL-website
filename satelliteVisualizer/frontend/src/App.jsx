import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import GlobeViewer from "./components/GlobeViewer";
import SkyRadarPage from "./pages/SkyRadarPage";
import SiteHeader from "./components/SiteHeader";
import VisualizerFooter from "./components/VisualizerFooter";

function App() {
  return (
    // Mounted as a section of the main ARIES-SSA site at /visualizer, not
    // at the domain root — basename keeps every internal route
    // (here: "/" and "/radar") correctly prefixed to "/visualizer" and
    // "/visualizer/radar" so links, the browser's address bar, and
    // direct-navigation/refresh all agree with how the server actually
    // serves this app (see backend/server.js's SPA fallback).
    <Router basename="/visualizer">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<GlobeViewer />} />
        <Route path="/radar" element={<SkyRadarPage />} />
      </Routes>
      <VisualizerFooter />
    </Router>
  );
}

export default App;