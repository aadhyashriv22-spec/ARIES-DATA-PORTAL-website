const fs = require('fs');
const path = require('path');
const { LOCAL_STORAGE_ROOT } = require('../config/storage');
const { safeResolveInsideRoot } = require('../utils/safePath');

async function listFiles(relativePath = '') {
    const folderPath = safeResolveInsideRoot(LOCAL_STORAGE_ROOT, relativePath);
    const folderStats = await fs.promises.stat(folderPath);

    if (!folderStats.isDirectory()) {
        const error = new Error('Folder not found');
        error.status = 404;
        throw error;
    }

    const directoryEntries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const normalizedBasePath = String(relativePath || '').replace(/\\/g, '/').replace(/\/+$/, '');

    const files = await Promise.all(directoryEntries.map(async (entry) => {
        const entryPath = path.join(folderPath, entry.name);
        let size = null;

        if (!entry.isDirectory()) {
            const entryStats = await fs.promises.stat(entryPath);
            size = entryStats.size;
        }

        return {
            name: entry.name,
            mimeType: entry.isDirectory() ? 'application/vnd.google-apps.folder' : 'file',
            size,
            path: normalizedBasePath ? `${normalizedBasePath}/${entry.name}` : entry.name
        };
    }));

    return files;
}

async function getDownloadPath(relativePath) {
    const filePath = safeResolveInsideRoot(LOCAL_STORAGE_ROOT, relativePath);
    const fileStats = await fs.promises.stat(filePath);

    if (!fileStats.isFile()) {
        const error = new Error('File not found');
        error.status = 404;
        throw error;
    }

    return filePath;
}

module.exports = {
    listFiles,
    getDownloadPath
};
