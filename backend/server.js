require('dotenv').config({
    path: require('path').resolve(__dirname, '.env')
});

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authCheck = require('./middleware/auth');
const teamAccessCheck = require('./middleware/teamAccess');
const errorHandler = require('./middleware/errorHandler');
const googleDriveRoutes = require('./routes/googleDriveRoutes');
const oneDriveRoutes = require('./routes/oneDriveRoutes');
const localStorageRoutes = require('./routes/localStorageRoutes');

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

app.get('/portal', authCheck, (req, res) => {
    res.sendFile(path.join(publicDirectory, 'index.html'), {
        cacheControl: false,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            Pragma: 'no-cache',
            Expires: '0'
        }
    });
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

// Static file serving comes AFTER the guarded route above, so that
// route wins for /team-workspace.html specifically. Everything else
// (css, js, other pages, images) still falls through to here as before.
app.use(express.static(publicDirectory, { index: false }));

app.use('/gdrive', authCheck, googleDriveRoutes);
app.use('/onedrive', authCheck, oneDriveRoutes);
app.use('/local', authCheck, localStorageRoutes);

app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
});

app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});