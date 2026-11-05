const path = require('path');
const { google } = require('googleapis');

function requireEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

const serviceAccountFile = requireEnv('GOOGLE_SERVICE_ACCOUNT_FILE');
const resolvedServiceAccountFile = path.isAbsolute(serviceAccountFile)
    ? serviceAccountFile
    : path.resolve(__dirname, '..', serviceAccountFile);

const googleDriveAuth = new google.auth.GoogleAuth({
    keyFile: resolvedServiceAccountFile,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
});

module.exports = googleDriveAuth;
