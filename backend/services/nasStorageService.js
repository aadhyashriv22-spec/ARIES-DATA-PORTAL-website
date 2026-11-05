const fs = require('fs');
const path = require('path');
const {
    NAS_STORAGE_ROOT,
    NAS_ORGANIZATION_FOLDERS,
    NAS_FULL_ACCESS_ORGANIZATIONS
} = require('../config/storage');
const { safeResolveInsideRoot } = require('../utils/safePath');

function createError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

// The organization's own folder is the root of Mirror Nas for that login
// (or the whole of Mirror Nas for full-access organizations, i.e. ARIES).
// Returns null for an organization that has no NAS folder assigned.
function getOrganizationRoot(organization) {
    if (NAS_FULL_ACCESS_ORGANIZATIONS.includes(organization)) {
        return NAS_STORAGE_ROOT;
    }

    const folderName = NAS_ORGANIZATION_FOLDERS[organization];
    return folderName ? path.join(NAS_STORAGE_ROOT, folderName) : null;
}

// Paths are relative to NAS_STORAGE_ROOT (e.g. "DRDO-IRDE/Reports/a.pdf"),
// so each organization's folder name shows as the top level of Mirror Nas.
// safeResolveInsideRoot blocks ../ and absolute paths lexically; the
// realpath check below then requires the target to sit inside the
// organization's own folder, so neither a path nor a symlink can lead
// into another organization's data.
async function resolveInsideOrganization(organizationRoot, relativePath) {
    const requestedPath = safeResolveInsideRoot(NAS_STORAGE_ROOT, relativePath);
    let realRoot;
    let realPath;

    try {
        realRoot = await fs.promises.realpath(organizationRoot);
    } catch (error) {
        throw createError('Mirror Nas storage is currently unavailable', 503);
    }

    try {
        realPath = await fs.promises.realpath(requestedPath);
    } catch (error) {
        throw createError('File not found', 404);
    }

    if (realPath !== realRoot && !realPath.startsWith(`${realRoot}${path.sep}`)) {
        throw createError('Access denied', 403);
    }

    return realPath;
}

async function listFiles(organization, relativePath = '') {
    const organizationRoot = getOrganizationRoot(organization);

    if (!organizationRoot) {
        return [];
    }

    // Top level of Mirror Nas: just the organization's own folder, shown by
    // name even while it is still empty.
    const isTopLevel = !String(relativePath || '').replace(/[\\/]+/g, '').trim();
    if (isTopLevel && organizationRoot !== NAS_STORAGE_ROOT) {
        const folderName = path.basename(organizationRoot);
        return [{
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            size: null,
            path: folderName
        }];
    }

    const folderPath = await resolveInsideOrganization(organizationRoot, relativePath);
    const folderStats = await fs.promises.stat(folderPath);

    if (!folderStats.isDirectory()) {
        throw createError('Folder not found', 404);
    }

    const directoryEntries = (await fs.promises.readdir(folderPath, { withFileTypes: true }))
    .filter((entry) => !entry.name.startsWith('@') && !entry.name.startsWith('.'));
    const normalizedBasePath = String(relativePath || '').replace(/\\/g, '/').replace(/\/+$/, '');

    const realRoot = await fs.promises.realpath(organizationRoot);

    const files = await Promise.all(directoryEntries.map(async (entry) => {
        const entryPath = path.join(folderPath, entry.name);
        let entryStats;

        try {
            // Hide (not just block) links that point outside this
            // organization's folder, so their names aren't listed either.
            const realEntryPath = await fs.promises.realpath(entryPath);
            if (!realEntryPath.startsWith(`${realRoot}${path.sep}`)) {
                return null;
            }
            entryStats = await fs.promises.stat(realEntryPath);
        } catch (error) {
            return null;
        }

        return {
            name: entry.name,
            mimeType: entryStats.isDirectory() ? 'application/vnd.google-apps.folder' : 'file',
            size: entryStats.isDirectory() ? null : entryStats.size,
            path: normalizedBasePath ? `${normalizedBasePath}/${entry.name}` : entry.name
        };
    }));

    return files.filter(Boolean);
}

async function getDownloadPath(organization, relativePath) {
    const organizationRoot = getOrganizationRoot(organization);

    if (!organizationRoot) {
        throw createError('File not found', 404);
    }

    const filePath = await resolveInsideOrganization(organizationRoot, relativePath);
    const fileStats = await fs.promises.stat(filePath);

    if (!fileStats.isFile()) {
        throw createError('File not found', 404);
    }

    return filePath;
}

module.exports = {
    listFiles,
    getDownloadPath
};
