const fs = require('fs');
const path = require('path');
const { LOCAL_STORAGE_ROOT } = require('../config/storage');
const { safeResolveInsideRoot } = require('../utils/safePath');

function createError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function statInsideStorage(targetPath) {
    try {
        return await fs.promises.stat(targetPath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }

        if (!fs.existsSync(LOCAL_STORAGE_ROOT)) {
            throw createError('Mirror Local storage is currently unavailable', 503);
        }

        throw createError('File not found', 404);
    }
}

async function listFiles(relativePath = '') {
    const folderPath = safeResolveInsideRoot(LOCAL_STORAGE_ROOT, relativePath);
    const folderStats = await statInsideStorage(folderPath);

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
    const fileStats = await statInsideStorage(filePath);

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
