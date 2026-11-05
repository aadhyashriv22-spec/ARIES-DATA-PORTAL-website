import * as Cesium from "cesium";
// Cesium's own runtime (web workers for tile decoding, default textures,
// widget assets) needs to load these from a real static path — the old
// '/node_modules/cesium/Build/Cesium' only ever worked under Vite's dev
// server, which can serve arbitrary node_modules paths directly; a
// production build has no node_modules in its output at all, so that
// path would 404 entirely once built. These assets are copied into
// public/cesium (see public/cesium/) so Vite bundles them into the
// build output, served at this path once mounted under /visualizer
// (matches vite.config.js's `base` and this app's basename).
window.CESIUM_BASE_URL = '/visualizer/cesium';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
