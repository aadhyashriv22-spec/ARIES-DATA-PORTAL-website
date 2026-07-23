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

module.exports = {
    GOOGLE_DRIVE_ROOT_FOLDER_ID,
    ONEDRIVE_USER_ID,
    ONEDRIVE_ROOT_FOLDER,
    LOCAL_STORAGE_ROOT
};
