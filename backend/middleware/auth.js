const basicAuth = require('express-basic-auth');

function requireEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

const username = requireEnv('PORTAL_USERNAME');
const password = requireEnv('PORTAL_PASSWORD');

const authCheck = basicAuth({
    users: {
        [username]: password
    },
    challenge: true,
    realm: 'ARIES SSA Data Portal',
    unauthorizedResponse: 'Authentication required'
});

module.exports = authCheck;
