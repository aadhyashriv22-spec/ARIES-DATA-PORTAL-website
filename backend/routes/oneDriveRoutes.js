const express = require('express');
const {
    listUsers,
    listRootFiles,
    listFolderFiles,
    streamDownload
} = require('../services/oneDriveService');

const router = express.Router();

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.get('/debug', asyncRoute(async (req, res) => {
    const users = await listUsers();
    res.json(users);
}));

router.get('/list/root', asyncRoute(async (req, res) => {
    const files = await listRootFiles();
    res.json(files);
}));

router.get('/list/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        const error = new Error('Folder ID is required');
        error.status = 400;
        throw error;
    }

    const files = await listFolderFiles(id);
    res.json(files);
}));

router.get('/download/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        const error = new Error('File ID is required');
        error.status = 400;
        throw error;
    }

    await streamDownload(id, res);
}));

module.exports = router;
