const basicAuth = require('express-basic-auth');

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const ORG_PASSWORDS = {
    aries: requireEnv('ARIES_PASSWORD'),
    bel: requireEnv('BEL_PASSWORD'),
    irde: requireEnv('IRDE_PASSWORD'),
    istrac: requireEnv('ISTRAC_PASSWORD')
};

// Shared check used by the data routes (/gdrive, /onedrive, /local) --
// any organization's password is accepted here, since the underlying
// data is the same for everyone.
function authorizerAny(username, password) {
    return Object.values(ORG_PASSWORDS).some((orgPassword) =>
        basicAuth.safeCompare(password, orgPassword)
    );
}

const authCheck = basicAuth({
    authorizer: authorizerAny,
    challenge: true,
    realm: 'ARIES SSA Data Portal',
    unauthorizedResponse: 'Authentication required'
});

// One middleware per organization's own front door. Each only accepts
// that organization's password -- ARIES's password will not open BEL's
// link, and so on. This is what makes the 4 links non-interchangeable
// even though they land on identical content.
function createOrgAuth(orgKey, realmLabel) {
    const expectedPassword = ORG_PASSWORDS[orgKey];
    return basicAuth({
        authorizer: (username, password) => basicAuth.safeCompare(password, expectedPassword),
        challenge: true,
        realm: realmLabel,
        unauthorizedResponse: 'Authentication required'
    });
}

module.exports = {
    authCheck,
    ariesAuth: createOrgAuth('aries', 'ARIES SSA Data Portal - ARIES'),
    belAuth: createOrgAuth('bel', 'ARIES SSA Data Portal - BEL'),
    irdeAuth: createOrgAuth('irde', 'ARIES SSA Data Portal - IRDE'),
    istracAuth: createOrgAuth('istrac', 'ARIES SSA Data Portal - ISTRAC')
};
