import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mounted as a native section of the ARIES-SSA site at /visualizer rather
// than served from its own origin — base must match that mount point so
// built asset URLs (JS/CSS/the copied Cesium static assets under
// public/cesium) resolve correctly once served from there.
const BASE_PATH = '/visualizer/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  server: {
    // In dev (`npm run dev`), proxy the same relative paths the app uses
    // in production straight to the existing node_gateway, so the app
    // doesn't need the full integrated backend running locally just to
    // develop against live data. In production this same proxying is
    // done by backend/server.js instead (see backend/server.js).
    proxy: {
      '/visualizer-api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/visualizer-api/, ''),
      },
      '/visualizer-ws': {
        target: 'ws://127.0.0.1:4000',
        ws: true,
        rewrite: (path) => path.replace(/^\/visualizer-ws/, '/ws'),
      },
    },
  },
});
