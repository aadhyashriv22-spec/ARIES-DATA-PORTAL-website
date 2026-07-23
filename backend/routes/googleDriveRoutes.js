const express = require('express');
const { listFiles, streamDownload } = require('../services/googleDriveService');

const router = express.Router();

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.get('/list/:folderId', asyncRoute(async (req, res) => {
    const { folderId } = req.params;

    if (!folderId) {
        const error = new Error('Folder ID is required');
        error.status = 400;
        throw error;
    }

    const files = await listFiles(folderId);
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
