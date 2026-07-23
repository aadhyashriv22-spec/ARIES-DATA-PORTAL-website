const axios = require('axios');
const {
    ONEDRIVE_USER_ID,
    ONEDRIVE_ROOT_FOLDER
} = require('../config/storage');

const graphClient = axios.create({
    baseURL: 'https://graph.microsoft.com/v1.0',
    timeout: 20000
});

const tokenClient = axios.create({
    timeout: 20000
});

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function requireEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

function getAuthHeaders(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`
    };
}

async function getAccessToken() {
    const tenantId = requireEnv('TENANT_ID');
    const clientId = requireEnv('CLIENT_ID');
    const clientSecret = requireEnv('CLIENT_SECRET');

    if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60000) {
        return cachedAccessToken;
    }

    const tokenResponse = await tokenClient.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials'
        }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    cachedAccessToken = tokenResponse.data.access_token;
    cachedAccessTokenExpiresAt = Date.now() + ((tokenResponse.data.expires_in || 3599) * 1000);

    return cachedAccessToken;
}

async function listUsers() {
    const accessToken = await getAccessToken();
    const response = await graphClient.get('/users', {
        headers: getAuthHeaders(accessToken)
    });

    return (response.data.value || []).map((user) => ({
        id: user.id,
        displayName: user.displayName,
        userPrincipalName: user.userPrincipalName
    }));
}

async function listRootFiles() {
    const accessToken = await getAccessToken();
    const response = await graphClient.get(
        `/users/${encodeURIComponent(ONEDRIVE_USER_ID)}/drive/root:/${encodeURIComponent(ONEDRIVE_ROOT_FOLDER)}:/children`,
        {
            headers: getAuthHeaders(accessToken)
        }
    );

    return (response.data.value || []).map(mapGraphItem);
}

async function listFolderFiles(itemId) {
    const accessToken = await getAccessToken();
    const response = await graphClient.get(
        `/users/${encodeURIComponent(ONEDRIVE_USER_ID)}/drive/items/${encodeURIComponent(itemId)}/children`,
        {
            headers: getAuthHeaders(accessToken)
        }
    );

    return (response.data.value || []).map(mapGraphItem);
}

async function streamDownload(itemId, response) {
    const accessToken = await getAccessToken();
    const metadataResponse = await graphClient.get(
        `/users/${encodeURIComponent(ONEDRIVE_USER_ID)}/drive/items/${encodeURIComponent(itemId)}`,
        {
            headers: getAuthHeaders(accessToken)
        }
    );

    const fileName = metadataResponse.data.name || itemId;
    const downloadResponse = await graphClient.get(
        `/users/${encodeURIComponent(ONEDRIVE_USER_ID)}/drive/items/${encodeURIComponent(itemId)}/content`,
        {
            headers: getAuthHeaders(accessToken),
            responseType: 'stream'
        }
    );

    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.setHeader('Content-Type', 'application/octet-stream');
    downloadResponse.data.pipe(response);
}

function mapGraphItem(item) {
    return {
        id: item.id,
        name: item.name,
        mimeType: item.folder ? 'application/vnd.google-apps.folder' : 'file',
        size: item.size ?? null
    };
}

module.exports = {
    getAccessToken,
    listUsers,
    listRootFiles,
    listFolderFiles,
    streamDownload
};
