require('dotenv').config({
    path: require('path').resolve(__dirname, '.env')
});

const path = require('path');
const express = require('express');
const cors = require('cors');
const authCheck = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const googleDriveRoutes = require('./routes/googleDriveRoutes');
const oneDriveRoutes = require('./routes/oneDriveRoutes');
const localStorageRoutes = require('./routes/localStorageRoutes');

const app = express();
const publicDirectory = path.resolve(__dirname, '..', 'public');
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDirectory, { index: false }));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDirectory, 'landing.html'));
});

app.get('/portal', authCheck, (req, res) => {
    res.sendFile(path.join(publicDirectory, 'index.html'), {
        cacheControl: false,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            Pragma: 'no-cache',
            Expires: '0'
        }
    });
});

app.use('/gdrive', authCheck, googleDriveRoutes);
app.use('/onedrive', authCheck, oneDriveRoutes);
app.use('/local', authCheck, localStorageRoutes);

app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
});

app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
