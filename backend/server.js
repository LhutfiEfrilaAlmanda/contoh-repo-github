const express = require('express');
const path = require('path');
require('dotenv').config();
const { initDB } = require('./database.js');
const { deleteHandler } = require('./utils/helpers.js');

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
});

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json());
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// --- STATIC FILES ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public/regulations', express.static(path.join(__dirname, 'regulations')));
app.use('/public/reports', express.static(path.join(__dirname, 'reports')));

// --- DIAGNOSTICS ---
app.get('/api/health-check', (req, res) => res.json({ status: 'ok', serverTime: new Date().toISOString() }));
app.get('/api/debug-routes', (req, res) => {
    const routes = app._router.stack
        .filter(r => r.route)
        .map(r => ({ path: r.route.path, methods: Object.keys(r.route.methods) }));
    res.json(routes);
});

// --- ROUTES (MODULAR) ---
const authRoutes = require('./routes/authRoutes.js');
const sdgRoutes = require('./routes/sdgRoutes.js');
const programRoutes = require('./routes/programRoutes.js');
const partnerRoutes = require('./routes/partnerRoutes.js');
const utilityRoutes = require('./routes/utilityRoutes.js');
const chatRoutes = require('./routes/chatRoutes.js');

app.use('/api', authRoutes);
app.use('/api', sdgRoutes);
app.use('/api', programRoutes);
app.use('/api', partnerRoutes);
app.use('/api', utilityRoutes);
app.use('/api', chatRoutes);

// Shared Delete Handler (Keep in server for compatibility with getHandler/deleteHandler logic)
app.delete('/api/programs/:id', deleteHandler('kelola_program'));
app.delete('/api/partners/:id', deleteHandler('direktori_mitra_csr'));
app.delete('/api/regulations/:id', deleteHandler('regulasi'));
app.delete('/api/users/:id', deleteHandler('pengguna'));
app.delete('/api/submissions/:id', deleteHandler('kontribusi_mitra_csr'));
app.delete('/api/fiscal-years/:id', deleteHandler('tahun_fiskal'));
app.delete('/api/categories/:id', deleteHandler('kelompok_program', 'name'));
app.delete('/api/sectors/:id', deleteHandler('sektor_industri', 'name'));
app.delete('/api/locations/:id', deleteHandler('wilayah_kerja', 'name'));
app.delete('/api/roles/:id', deleteHandler('peran_sistem'));

// --- ROOT & ERROR HANDLING ---
app.get('/', (req, res) => {
    res.send('<h1>Server Backend PORTAL CSR Aktif (Modular)</h1><p>Akses aplikasi di port 5173.</p>');
});

app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack);
    if (!res.headersSent) res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

// --- START SERVER ---
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server modular berjalan di http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('CRITICAL: Database initialization failed:', err);
    process.exit(1);
});
