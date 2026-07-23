const { google } = require('googleapis');
const googleDriveAuth = require('../config/googleDrive');

let driveClientPromise;

async function getDriveClient() {
    if (!driveClientPromise) {
        driveClientPromise = googleDriveAuth.getClient().then((authClient) => {
            return google.drive({
                version: 'v3',
                auth: authClient
            });
        });
    }

    return driveClientPromise;
}

async function listFiles(folderId) {
    const drive = await getDriveClient();
    const response = await drive.files.list({
        q: `'${String(folderId).replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields: 'files(id,name,mimeType,size)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    return response.data.files || [];
}

async function streamDownload(fileId, response) {
    const drive = await getDriveClient();
    const metadata = await drive.files.get({
        fileId,
        fields: 'mimeType,name,size',
        supportsAllDrives: true
    });

    const fileName = metadata.data.name || fileId;
    const mimeType = metadata.data.mimeType || '';

    if (mimeType.startsWith('application/vnd.google-apps')) {
        const exportResponse = await drive.files.export(
            {
                fileId,
                mimeType: 'application/pdf'
            },
            {
                responseType: 'stream'
            }
        );

        response.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
        response.setHeader('Content-Type', 'application/pdf');
        exportResponse.data.pipe(response);
        return;
    }

    const downloadResponse = await drive.files.get(
        {
            fileId,
            alt: 'media',
            supportsAllDrives: true
        },
        {
            responseType: 'stream'
        }
    );

    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.setHeader('Content-Type', 'application/octet-stream');

    if (metadata.data.size) {
        response.setHeader('Content-Length', metadata.data.size);
    }

    downloadResponse.data.pipe(response);
}

module.exports = {
    getDriveClient,
    listFiles,
    streamDownload
};
