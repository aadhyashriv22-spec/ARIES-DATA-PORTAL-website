function errorHandler(err, req, res, next) {
    const status = Number(err.status || err.statusCode || 500);

    if (status >= 500) {
        console.error(err);
    } else {
        console.warn(`${status} - ${err.message || 'Request failed'} - ${req.method} ${req.originalUrl}`);
    }

    if (res.headersSent) {
        return next(err);
    }

    // A 503 is set on purpose (storage offline), so its message is safe to show.
    const message = status >= 500 && status !== 503 ? 'Internal server error' : err.message || 'Request failed';

    res.status(status).json({
        error: message
    });
}

module.exports = errorHandler;
