require('dotenv').config({
    path: require('path').resolve(__dirname, '.env')
});

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { authCheck, login, signOut, requirePortalLogin } = require('./middleware/auth');
const teamAccessCheck = require('./middleware/teamAccess');
const errorHandler = require('./middleware/errorHandler');
const googleDriveRoutes = require('./routes/googleDriveRoutes');
const oneDriveRoutes = require('./routes/oneDriveRoutes');
const localStorageRoutes = require('./routes/localStorageRoutes');
const nasStorageRoutes = require('./routes/nasStorageRoutes');

const app = express();
const publicDirectory = path.resolve(__dirname, '..', 'public');
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDirectory, 'landing.html'));
});

function sendPortalPage(res) {
    res.sendFile(path.join(publicDirectory, 'index.html'), {
        cacheControl: false,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            Pragma: 'no-cache',
            Expires: '0'
        }
    });
}

app.get('/portal/login', (req, res) => {
    res.sendFile(path.join(publicDirectory, 'login.html'), {
        cacheControl: false,
        headers: { 'Cache-Control': 'no-store' }
    });
});

app.post('/portal/login', login);
app.post('/portal/sign-out', signOut);

app.get('/portal', requirePortalLogin(), (req, res) => {
    sendPortalPage(res);
});

app.get('/portal/aries', requirePortalLogin('aries'), (req, res) => {
    sendPortalPage(res);
});

app.get('/portal/bel', requirePortalLogin('bel'), (req, res) => {
    sendPortalPage(res);
});

app.get('/portal/irde', requirePortalLogin('irde'), (req, res) => {
    sendPortalPage(res);
});

app.get('/portal/istrac', requirePortalLogin('istrac'), (req, res) => {
    sendPortalPage(res);
});

// ---------------- Satellite Visualizer (integrated section) ----------------
// The visualizer remains its own React/Cesium app with its own build step,
// but is served as a native /visualizer section of this same site rather
// than a separate origin. Unlike /portal, this section is intentionally
// PUBLIC — no authCheck on any of the routes below — per product decision
// to make the visualizer open to any visitor while the rest of the site
// (the Access Portal and its data APIs) stays exactly as protected as
// before. Its data needs (REST + WebSocket) are reverse-proxied to the
// existing node_gateway process, which keeps doing exactly what it
// already did (proxying on to the FastAPI propagation service) — nothing
// about that pipeline is duplicated or reimplemented here, just fronted
// by this one public origin instead of being separately reachable.
const VISUALIZER_DIST = path.join(__dirname, '../satelliteVisualizer/frontend/dist');
const VISUALIZER_GATEWAY = 'http://127.0.0.1:4000';

const visualizerApiProxy = createProxyMiddleware({
    target: VISUALIZER_GATEWAY,
    changeOrigin: true,
    pathRewrite: { '^/visualizer-api': '' },
});
app.use('/visualizer-api', visualizerApiProxy);

const visualizerWsProxy = createProxyMiddleware({
    target: VISUALIZER_GATEWAY.replace('http://', 'ws://'),
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/visualizer-ws': '/ws' },
});
app.use('/visualizer-ws', visualizerWsProxy);

app.use('/visualizer', express.static(VISUALIZER_DIST));
// SPA fallback: any /visualizer path that isn't a real built file (e.g.
// /visualizer/radar, or /visualizer itself) serves the app shell so
// React Router can render the right page — must come after the static
// middleware above so real files (JS/CSS/Cesium assets) are still served
// as themselves, not overwritten by this fallback.
app.get(['/visualizer', '/visualizer/{*splat}'], (req, res) => {
    res.sendFile(path.join(VISUALIZER_DIST, 'index.html'));
});

// --- Team Workspace access gate ---------------------------------------
// Passcode check the frontend modal calls before redirecting into
// /team-workspace.html. Deliberately separate from /portal's authCheck.
// IMPORTANT: this route (and its guard below) must be registered BEFORE
// express.static, otherwise express.static would serve team-workspace.html
// straight from disk on any request and skip the check entirely.
app.post('/api/team-access', (req, res) => {
    const { passcode } = req.body;

    if (passcode && passcode === process.env.TEAM_ACCESS_PASSCODE) {
        res.cookie('team_access', 'granted', {
            httpOnly: true,
            signed: true,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 12 // 12 hours
        });
        return res.json({ ok: true });
    }

    return res.status(401).json({ ok: false, message: 'Incorrect passcode.' });
});

// The actual protected page — direct navigation without the cookie
// bounces back to /demonstration.html via teamAccessCheck.
app.get('/team-workspace.html', teamAccessCheck, (req, res) => {
    res.sendFile(path.join(publicDirectory, 'team-workspace.html'));
});

// Static file serving comes AFTER the guarded routes above, so those
// routes win for their specific paths. Everything else (css, js, other
// pages, images) still falls through to here as before.
app.use(express.static(publicDirectory, { index: false }));

app.use('/gdrive', authCheck, googleDriveRoutes);
app.use('/onedrive', authCheck, oneDriveRoutes);
app.use('/local', authCheck, localStorageRoutes);
app.use('/nas', authCheck, nasStorageRoutes);

app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
});

app.use(errorHandler);

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});

// http-proxy-middleware's WebSocket support hooks the underlying HTTP
// server's 'upgrade' event directly — unlike a normal GET/POST, an
// upgrade request never passes through Express's middleware pipeline at
// all. /visualizer-ws is a public route (see the visualizer section
// above), so this simply hands the upgrade straight to the proxy with no
// auth check — there is nothing here for authCheck-protected routes to
// hook into anyway, since none of them use WebSockets.
server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/visualizer-ws')) return;
    visualizerWsProxy.upgrade(req, socket, head);
});
