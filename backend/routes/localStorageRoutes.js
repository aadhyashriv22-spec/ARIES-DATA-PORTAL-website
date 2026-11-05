const express = require('express');
const fs = require('fs');
const path = require('path');
const {
    listFiles,
    getDownloadPath
} = require('../services/localStorageService');

const router = express.Router();

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.get('/list', asyncRoute(async (req, res) => {
    const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
    const files = await listFiles(relativePath);
    res.json(files);
}));

router.get('/download', asyncRoute(async (req, res) => {
    const relativePath = typeof req.query.path === 'string' ? req.query.path : '';

    if (!relativePath) {
        const error = new Error('File path is required');
        error.status = 400;
        throw error;
    }

    const filePath = await getDownloadPath(relativePath);
    const fileStats = await fs.promises.stat(filePath);

    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader('Content-Type', 'application/octet-stream');

    fs.createReadStream(filePath).pipe(res);
}));

module.exports = router;
