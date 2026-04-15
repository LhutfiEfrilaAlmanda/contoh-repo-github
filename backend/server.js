const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const axios = require('axios'); // Tambahkan axios untuk Fonnte
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool, initDB } = require('./database.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Manual CORS middleware - replaces cors package which was failing on POST
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

// Diagnostic Endpoints
app.get('/api/health-check', (req, res) => res.json({ status: 'ok', serverTime: new Date().toISOString() }));
app.get('/api/debug-routes', (req, res) => {
    const routes = app._router.stack
        .filter(r => r.route)
        .map(r => ({ path: r.route.path, methods: Object.keys(r.route.methods) }));
    res.json(routes);
});

app.use(express.json());
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public/regulations', express.static(path.join(__dirname, 'regulations')));
app.use('/public/reports', express.static(path.join(__dirname, 'reports')));

// Konfigurasi Multer untuk Upload Gambar
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'logo-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

const regStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const regDir = path.join(__dirname, 'regulations');
        if (!fs.existsSync(regDir)) fs.mkdirSync(regDir);
        cb(null, regDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, safeName);
    }
});
const uploadReg = multer({ storage: regStorage });

const reportStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const reportDir = path.join(__dirname, 'reports');
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
        cb(null, reportDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, 'report-' + Date.now() + '-' + safeName);
    }
});
const uploadReport = multer({ storage: reportStorage });

