const express = require('express');
const fs = require('fs');
const path = require('path');
const {
    listFiles,
    getDownloadPath
} = require('../services/nasStorageService');

const router = express.Router();

// File types safe to open directly in the browser tab from a file link.
// Everything else (notably HTML/SVG, which could run script on this
// origin) is always sent as a download instead.
const INLINE_VIEWABLE_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
    '.pdf', '.txt', '.csv', '.log', '.mp4', '.webm', '.mov'
]);

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// Both routes are scoped to req.organization (set by authCheck in
// server.js): every path is resolved inside that organization's own
// NAS folder only.
router.get('/list', asyncRoute(async (req, res) => {
    const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
    const files = await listFiles(req.organization, relativePath);
    res.json(files);
}));

router.get('/download', asyncRoute(async (req, res) => {
    const relativePath = typeof req.query.path === 'string' ? req.query.path : '';

    if (!relativePath) {
        const error = new Error('File path is required');
        error.status = 400;
        throw error;
    }

    const filePath = await getDownloadPath(req.organization, relativePath);
    const fileStats = await fs.promises.stat(filePath);
    const fileName = path.basename(filePath);
    const encodedName = encodeURIComponent(fileName);
    const viewInline = req.query.view === '1'
        && INLINE_VIEWABLE_EXTENSIONS.has(path.extname(fileName).toLowerCase());

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    if (viewInline) {
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
        return res.sendFile(filePath);
    }

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader('Content-Type', 'application/octet-stream');

    fs.createReadStream(filePath).pipe(res);
}));

module.exports = router;
