const path = require('path');

function requireEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;   
}

const GOOGLE_DRIVE_ROOT_FOLDER_ID = requireEnv('GOOGLE_DRIVE_ROOT_FOLDER_ID');
const ONEDRIVE_USER_ID = requireEnv('ONEDRIVE_USER_ID');
const ONEDRIVE_ROOT_FOLDER = requireEnv('ONEDRIVE_ROOT_FOLDER');
const localStorageRootValue = requireEnv('LOCAL_STORAGE_ROOT');
const LOCAL_STORAGE_ROOT = path.resolve(
    path.isAbsolute(localStorageRootValue)
        ? localStorageRootValue
        : path.resolve(__dirname, '..', localStorageRootValue)
);

const nasStorageRootValue = requireEnv('NAS_STORAGE_ROOT');
const NAS_STORAGE_ROOT = path.resolve(
    path.isAbsolute(nasStorageRootValue)
        ? nasStorageRootValue
        : path.resolve(__dirname, '..', nasStorageRootValue)
);

// Mirror Nas: each organization sees only its own NAS share, mounted
// read-only as a subfolder of NAS_STORAGE_ROOT (see
// scripts/setup-nas-mounts.sh). An organization with no entry here gets an
// empty Mirror Nas -- never another organization's folder.
const NAS_ORGANIZATION_FOLDERS = Object.freeze({
    istrac: 'ISTRAC_DATA',
    irde: 'DRDO-IRDE'
});

// Organizations whose login sees the whole of Mirror Nas (every
// organization's folder above). Intentionally empty for now: partner
// organizations currently share the ARIES login, so ARIES must not see
// their data until each has its own password. Add 'aries' here then.
const NAS_FULL_ACCESS_ORGANIZATIONS = Object.freeze([]);

module.exports = {
    GOOGLE_DRIVE_ROOT_FOLDER_ID,
    ONEDRIVE_USER_ID,
    ONEDRIVE_ROOT_FOLDER,
    LOCAL_STORAGE_ROOT,
    NAS_STORAGE_ROOT,
    NAS_ORGANIZATION_FOLDERS,
    NAS_FULL_ACCESS_ORGANIZATIONS
};