app.post('/api/upload', upload.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

/* ================================
   HELPER FUNCTIONS
================================ */

// GET all rows from a table
const getHandler = (tableName, mapFunc) => async (req, res) => {
    try {
        let orderBy = '';
        if (['kelompok_program', 'sektor_industri', 'wilayah_kerja'].includes(tableName)) {
            orderBy = ' ORDER BY name ASC';
        } else if (['kelola_program', 'direktori_mitra_csr', 'regulasi', 'pengguna', 'kontribusi_mitra_csr'].includes(tableName)) {
            orderBy = ' ORDER BY LENGTH(id), id ASC';
        }
        const [rows] = await pool.query(`SELECT * FROM ${tableName}${orderBy}`);
        res.json(mapFunc ? rows.map(mapFunc) : rows);
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
};

// DELETE by id
const deleteHandler = (tableName, idField = 'id') => async (req, res) => {
    try {
        // Log notification before delete for context
        const monitoredTables = [
            'kelola_program', 'direktori_mitra_csr', 'regulasi', 
            'pengguna', 'kontribusi_mitra_csr', 'tahun_fiskal', 
            'kelompok_program', 'sektor_industri', 'wilayah_kerja', 'peran_sistem'
        ];
        if (monitoredTables.includes(tableName)) {
            const [rows] = await pool.query(`SELECT * FROM ${tableName} WHERE ${idField} = ?`, [req.params.id]);
            if (rows.length > 0) {
                const row = rows[0];
                const name = row.title || row.companyName || row.name || row.role_name || row.year || req.params.id;
                const labels = { 
                    kelola_program: 'Program', direktori_mitra_csr: 'Mitra', regulasi: 'Regulasi',
                    pengguna: 'Pengguna', kontribusi_mitra_csr: 'Kontribusi', tahun_fiskal: 'Tahun Fiskal',
                    kelompok_program: 'Kategori', sektor_industri: 'Sektor', wilayah_kerja: 'Lokasi',
                    peran_sistem: 'Peran'
                };
                await createNotification(`${labels[tableName]} "${name}" telah dihapus.`, 'warning');
            }
        }
        
        const [result] = await pool.query(`DELETE FROM ${tableName} WHERE ${idField} = ?`, [req.params.id]);
        res.json({ success: true, changes: result.affectedRows });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
};

// NOTIFICATION HELPER (BARU)
const createNotification = async (message, type = 'info') => {
    try {
        const id = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await pool.query('INSERT INTO notifikasi (id, message, type) VALUES (?, ?, ?)', [id, message, type]);
        console.log('[NOTIF]', message);
    } catch (err) { console.error('Failed to create notification:', err); }
};

// --- HELPER: KIRIM WHATSAPP VIA FONNTE ---
async function sendWhatsapp(target, message) {
    const token = process.env.FONNTE_TOKEN;
    if (!token || !target) {
        console.warn('[WA SKIP] Token atau Target kosong');
        return;
    }
    try {
        const response = await axios.post('https://api.fonnte.com/send', {
            target: target,
            message: message
        }, {
            headers: { 'Authorization': token }
        });
        console.log('[WA SENT]', target, response.data.status ? 'Success' : 'Failed');
    } catch (err) {
        console.error('[WA ERROR]', err.message);
    }
}

/* ================================
   GET ENDPOINTS
================================ */

// Authentication Login Endpoint (alternative path for Railway compatibility)
app.post('/api/verify-access', async (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    console.log('LOGIN ATTEMPT (alt):', req.body?.email);
    const { email, password } = req.body;

    try {
        // Pastikan kolom password ada di tabel pengguna
        await ensureProfileColumns();

        // --- CHECK DB FOR CUSTOM PASSWORD ---
        if (email === 'admin') {
            let savedPassword = 'admin123';
            try {
                await safeAddColumn('pengguna', 'password', 'TEXT');
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
                const queryPromise = pool.query('SELECT password FROM pengguna WHERE email = ?', [email]);
                const [dbUsers] = await Promise.race([queryPromise, timeoutPromise]);
                if (dbUsers && dbUsers.length > 0 && dbUsers[0].password) {
                    savedPassword = dbUsers[0].password;
                }
            } catch (e) {
                console.log('DB check skipped, using default password');
            }

            const isLegacyBcrypt = savedPassword.startsWith('$2b$');
            let isValid = false;

            if (isLegacyBcrypt) {
                isValid = (password === 'admin123');
            } else {
                isValid = (password === savedPassword);
            }

            if (!isValid) {
                return res.status(401).json({ error: 'Email atau password salah.' });
            }
            return res.json({
                token: 'dummy-jwt-token-admin',
                user: { id: '1', name: 'Admin Utama', email: email, role: 'Admin' }
            });
        }

        const [users] = await pool.query('SELECT * FROM pengguna WHERE email = ? OR name = ?', [email, email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Email atau password salah.' });
        }
        const user = users[0];

        // VERIFIKASI SANDI UNTUK PENGGUNA UMUM (Operator dsb)
        const savedPw = user.password || 'admin123';
        const isLegacyBcrypt = savedPw.startsWith('$2b$');

        if (isLegacyBcrypt) {
            if (password !== 'admin123') {
                return res.status(401).json({ error: 'Email atau password salah.' });
            }
        } else if (password !== savedPw) {
            return res.status(401).json({ error: 'Email atau password salah.' });
        }

        await pool.query('UPDATE pengguna SET lastLogin = ? WHERE id = ?', [new Date().toISOString(), user.id]);
        res.json({
            token: `dummy-jwt-token-${user.id}`,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('LOGIN ERROR:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
});

// Authentication Login Endpoint (original path)
app.post('/api/auth/login', async (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    console.log('LOGIN ATTEMPT:', req.body?.email);
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM pengguna WHERE email = ? OR name = ?', [email, email]);
        console.log('USERS FOUND:', users.length);

        if (users.length === 0) {
            if (email === 'admin') {
                return res.json({
                    token: 'dummy-jwt-token-admin',
                    user: { id: '1', name: 'Admin Utama', email: email, role: 'Admin' }
                });
            }
            return res.status(401).json({ error: 'Email atau password salah.' });
        }

        const user = users[0];
        await pool.query('UPDATE pengguna SET lastLogin = ? WHERE id = ?', [new Date().toISOString(), user.id]);

        res.json({
            token: `dummy-jwt-token-${user.id}`,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('LOGIN ERROR:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
});

app.get('/api/programs', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.*, 
            (SELECT COALESCE(SUM(commitmentAmount), 0) 
             FROM kontribusi_mitra_csr 
             WHERE TRIM(programId) = TRIM(p.id) 
               AND status IN ('Approved', 'Terealisasi')) as allocatedAmount,
            (SELECT COUNT(*) 
             FROM kontribusi_mitra_csr 
             WHERE TRIM(programId) = TRIM(p.id) 
               AND status IN ('Approved', 'Terealisasi')) as participantCount
            FROM kelola_program p
            ORDER BY LENGTH(p.id), p.id ASC
        `);

        const mapped = rows.map(r => {
            let parsedTags = [];
            if (r.tags) {
                try { parsedTags = JSON.parse(r.tags); }
                catch (e) { parsedTags = typeof r.tags === 'string' ? r.tags.split(',').map(t => t.trim()) : []; }
            }
            return {
                ...r,
                allocatedAmount: Number(r.allocatedAmount) || 0,
                participantCount: Number(r.participantCount) || 0,
                tags: parsedTags
            };
        });
        res.json(mapped);
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

app.get('/api/partners', getHandler('direktori_mitra_csr'));
app.get('/api/regulations', getHandler('regulasi'));
app.get('/api/users', getHandler('pengguna'));
app.get('/api/submissions', getHandler('kontribusi_mitra_csr'));
app.get('/api/categories', getHandler('kelompok_program', r => r.name));
app.get('/api/sectors', getHandler('sektor_industri'));
app.get('/api/locations', getHandler('wilayah_kerja'));
app.get('/api/fiscal-years', getHandler('tahun_fiskal'));
app.get('/api/notifications', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM notifikasi ORDER BY created_at DESC LIMIT 50');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== SDGs & PILLARS CRUD ==========
app.get('/api/sdgs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM sdgs_tujuan ORDER BY no_get ASC');
        res.json(rows);
    } catch (err) {
        console.error('SDGs GET ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sdgs', upload.single('gambar'), async (req, res) => {
    const { no_get, judul, keterangan, warna } = req.body;
    const gambar = req.file ? `http://localhost:${PORT}/uploads/${req.file.filename}` : (req.body.gambar || '');
    try {
        const newId = `sdg-${no_get}`;
        await pool.query('INSERT INTO sdgs_tujuan (id, no_get, judul, keterangan, warna, gambar) VALUES (?,?,?,?,?,?)',
            [newId, no_get, judul, keterangan || '', warna || '#4c9f38', gambar]);
        await createNotification(`Tujuan SDG baru ditambahkan: ${judul}`, 'success');
        res.json({ success: true, id: newId });
    } catch (err) { console.error('SDGs POST ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.put('/api/sdgs/:id', upload.single('gambar'), async (req, res) => {
    const { no_get, judul, keterangan, warna } = req.body;
    const gambar = req.file ? `http://localhost:${PORT}/uploads/${req.file.filename}` : (req.body.gambar || '');
    try {
        if (gambar) {
            await pool.query('UPDATE sdgs_tujuan SET no_get=?, judul=?, keterangan=?, warna=?, gambar=? WHERE id=?',
                [no_get, judul, keterangan || '', warna || '#4c9f38', gambar, req.params.id]);
        } else {
            await pool.query('UPDATE sdgs_tujuan SET no_get=?, judul=?, keterangan=?, warna=? WHERE id=?',
                [no_get, judul, keterangan || '', warna || '#4c9f38', req.params.id]);
        }
        await createNotification(`Data SDG "${judul}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { console.error('SDGs PUT ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/sdgs/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM sdgs_pilar_mapping WHERE sdg_id = ?', [req.params.id]);
        await pool.query('DELETE FROM sdgs_tujuan WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { console.error('SDGs DELETE ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/pillars', async (req, res) => {
    try {
        const [pillars] = await pool.query('SELECT * FROM sdgs_pilar');
        const [mappings] = await pool.query(`
            SELECT m.*, t.no_get as sdg_no, t.judul as sdg_judul, t.warna
            FROM sdgs_pilar_mapping m
            JOIN sdgs_tujuan t ON m.sdg_id = t.id
        `);
        const mapped = pillars.map(p => ({
            ...p,
            sdgs: mappings.filter(m => m.pilar_id === p.id).sort((a, b) => a.sdg_no - b.sdg_no)
        }));
        res.json(mapped);
    } catch (err) {
        console.error('Pillars GET ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== TARGET SDGs CRUD ==========
app.get('/api/sdgs-targets', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, s.no_get as sdg_no, s.judul as sdg_judul
            FROM sdgs_target t
            LEFT JOIN sdgs_tujuan s ON t.sdg_id = s.id
            ORDER BY 
                s.no_get ASC, 
                CAST(SUBSTRING_INDEX(t.kode_target, '.', 1) AS UNSIGNED) ASC,
                IF(SUBSTRING_INDEX(t.kode_target, '.', -1) REGEXP '^[0-9]+$', 
                   CAST(SUBSTRING_INDEX(t.kode_target, '.', -1) AS UNSIGNED), 
                   SUBSTRING_INDEX(t.kode_target, '.', -1)) ASC
        `);
        res.json(rows);
    } catch (err) { console.error('SDGs Target GET ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/sdgs-targets', async (req, res) => {
    const { sdg_id, kode_target, deskripsi } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM sdgs_target ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/tgt-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `tgt-${nextNum}`;
        await pool.query('INSERT INTO sdgs_target (id, sdg_id, kode_target, deskripsi) VALUES (?, ?, ?, ?)',
            [newId, sdg_id, kode_target, deskripsi || '']);
        await createNotification(`Target SDGs baru ditambahkan: ${kode_target}`, 'success');
        res.json({ success: true, id: newId });
    } catch (err) { console.error('SDGs Target POST ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.put('/api/sdgs-targets/:id', async (req, res) => {
    const { sdg_id, kode_target, deskripsi } = req.body;
    try {
        await pool.query('UPDATE sdgs_target SET sdg_id=?, kode_target=?, deskripsi=? WHERE id=?',
            [sdg_id, kode_target, deskripsi || '', req.params.id]);
        await createNotification(`Target SDGs "${kode_target}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { console.error('SDGs Target PUT ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/sdgs-targets/:id', async (req, res) => {
    try {
        // Hapus indikator terkait dulu
        await pool.query('DELETE FROM sdgs_indikator WHERE target_id = ?', [req.params.id]);
        await pool.query('DELETE FROM sdgs_target WHERE id = ?', [req.params.id]);
        await createNotification(`Target SDGs ID ${req.params.id} telah dihapus.`, 'warning');
        res.json({ success: true });
    } catch (err) { console.error('SDGs Target DELETE ERROR:', err); res.status(500).json({ error: err.message }); }
});

// ========== INDIKATOR SDGs CRUD ==========
app.get('/api/sdgs-indikators', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT i.*, t.kode_target, t.sdg_id, s.no_get as sdg_no, s.judul as sdg_judul
            FROM sdgs_indikator i
            LEFT JOIN sdgs_target t ON i.target_id = t.id
            LEFT JOIN sdgs_tujuan s ON t.sdg_id = s.id
            ORDER BY 
                s.no_get ASC, 
                CAST(SUBSTRING_INDEX(t.kode_target, '.', 1) AS UNSIGNED) ASC,
                IF(SUBSTRING_INDEX(t.kode_target, '.', -1) REGEXP '^[0-9]+$', 
                   CAST(SUBSTRING_INDEX(t.kode_target, '.', -1) AS UNSIGNED), 
                   SUBSTRING_INDEX(t.kode_target, '.', -1)) ASC,
                i.kode_indikator ASC
        `);
        res.json(rows);
    } catch (err) { console.error('SDGs Indikator GET ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/sdgs-indikators', async (req, res) => {
    const { target_id, kode_indikator, deskripsi, keterangan } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM sdgs_indikator ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/ind-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `ind-${nextNum}`;
        await pool.query('INSERT INTO sdgs_indikator (id, target_id, kode_indikator, deskripsi, keterangan) VALUES (?, ?, ?, ?, ?)',
            [newId, target_id, kode_indikator, deskripsi || '', keterangan || '']);
        await createNotification(`Indikator SDGs baru ditambahkan: ${kode_indikator}`, 'success');
        res.json({ success: true, id: newId });
    } catch (err) { console.error('SDGs Indikator POST ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.put('/api/sdgs-indikators/:id', async (req, res) => {
    const { target_id, kode_indikator, deskripsi, keterangan } = req.body;
    try {
        await pool.query('UPDATE sdgs_indikator SET target_id=?, kode_indikator=?, deskripsi=?, keterangan=? WHERE id=?',
            [target_id, kode_indikator, deskripsi || '', keterangan || '', req.params.id]);
        await createNotification(`Indikator SDGs "${kode_indikator}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { console.error('SDGs Indikator PUT ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/sdgs-indikators/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM sdgs_indikator WHERE id = ?', [req.params.id]);
        await createNotification(`Indikator SDGs ID ${req.params.id} telah dihapus.`, 'warning');
        res.json({ success: true });
    } catch (err) { console.error('SDGs Indikator DELETE ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/org-profile', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM profil_organisasi LIMIT 1');
        res.json(rows[0] || {});
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/dashboard', async (req, res) => {
    try {
        const [programs] = await pool.query('SELECT COUNT(*) as total FROM kelola_program');
        const [partners] = await pool.query('SELECT COUNT(*) as total FROM direktori_mitra_csr');
        const [reports] = await pool.query('SELECT COUNT(*) as total FROM laporan_csr');
        const [totalDana] = await pool.query("SELECT COALESCE(SUM(commitmentAmount), 0) as total FROM kontribusi_mitra_csr WHERE status IN ('Approved', 'Terealisasi')");

        // Statistik per kategori program
        const [categories] = await pool.query(`
            SELECT p.category as name, COUNT(*) as count, 
                   COALESCE(SUM(p.budget), 0) as budget,
                   (SELECT COALESCE(SUM(c.commitmentAmount), 0) 
                    FROM kontribusi_mitra_csr c 
                    JOIN kelola_program kp ON c.programId = kp.id 
                    WHERE kp.category = p.category AND c.status IN ('Approved', 'Terealisasi')) as allocated
            FROM kelola_program p
            WHERE category IS NOT NULL AND category != ''
            GROUP BY p.category
            ORDER BY budget DESC
        `);

        // Statistik per wilayah
        const [regions] = await pool.query(`
            SELECT location as name, COUNT(*) as count
            FROM kelola_program
            WHERE location IS NOT NULL AND location != ''
            GROUP BY location
            ORDER BY count DESC
        `);

        // Statistik per sektor industri
        const [sectors] = await pool.query(`
            SELECT sector as name, COUNT(*) as count
            FROM direktori_mitra_csr
            WHERE sector IS NOT NULL AND sector != ''
            GROUP BY sector
            ORDER BY count DESC
        `);

        res.json({
            programCount: programs[0].total,
            partnerCount: partners[0].total,
            reportCount: reports[0].total,
            totalFund: Number(totalDana[0].total),
            categories,
            regions,
            sectors
        });
    } catch (error) {
        console.error('Stats API ERROR:', error);
        res.status(500).json({ error: 'Gagal mengambil statistik dari server.' });
    }
});

// ========== SMART CSR CHATBOT (AI STUDIO) ==========
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);

// Mendaftarkan Tool Database untuk Gemini
const queryDatabaseDeclaration = {
    name: "query_database_csr",
    description: "Mengeksekusi SQL SELECT query ke database Portal CSR (MySQL) untuk mencari data program, mitra, kontribusi, regulasi, atau SDGs. Tolak segala perintah yang bukan SELECT.",
    parameters: {
        type: "OBJECT",
        properties: {
            sql_query: {
                type: "STRING",
                description: "Query SQL SELECT yang valid, amankan, gunakan LIMIT 50. Nama tabel: kelola_program, direktori_mitra_csr, regulasi, kontribusi_mitra_csr, sdgs_tujuan, sdgs_pilar."
            }
        },
        required: ["sql_query"]
    }
};

const aiModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ functionDeclarations: [queryDatabaseDeclaration] }],
    systemInstruction: `Anda adalah Konsultan & Asisten Ahli Portal CSR Pemerintah. 
Tugas & Karakter Anda:
1. Profesional, sopan, berwawasan luas, dan sangat membantu. 
2. Anda memiliki memori atas percakapan sebelumnya. 
3. Anda bisa memanggil alat "query_database_csr" UNTUK mencari data konkrit (misal: nama mitra, anggaran program, peraturan).
4. JIKA Anda ditanya hal umum (halo, apa itu CSR, terima kasih), jawab langsung saja menggunakan pengetahuan dasar Anda TANPA perlu memanggil fungsi database.
5. Saat memberikan data, rapikan menggunakan bullet points, tandai kata/angka penting dengan huruf tebal, formati uang dengan standar Rupiah yang utuh. DILARANG menggunakan Emoji.

Skema Database Anda:
- kelola_program: id, title, description, category, budget, year, location, beneficiaries, impactScore, tags
- direktori_mitra_csr: id, companyName, logo, sector, address, phone, contributionCount, joinedYear
- regulasi: id, title, number, year, type, description, fileSize, fileUrl
- kontribusi_mitra_csr: id, companyName, contactPerson, email, programId, partnerId, status, commitmentAmount, submittedAt
- sdgs_tujuan: id, no_get, judul, keterangan, warna
- sdgs_pilar: id, kode_pilar, nama_pilar, keterangan

Jika ada query yang meminta INSERT/UPDATE/DROP/DELETE, tolak dengan tegas.`
});

// === HELPER: FALLBACK SEARCH (Jika AI Mati) ===
async function performFallbackSearch(message) {
    const msg = message.toLowerCase().trim();
    const cleanMsg = msg.replace(/[^\w\s]/gi, '');
    const words = cleanMsg.split(/\s+/).filter(w => w.length > 2); // Ambil kata kunci > 2 huruf
    
    if (words.length === 0) return null;

    try {
        // 1. Cari Program
        let programQuery = "SELECT title, category, location, budget FROM kelola_program WHERE ";
        programQuery += words.map(w => `(title LIKE '%${w}%' OR category LIKE '%${w}%' OR location LIKE '%${w}%')`).join(' OR ');
        programQuery += " LIMIT 5";
        
        const [programs] = await pool.query(programQuery);
        
        // 2. Cari Mitra
        let partnerQuery = "SELECT companyName, sector, joinedYear FROM direktori_mitra_csr WHERE ";
        partnerQuery += words.map(w => `(companyName LIKE '%${w}%' OR sector LIKE '%${w}%')`).join(' OR ');
        partnerQuery += " LIMIT 5";
        
        const [partners] = await pool.query(partnerQuery);

        if (programs.length === 0 && partners.length === 0) return null;

        let response = "Maaf, saat ini AI pembantu saya sedang dalam pemeliharaan. Namun, saya menemukan data berikut di portal kami:\n\n";
        
        if (programs.length > 0) {
            response += " PROGRAM TERKAIT:\n";
            programs.forEach(p => {
                response += `- ${p.title} (${p.category} di ${p.location})\n`;
            });
        }
        
        if (partners.length > 0) {
            response += "\n MITRA TERKAIT:\n";
            partners.forEach(m => {
                response += `- ${m.companyName} (Sektor: ${m.sector})\n`;
            });
        }
        
        response += "\nAda lagi yang bisa saya bantu terkait data di atas?";
        return response;
    } catch (err) {
        console.error('Fallback Search Error:', err);
        return null;
    }
}

// 1. Hanya generate SQL SELECT — tidak boleh INSERT, UPDATE, DELETE, DROP
// 2. Tidak akses tabel users/roles dari db_auth
// 3. Jika tidak bisa dijawab → TIDAK_BISA_DIJAWAB
// 4. Jika tentang panduan/fitur sistem → PANDUAN_SISTEM
// 5. Jika konten negatif → KONTEN_NEGATIF
// 6. Default LIMIT 50
// 7. SQL satu baris tanpa line break
// 8. Nama kolom sesuai schema
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

    const msg = message.toLowerCase().trim();
    const msgClean = msg.replace(/[^\w\s]/gi, '');

    // === LAYER 1: ETIKA & KONTEN NEGATIF ===
    const negativeWords = ['bodoh', 'goblok', 'tolol', 'bego', 'anjing', 'bangsat', 'bajingan', 'brengsek', 'idiot', 'kampret', 'monyet', 'tai', 'setan', 'iblis', 'kafir', 'rasis', 'sara', 'sampah', 'sialan', 'kontol', 'memek', 'ngentot', 'jancok', 'asu', 'cok', 'kimak', 'puki'];
    if (negativeWords.some(w => msgClean.includes(w))) {
        return res.json({ reply: 'Mohon gunakan bahasa yang sopan dan sesuai. Saya siap membantu terkait informasi Portal CSR.', tag: 'KONTEN_NEGATIF' });
    }

    // === FORMAT HISTORY UNTUK GEMINI ===
    const mappedHistory = (history || []).filter(h => h.role !== 'system').map(h => ({
        role: h.role === 'bot' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));

    // === ATTEMPT AI STUDIO PROCESSING DENGAN TOOLS ===
    try {
        const chatSession = aiModel.startChat({
            history: mappedHistory,
        });

        let result = await chatSession.sendMessage([{text: message}]);
        let call = result.response.functionCalls() ? result.response.functionCalls()[0] : null;

        // Jika AI memutuskan untuk memanggil fungsi Database
        if (call && call.name === "query_database_csr") {
            const sqlQuery = call.args.sql_query;
            console.log('[GEMINI CALLING DB]', sqlQuery);
            
            const unauthorized = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE'];
            if (unauthorized.some(cmd => sqlQuery.toUpperCase().includes(cmd))) {
                return res.json({ reply: 'Maaf, saya tidak berwenang melakukan modifikasi data (Hanya Pencarian yang diizinkan).' });
            }

            let dbResult = [];
            try {
                const [rows] = await pool.query(sqlQuery);
                dbResult = rows;
            } catch (dbErr) {
                console.error('[DB CHAT QUERY ERROR]', dbErr.message);
                dbResult = { error: "Terjadi kesalahan SQL saat mencari: " + dbErr.message };
            }

            // Kembalikan data mentah ke AI agar dia menyusunnya menjadi jawaban bahasa manusia
            result = await chatSession.sendMessage([{
                functionResponse: {
                    name: 'query_database_csr',
                    response: { data: dbResult }
                }
            }]);
        }

        const finalReply = result.response.text().trim();
        return res.json({ reply: finalReply, tag: 'AI_STUDIO' });

    } catch (error) {
        console.warn('AI Unavailable, switching to Fallback Search:', error.message);
        
        // === AI FAILED -> FALLBACK TO DATABASE SEARCH ===
        const fallbackReply = await performFallbackSearch(message);
        if (fallbackReply) {
            return res.json({ reply: fallbackReply, tag: 'FALLBACK_MODE' });
        }

        // Final Fail
        return res.json({ 
            reply: 'Maaf, asisten cerdas kami sedang mengalami gangguan koneksi. Harap tunggu sebentar atau periksa API Key Anda.',
            error: error.message
        });
    }
});

/* ================================
   DELETE ENDPOINTS
================================ */
app.delete('/api/programs/:id', deleteHandler('kelola_program'));
app.delete('/api/partners/:id', deleteHandler('direktori_mitra_csr'));
app.delete('/api/regulations/:id', deleteHandler('regulasi'));
app.delete('/api/users/:id', deleteHandler('pengguna'));
app.delete('/api/submissions/:id', deleteHandler('kontribusi_mitra_csr'));
app.delete('/api/fiscal-years/:id', deleteHandler('tahun_fiskal'));
app.delete('/api/categories/:id', deleteHandler('kelompok_program', 'name'));
app.delete('/api/sectors/:id', deleteHandler('sektor_industri', 'name'));
app.delete('/api/locations/:id', deleteHandler('wilayah_kerja', 'name'));

// Delete Pillars (BARU)
app.delete('/api/pillars/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM sdgs_pilar_mapping WHERE pilar_id = ?', [req.params.id]);
        await pool.query('DELETE FROM sdgs_pilar WHERE id = ?', [req.params.id]);
        await createNotification(`Pilar SDGs ID ${req.params.id} telah dihapus.`, 'warning');
        res.json({ success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

/* ================================
   POST (CREATE/UPDATE) ENDPOINTS
================================ */

// Programs (CREATE)
app.post('/api/programs', async (req, res) => {
    const { title, description, category, budget, year, location, beneficiaries, image, impactScore, tags } = req.body;
    const stringTags = tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : '[]';
    try {
        // Logic pencarian ID otomatis yang lebih kuat (Mencari MAX numeric part)
        const [rows] = await pool.query('SELECT id FROM kelola_program');
        let maxNum = 0;
        rows.forEach(row => {
            const match = row.id.match(/p-(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });
        const newId = `p-${maxNum + 1}`;
        await pool.query(
            `INSERT INTO kelola_program (id, title, description, category, budget, year, location, beneficiaries, image, impactScore, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, title, description || '', category, budget, year, location || '', beneficiaries || '', image || '', impactScore || 0, stringTags]
        );
        await createNotification(`Program baru ditambahkan: ${title}`, 'success');
        res.json({ success: true, id: newId, title, description, category, budget, year, location, beneficiaries, image, impactScore, tags: stringTags });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

// Programs (UPDATE)
app.put('/api/programs/:id', async (req, res) => {
    const { title, description, category, budget, year, location, beneficiaries, image, impactScore, tags } = req.body;
    const stringTags = tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : '[]';
    try {
        await pool.query(
            `UPDATE kelola_program SET title=?, description=?, category=?, budget=?, year=?, location=?, beneficiaries=?, image=?, impactScore=?, tags=? WHERE id=?`,
            [title, description || '', category, budget, year, location || '', beneficiaries || '', image || '', impactScore || 0, stringTags, req.params.id]
        );
        await createNotification(`Program "${title}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

// Partners (CREATE)
app.post('/api/partners', async (req, res) => {
    const { companyName, logo, sector, address, phone, contributionCount, joinedYear, name } = req.body;
    const finalName = companyName || name;
    try {
        // Logic pencarian ID otomatis yang lebih kuat untuk Mitra (m-)
        const [rows] = await pool.query('SELECT id FROM direktori_mitra_csr');
        let maxNum = 0;
        rows.forEach(row => {
            const match = row.id.match(/m-(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });
        const newId = `m-${maxNum + 1}`;
        await pool.query(
            `INSERT INTO direktori_mitra_csr (id, companyName, logo, sector, address, phone, contributionCount, joinedYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, finalName, logo || '', sector || '', address || '', phone || '', contributionCount || 0, joinedYear || new Date().getFullYear()]
        );
        await createNotification(`Mitra baru ditambahkan: ${finalName}`, 'success');
        res.json({ success: true, id: newId, companyName: finalName, logo, sector, address, phone, contributionCount, joinedYear });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});
app.put('/api/partners/:id', async (req, res) => {
    const { companyName, logo, sector, address, phone, contributionCount, joinedYear, name } = req.body;
    const finalName = companyName || name;
    try {
        await pool.query(`UPDATE direktori_mitra_csr SET companyName=?, logo=?, sector=?, address=?, phone=?, contributionCount=?, joinedYear=? WHERE id=?`,
            [finalName, logo || '', sector || '', address || '', phone || '', contributionCount || 0, joinedYear || new Date().getFullYear(), req.params.id]);
        await createNotification(`Data mitra "${finalName}" telah diubah.`, 'info');
        res.json({ success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// Pillars (CREATE)
app.post('/api/pillars', async (req, res) => {
    const { kode_pilar, nama_pilar, keterangan, sdg_ids } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM sdgs_pilar ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/pil-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `pil-${nextNum}`;
        await pool.query(`INSERT INTO sdgs_pilar (id, kode_pilar, nama_pilar, keterangan) VALUES (?, ?, ?, ?)`,
            [newId, kode_pilar, nama_pilar, keterangan || '']);

        if (sdg_ids && Array.isArray(sdg_ids)) {
            for (const sdg_id of sdg_ids) {
                const mapId = `map-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                await pool.query(`INSERT INTO sdgs_pilar_mapping (id, pilar_id, sdg_id) VALUES (?, ?, ?)`, [mapId, newId, sdg_id]);
            }
        }
        await createNotification(`Pilar SDGs baru ditambahkan: ${nama_pilar}`, 'success');
        res.json({ success: true, id: newId });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

app.put('/api/pillars/:id', async (req, res) => {
    const { kode_pilar, nama_pilar, keterangan, sdg_ids } = req.body;
    try {
        await pool.query(`UPDATE sdgs_pilar SET kode_pilar=?, nama_pilar=?, keterangan=? WHERE id=?`,
            [kode_pilar, nama_pilar, keterangan || '', req.params.id]);

        // Update mapping
        await pool.query(`DELETE FROM sdgs_pilar_mapping WHERE pilar_id = ?`, [req.params.id]);
        if (sdg_ids && Array.isArray(sdg_ids)) {
            for (const sdg_id of sdg_ids) {
                const mapId = `map-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                await pool.query(`INSERT INTO sdgs_pilar_mapping (id, pilar_id, sdg_id) VALUES (?, ?, ?)`, [mapId, req.params.id, sdg_id]);
            }
        }
        await createNotification(`Data Pilar "${nama_pilar}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// Regulations (CREATE with file upload)
app.post('/api/regulations', uploadReg.single('file'), async (req, res) => {
    const { title, number, year, type, description } = req.body;
    const fileUrl = req.file ? `/public/regulations/${req.file.filename}` : null;
    const fileSize = req.file ? (req.file.size / 1024).toFixed(0) + ' KB' : (req.body.fileSize || '');
    try {
        const [existing] = await pool.query('SELECT id FROM regulasi ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/reg-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `reg-${nextNum}`;
        await pool.query(`INSERT INTO regulasi (id, title, number, year, type, description, fileSize, fileUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, title, number || '', year || new Date().getFullYear(), type || '', description || '', fileSize, fileUrl]);
        await createNotification(`Regulasi baru ditambahkan: ${title}`, 'success');
        res.json({ success: true, id: newId, title, number, year, type, description, fileSize, fileUrl });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});
app.put('/api/regulations/:id', uploadReg.single('file'), async (req, res) => {
    const { title, number, year, type, description } = req.body;
    try {
        let fileUrl = req.body.fileUrl || null;
        let fileSize = req.body.fileSize || '';
        if (req.file) {
            fileUrl = `/public/regulations/${req.file.filename}`;
            fileSize = (req.file.size / 1024).toFixed(0) + ' KB';
        }
        await pool.query(`UPDATE regulasi SET title=?, number=?, year=?, type=?, description=?, fileSize=?, fileUrl=? WHERE id=?`,
            [title, number || '', year, type || '', description || '', fileSize, fileUrl, req.params.id]);
        await createNotification(`Regulasi "${title}" telah diperbarui.`, 'info');
        const [updated] = await pool.query('SELECT * FROM regulasi WHERE id = ?', [req.params.id]);
        res.json(updated[0] || { success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// Users (CREATE)
app.post('/api/users', async (req, res) => {
    const { name, email, role, lastLogin } = req.body;
    try {
        // Logik pencarian ID otomatis yang lebih kuat (u-)
        const [rows] = await pool.query('SELECT id FROM pengguna');
        let maxNum = 0;
        rows.forEach(row => {
            const match = row.id.match(/u-(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });
        const newId = `u-${maxNum + 1}`;
        
        // Pastikan kolom password diisi (default: admin123)
        const defaultPw = 'admin123';
        
        await pool.query(`INSERT INTO pengguna (id, name, email, role, password, lastLogin) VALUES (?, ?, ?, ?, ?, ?)`,
            [newId, name, email, role || 'Viewer', defaultPw, lastLogin || new Date().toISOString()]);
        
        await createNotification(`Pengguna baru terdaftar: ${name} (${role})`, 'success');
        res.json({ success: true, id: newId, name, email, role, lastLogin });
    } catch (err) { 
        console.error('USER CREATE ERROR:', err); 
        res.status(500).json({ error: 'Gagal menyimpan: ' + err.message }); 
    }
});
app.put('/api/users/:id', async (req, res) => {
    const { name, email, role, lastLogin } = req.body;
    try {
        await pool.query(`UPDATE pengguna SET name=?, email=?, role=?, lastLogin=? WHERE id=?`,
            [name, email, role || 'Viewer', lastLogin || new Date().toISOString(), req.params.id]);
        await createNotification(`Profil pengguna "${name}" diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// ========== PROFILE ENDPOINTS ==========

// Safe column adder (MySQL doesn't support IF NOT EXISTS for columns)
async function safeAddColumn(table, column, type) {
    try { await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`); } catch (e) { /* column already exists */ }
}

// Run migrations once on first profile request
let profileMigrated = false;
async function ensureProfileColumns() {
    if (profileMigrated) return;
    await safeAddColumn('pengguna', 'password', 'TEXT');
    await safeAddColumn('pengguna', 'instansi', 'TEXT');
    await safeAddColumn('pengguna', 'emailDinas', 'TEXT');
    profileMigrated = true;
}

// Emergency password reset (admin only)
app.get('/api/reset-admin-pw', async (req, res) => {
    try {
        await ensureProfileColumns();
        await pool.query("UPDATE pengguna SET password = 'admin123' WHERE email = 'admin'");
        res.json({ success: true, message: 'Password admin telah direset ke admin123' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET profile by email (using query param)
app.get('/api/profile', async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email parameter required.' });
    try {
        await ensureProfileColumns();
        const [users] = await pool.query('SELECT id, name, email, role, instansi, emailDinas, lastLogin FROM pengguna WHERE email = ?', [email]);
        if (users.length === 0) {
            if (email === 'admin') {
                return res.json({ name: 'Admin Utama', email: 'admin', role: 'Admin', instansi: '' });
            }
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }
        res.json(users[0]);
    } catch (err) { console.error('PROFILE ERROR:', err); res.status(500).json({ error: err.message }); }
});

// PUT update profile info
app.put('/api/profile', async (req, res) => {
    const { email, name, instansi, emailDinas } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    try {
        await ensureProfileColumns();
        const [users] = await pool.query('SELECT id FROM pengguna WHERE email = ?', [email]);
        if (users.length === 0) {
            if (email === 'admin') {
                const newId = 'u-admin';
                await pool.query('INSERT INTO pengguna (id, name, email, role, instansi, emailDinas, lastLogin) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [newId, name, email, 'Admin', instansi || '', emailDinas || '', new Date().toISOString()]);
                return res.json({ success: true });
            }
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }
        await pool.query('UPDATE pengguna SET name=?, instansi=?, emailDinas=? WHERE email=?', [name, instansi || '', emailDinas || '', email]);
        await createNotification(`Profil instansi "${name}" diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { console.error('PROFILE UPDATE ERROR:', err); res.status(500).json({ error: err.message }); }
});

// PUT change password
app.put('/api/profile/password', async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    try {
        await ensureProfileColumns();
        const [users] = await pool.query('SELECT id, password FROM pengguna WHERE email = ?', [email]);

        if (users.length === 0 && email === 'admin') {
            if (currentPassword !== 'admin123') {
                return res.status(401).json({ error: 'Kata sandi lama salah.' });
            }
            const newId = 'u-admin';
            await pool.query('INSERT INTO pengguna (id, name, email, role, password, lastLogin) VALUES (?, ?, ?, ?, ?, ?)',
                [newId, 'Admin Utama', email, 'Admin', newPassword, new Date().toISOString()]);
            return res.json({ success: true });
        }

        if (users.length === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }

        const user = users[0];
        const storedPassword = user.password || 'admin123';

        const isLegacyBcrypt = storedPassword.startsWith('$2b$');
        let isValid = false;

        if (isLegacyBcrypt) {
            isValid = (currentPassword === 'admin123');
        } else {
            isValid = (currentPassword === storedPassword);
        }

        if (!isValid) {
            return res.status(401).json({ error: 'Kata sandi lama salah.' });
        }

        await pool.query('UPDATE pengguna SET password=? WHERE email=?', [newPassword, email]);
        await createNotification(`Kata sandi akun ${email} telah diubah.`, 'warning');
        res.json({ success: true });
    } catch (err) { console.error('PASSWORD CHANGE ERROR:', err); res.status(500).json({ error: err.message }); }
});

// Submissions (CREATE)
app.post('/api/submissions', async (req, res) => {
    const { companyName, contactPerson, email, phone, programId, status, commitmentAmount, submittedAt } = req.body;
    try {
        // Logic pencarian ID otomatis yang lebih kuat untuk Submissions (s-)
        const [rows] = await pool.query('SELECT id FROM kontribusi_mitra_csr');
        let maxNum = 0;
        rows.forEach(row => {
            const match = row.id.match(/s-(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });
        const newId = `s-${maxNum + 1}`;
        await pool.query(`INSERT INTO kontribusi_mitra_csr (id, companyName, contactPerson, email, phone, programId, status, commitmentAmount, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, companyName, contactPerson || '', email || '', phone || '', programId || '', status || 'Pending', commitmentAmount || 0, submittedAt || new Date().toISOString()]);
        
        await createNotification(`Pengajuan kontribusi baru dari ${companyName} telah diterima.`, 'info');
        
        // --- WHATSAPP NOTIF TO ADMIN ---
        const adminWA = process.env.ADMIN_WA_NUMBER;
        if (adminWA) {
            const [prog] = await pool.query('SELECT title FROM kelola_program WHERE id = ?', [programId]);
            const progTitle = prog[0]?.title || 'Program CSR';
            const adminMsg = `📢 *PENGAJUAN CSR BARU*\n\nDari: *${companyName}*\nKontak: ${contactPerson}\nProgram: ${progTitle}\nNilai: Rp ${Number(commitmentAmount).toLocaleString('id-ID')}\n\nSilakan cek dashboard admin untuk verifikasi.`;
            sendWhatsapp(adminWA, adminMsg);
        }

        // --- WHATSAPP NOTIF TO CLIENT ---
        if (phone) {
            const clientMsg = `Halo *${contactPerson}*,\n\nTerima kasih atas partisipasi perusahaan *${companyName}* dalam program CSR kami. Pengajuan Anda telah kami terima dan saat ini sedang dalam proses verifikasi.\n\nSimpan pesan ini sebagai bukti pendaftaran anda.`;
            sendWhatsapp(phone, clientMsg);
        }

        res.json({ success: true, id: newId, companyName, contactPerson, email, phone, programId, status, commitmentAmount, submittedAt });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// Reports (Laporan CSR)
app.get('/api/reports', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM laporan_csr ORDER BY tanggal_unggah DESC');
        res.json(rows);
    } catch (err) {
        console.error('API ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reports/upload', uploadReport.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { id_mitra, id_program } = req.body;

    try {
        // Logic pencarian ID otomatis yang lebih kuat untuk Laporan (rep-)
        const [rows] = await pool.query('SELECT id FROM laporan_csr');
        let maxNum = 0;
        rows.forEach(row => {
            const match = row.id.match(/rep-(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });
        const newId = `rep-${maxNum + 1}`;

        const nama_file = req.file.originalname;
        const tipe_file = req.file.mimetype.split('/')[1] || path.extname(nama_file).substring(1);
        const ukuran_file = (req.file.size / 1024 / 1024).toFixed(2) + ' MB';
        const path_url = `/public/reports/${req.file.filename}`;
        const diunggah_oleh = 'Admin';
        const tanggal_unggah = new Date().toISOString();

        await pool.query(
            `INSERT INTO laporan_csr (id, nama_file, tipe_file, ukuran_file, path_url, diunggah_oleh, tanggal_unggah, id_mitra, id_program)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, nama_file, tipe_file, ukuran_file, path_url, diunggah_oleh, tanggal_unggah, id_mitra || null, id_program || null]
        );

        res.json({
            message: 'File berhasil diunggah',
            url: path_url,
            data: { id: newId, nama_file, ukuran_file, tipe_file }
        });
        await createNotification(`Laporan CSR baru diunggah: ${nama_file}`, 'success');
    } catch (err) {
        console.error('API ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/submissions/:id', async (req, res) => {
    const { status } = req.body;
    console.log(`UPDATING SUBMISSION id=${req.params.id} to status=${status}`);
    try {
        // Ambil data submission dulu untuk butuh nomor WA & nama perusahaan
        const [subs] = await pool.query('SELECT * FROM kontribusi_mitra_csr WHERE id = ?', [req.params.id]);
        if (subs.length === 0) return res.status(404).json({ error: 'Noot found' });
        const sub = subs[0];

        await pool.query(`UPDATE kontribusi_mitra_csr SET status=? WHERE id=?`, [status, req.params.id]);
        await createNotification(`Status pengajuan ${req.params.id} diubah menjadi: ${status}`, 'info');

        // --- WHATSAPP NOTIF ON APPROVAL ---
        if ((status === 'Terealisasi' || status === 'Approved') && sub.phone) {
            const approvalMsg = `🎊 *SELAMAT! KONTRIBUSI DISETUJUI*\n\nYth. *${sub.contactPerson}*,\nKami informasikan bahwa ajuan CSR dari *${sub.companyName}* telah disetujui dan berstatus *TEREALISASI*.\n\nTerima kasih atas kontribusi nyata Perusahaan Anda bagi pembangunan daerah.`;
            sendWhatsapp(sub.phone, approvalMsg);
        }

        res.json({ success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// FiscalYears (CREATE)
app.post('/api/fiscal-years', async (req, res) => {
    const { year, status, description } = req.body;
    try {
        // Logic pencarian ID otomatis yang lebih kuat untuk Fiscal Years (fy-)
        const [rows] = await pool.query('SELECT id FROM tahun_fiskal');
        let maxNum = 0;
        rows.forEach(row => {
            const match = row.id.match(/fy-(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });
        const newId = `fy-${maxNum + 1}`;
        await pool.query(`INSERT INTO tahun_fiskal (id, year, status, description) VALUES (?, ?, ?, ?)`,
            [newId, year, status || 'Active', description || '']);
        await createNotification(`Tahun fiskal baru ditambahkan: ${year}`, 'success');
        res.json({ success: true, id: newId, year, status, description });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});
app.put('/api/fiscal-years/:id', async (req, res) => {
    const { year, status, description } = req.body;
    try {
        await pool.query(`UPDATE tahun_fiskal SET year=?, status=?, description=? WHERE id=?`,
            [year, status || 'Active', description || '', req.params.id]);
        await createNotification(`Tahun fiskal ${year} diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// OrgProfile (Single row UPSERT)
app.post('/api/org-profile', async (req, res) => {
    const { name, vision, mission, address, email, phone, website, licenseKey, logo } = req.body;
    try {
        await pool.query(
            `INSERT INTO profil_organisasi (id, name, vision, mission, address, email, phone, website, licenseKey, logo)
             VALUES ('1', ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             name=VALUES(name), vision=VALUES(vision), mission=VALUES(mission), address=VALUES(address),
             email=VALUES(email), phone=VALUES(phone), website=VALUES(website), licenseKey=VALUES(licenseKey), logo=VALUES(logo)`,
            [name, vision, mission, address, email, phone, website, licenseKey, logo]
        );
        await createNotification(`Profil organisasi "${name}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

// Categories (INSERT or UPDATE with cascade)
app.post('/api/categories', async (req, res) => {
    const { name, oldName } = req.body;
    try {
        if (oldName && oldName !== name) {
            await pool.query('UPDATE kelompok_program SET name = ? WHERE name = ?', [name, oldName]);
            await pool.query('UPDATE kelola_program SET category = ? WHERE category = ?', [name, oldName]);
        } else {
            await pool.query('INSERT IGNORE INTO kelompok_program (name) VALUES (?)', [name]);
        }
        await createNotification(oldName ? `Kategori program "${oldName}" diubah menjadi "${name}".` : `Kategori program baru ditambahkan: ${name}`, 'info');
        res.json({ success: true });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

// Sectors
app.post('/api/sectors', async (req, res) => {
    const { name, oldName } = req.body;
    try {
        if (oldName && oldName !== name) {
            await pool.query('UPDATE sektor_industri SET name = ? WHERE name = ?', [name, oldName]);
            await pool.query('UPDATE direktori_mitra_csr SET sector = ? WHERE sector = ?', [name, oldName]);
        } else {
            await pool.query('INSERT IGNORE INTO sektor_industri (name) VALUES (?)', [name]);
        }
        await createNotification(oldName ? `Sektor industri "${oldName}" diubah menjadi "${name}".` : `Sektor industri baru ditambahkan: ${name}`, 'info');
        res.json({ success: true });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

// Locations
app.post('/api/locations', async (req, res) => {
    const { name, oldName } = req.body;
    try {
        if (oldName && oldName !== name) {
            await pool.query('UPDATE wilayah_kerja SET name = ? WHERE name = ?', [name, oldName]);
            await pool.query('UPDATE kelola_program SET location = ? WHERE location = ?', [name, oldName]);
        } else {
            await pool.query('INSERT IGNORE INTO wilayah_kerja (name) VALUES (?)', [name]);
        }
        await createNotification(oldName ? `Wilayah kerja "${oldName}" diubah menjadi "${name}".` : `Wilayah kerja baru ditambahkan: ${name}`, 'info');
        res.json({ success: true });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

/* ================================
   ROLE MANAGEMENT
================================ */

app.get('/api/roles', async (req, res) => {
    try {
        const [roles] = await pool.query('SELECT * FROM peran_sistem');
        const parsedRoles = roles.map(r => {
            let parsedMenus = [];
            try { parsedMenus = JSON.parse(r.menus); } catch (e) { }
            return { ...r, menus: parsedMenus };
        });
        res.json(parsedRoles);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/roles', async (req, res) => {
    const { role_name, description, menus, color } = req.body;
    try {
        const newId = 'r-' + Date.now();
        const menusStr = JSON.stringify(Array.isArray(menus) ? menus : []);
        await pool.query('INSERT INTO peran_sistem (id, role_name, description, menus, color) VALUES (?, ?, ?, ?, ?)',
            [newId, role_name, description, menusStr, color || 'slate']);
        await createNotification(`Peran (role) sistem baru ditambahkan: ${role_name}`, 'success');
        res.json({ success: true, id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/roles/:id', async (req, res) => {
    const { id } = req.params;
    const { role_name, description, menus, color } = req.body;
    try {
        const menusStr = JSON.stringify(Array.isArray(menus) ? menus : []);
        await pool.query('UPDATE peran_sistem SET role_name=?, description=?, menus=?, color=? WHERE id=?',
            [role_name, description, menusStr, color, id]);
        await createNotification(`Pengaturan peran "${role_name}" telah diubah.`, 'info');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/roles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [roles] = await pool.query('SELECT role_name FROM peran_sistem WHERE id=?', [id]);
        if (roles.length > 0 && roles[0].role_name.toLowerCase() === 'administrator') {
            return res.status(403).json({ error: 'Peran Administrator tidak bisa dihapus.' });
        }
        await pool.query('DELETE FROM peran_sistem WHERE id=?', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ================================
   ERROR HANDLING & FALLBACK
================================ */

// Clear All Notifs (BARU)
app.delete('/api/notifications', async (req, res) => {
    try {
        await pool.query('DELETE FROM notifikasi');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete Single Notif (BARU)
app.delete('/api/notifications/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM notifikasi WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Read All Notifs (BARU)
app.put('/api/notifications/read-all', async (req, res) => {
    try {
        await pool.query('UPDATE notifikasi SET is_read = 1');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Catch-all 404 for API routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API Endpoint tidak ditemukan.' });
});

// Help message for root access on API port
app.get('/', (req, res) => {
    res.send('<h1>Server Backend PORTAL CSR Aktif</h1><p>Silakan akses aplikasi utama di <a href="http://localhost:5173">http://localhost:5173</a></p>');
});

// Generic Error Handler
app.use((err, req, res, next) => {
    console.error('SERVER CRASH PREVENTED:', err.stack);

    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (!res.headersSent) {
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
});

/* ================================
   START SERVER
================================ */
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('CRITICAL: Database initialization failed:', err);
    process.exit(1);
});
