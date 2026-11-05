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

function usernameMatches(username) {
    return basicAuth.safeCompare(username, SHARED_USERNAME);
}

// Shared check used by the data routes (/gdrive, /onedrive, /local) --
// one shared username, plus any organization's password, since the
// underlying data is the same for everyone.
function authorizerAny(username, password) {
    if (!usernameMatches(username)) return false;

    return Object.values(ORG_PASSWORDS).some((orgPassword) =>
        basicAuth.safeCompare(password, orgPassword)
    );
}

const authCheck = basicAuth({
    authorizer: authorizerAny,
    challenge: true,
    realm: 'ARIES Observe',
    unauthorizedResponse: 'Authentication required'
});

// One middleware per organization's own front door. Same shared username
// everywhere, but each only accepts that organization's password --
// ARIES's password will not open BEL's link, and so on.
function createOrgAuth(orgKey, realmLabel) {
    const expectedPassword = ORG_PASSWORDS[orgKey];
    return basicAuth({
        authorizer: (username, password) =>
            usernameMatches(username) && basicAuth.safeCompare(password, expectedPassword),
        challenge: true,
        realm: realmLabel,
        unauthorizedResponse: 'Authentication required'
    });
}

// Identifies which organization an already-authenticated request belongs
// to, from the password it logged in with (each organization has its own,
// and they are all distinct). Must run after authCheck, which populates
// req.auth. Sets req.organization to 'aries' | 'bel' | 'irde' | 'istrac',
// or rejects -- used by mirror 4 (/nas), whose data is per-organization.
function identifyOrganization(req, res, next) {
    const password = req.auth && req.auth.password;
    const organization = password && Object.keys(ORG_PASSWORDS).find((orgKey) =>
        basicAuth.safeCompare(password, ORG_PASSWORDS[orgKey])
    );

    if (!organization) {
        return res.status(403).json({ message: 'Organization could not be determined' });
    }

    req.organization = organization;
    return next();
}

module.exports = {
    authCheck,
    identifyOrganization,
    ariesAuth: createOrgAuth('aries', 'ARIES Observe - ARIES'),
    belAuth: createOrgAuth('bel', 'ARIES Observe - BEL'),
    irdeAuth: createOrgAuth('irde', 'ARIES Observe - IRDE'),
    istracAuth: createOrgAuth('istrac', 'ARIES Observe - ISTRAC')
};