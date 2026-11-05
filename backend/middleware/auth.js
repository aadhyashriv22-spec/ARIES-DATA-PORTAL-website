const crypto = require('crypto');
const basicAuth = require('express-basic-auth');

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const SHARED_USERNAME = requireEnv('PORTAL_USERNAME');

const ORG_PASSWORDS = {
    aries: requireEnv('ARIES_PASSWORD'),
    bel: requireEnv('BEL_PASSWORD'),
    irde: requireEnv('IRDE_PASSWORD'),
    istrac: requireEnv('ISTRAC_PASSWORD')
};

const SESSION_COOKIE = 'portal_session';
const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 12; // 12 hours
const LOGIN_PATH = '/portal/login';

// Logged-in browsers, by session token. Held in memory, so restarting the
// server signs everyone out.
const sessions = new Map();

// The shared username plus an organization's password identifies that
// organization (each has its own password, and they are all distinct).
function findOrganization(username, password) {
    if (!basicAuth.safeCompare(String(username), SHARED_USERNAME)) return null;

    return Object.keys(ORG_PASSWORDS).find((orgKey) =>
        basicAuth.safeCompare(String(password), ORG_PASSWORDS[orgKey])
    ) || null;
}

function getSessionOrganization(req) {
    const token = req.cookies[SESSION_COOKIE];
    const session = sessions.get(token);

    if (!session) return null;

    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }

    return session.organization;
}

function removeExpiredSessions() {
    const now = Date.now();

    for (const [token, session] of sessions) {
        if (session.expiresAt <= now) sessions.delete(token);
    }
}

function getSessionCookieOptions(req) {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.get('x-forwarded-proto') === 'https'
    };
}

function getPortalPath(organization) {
    return organization ? `/portal/${organization}` : '/portal';
}

// The organization a /portal/<org> path belongs to, or null for anything else
// (including plain /portal), so a login can only ever land on a portal page.
function getOrganizationFromPath(portalPath) {
    const organization = String(portalPath || '').replace(/^\/portal\//, '');
    return Object.hasOwn(ORG_PASSWORDS, organization) ? organization : null;
}

function login(req, res) {
    const { username, password, next } = req.body || {};
    const requiredOrganization = getOrganizationFromPath(next);
    const portalPath = getPortalPath(requiredOrganization);
    const organization = findOrganization(username, password);

    // An organization's own link only accepts that organization's password.
    if (!organization || (requiredOrganization && organization !== requiredOrganization)) {
        return res.redirect(303, `${LOGIN_PATH}?error=1&next=${encodeURIComponent(portalPath)}`);
    }

    removeExpiredSessions();
    sessions.delete(req.cookies[SESSION_COOKIE]);

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { organization, expiresAt: Date.now() + SESSION_LIFETIME_MS });

    // No maxAge: the cookie also goes when the browser closes.
    res.cookie(SESSION_COOKIE, token, getSessionCookieOptions(req));
    return res.redirect(303, portalPath);
}

function signOut(req, res) {
    sessions.delete(req.cookies[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, getSessionCookieOptions(req));
    res.redirect(303, `${LOGIN_PATH}?signedOut=1`);
}

// Guards a portal page. Pass an organization for its own link, or nothing for
// plain /portal, which any organization's login may open.
function requirePortalLogin(requiredOrganization) {
    return (req, res, next) => {
        const organization = getSessionOrganization(req);

        if (organization && (!requiredOrganization || organization === requiredOrganization)) {
            return next();
        }

        const portalPath = encodeURIComponent(getPortalPath(requiredOrganization));
        return res.redirect(`${LOGIN_PATH}?next=${portalPath}`);
    };
}

function readBasicCredentials(req) {
    const match = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!match) return null;

    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;

    return {
        username: decoded.slice(0, separator),
        password: decoded.slice(separator + 1)
    };
}

// Scripts such as perf/netbench.py send Basic Auth. Browsers must use the login
// page: they send Sec-Fetch-Mode, and a browser may still be holding a login
// from the old popup, which must not get past sign-out.
function getScriptOrganization(req) {
    if (req.headers['sec-fetch-mode']) return null;

    const credentials = readBasicCredentials(req);
    return credentials ? findOrganization(credentials.username, credentials.password) : null;
}

// Guards the data routes (/gdrive, /onedrive, /local, /nas). Sets
// req.organization to 'aries' | 'bel' | 'irde' | 'istrac'.
function authCheck(req, res, next) {
    const organization = getSessionOrganization(req) || getScriptOrganization(req);

    if (!organization) {
        return res.status(401).json({ error: 'Please sign in again.' });
    }

    req.organization = organization;
    return next();
}

// ARIES-only routes. Must run after authCheck.
function requireAdmin(req, res, next) {
    if (req.organization !== 'aries') {
        return res.status(403).json({ message: 'Not available for your organization' });
    }

    return next();
}

module.exports = {
    authCheck,
    requireAdmin,
    login,
    signOut,
    requirePortalLogin
};
