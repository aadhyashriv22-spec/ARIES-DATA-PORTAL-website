const path = require('path');

function decodeRepeatedly(value) {
    let current = value;

    for (let index = 0; index < 5; index += 1) {
        try {
            const decoded = decodeURIComponent(current);

            if (decoded === current) {
                break;
            }

            current = decoded;
        } catch (error) {
            break;
        }
    }

    return current;
}

function createPathError(message = 'Invalid path') {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function safeResolveInsideRoot(rootDirectory, requestedRelativePath = '') {
    const decodedPath = decodeRepeatedly(String(requestedRelativePath || '')).trim();

    if (!decodedPath || decodedPath === '.') {
        return rootDirectory;
    }

    if (decodedPath.includes('\0')) {
        throw createPathError();
    }

    const normalizedPath = decodedPath.replace(/\\/g, path.sep);

    if (path.isAbsolute(normalizedPath)) {
        throw createPathError();
    }

    const resolvedPath = path.resolve(rootDirectory, normalizedPath);
    const normalizedRoot = rootDirectory.endsWith(path.sep)
        ? rootDirectory
        : `${rootDirectory}${path.sep}`;

    if (resolvedPath !== rootDirectory && !resolvedPath.startsWith(normalizedRoot)) {
        throw createPathError();
    }

    return resolvedPath;
}

module.exports = {
    safeResolveInsideRoot
};
