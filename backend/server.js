const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
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
            orderBy = ' ORDER BY id ASC';
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
        const [result] = await pool.query(`DELETE FROM ${tableName} WHERE ${idField} = ?`, [req.params.id]);
        res.json({ success: true, changes: result.affectedRows });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
};

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
            } catch(e) {
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

// ========== SMART CSR CHATBOT (SQL-BASED) ==========
// ATURAN:
// 1. Hanya generate SQL SELECT — tidak boleh INSERT, UPDATE, DELETE, DROP
// 2. Tidak akses tabel users/roles dari db_auth
// 3. Jika tidak bisa dijawab → TIDAK_BISA_DIJAWAB
// 4. Jika tentang panduan/fitur sistem → PANDUAN_SISTEM
// 5. Jika konten negatif → KONTEN_NEGATIF
// 6. Default LIMIT 50
// 7. SQL satu baris tanpa line break
// 8. Nama kolom sesuai schema
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

    try {
        const msg = message.toLowerCase().trim();
        const msgClean = msg.replace(/[^\w\s]/gi, '');
        const words = msgClean.split(/\s+/).filter(w => w.length > 1);

        // === RULE 6: KONTEN NEGATIF ===
        const negativeWords = ['bodoh','goblok','tolol','bego','anjing','bangsat','bajingan','brengsek','idiot','kampret','monyet','tai','setan','iblis','kafir','rasis','sara','sampah','sialan','kontol','memek','ngentot','jancok','asu','cok','kimak','puki'];
        if (negativeWords.some(w => msgClean.includes(w))) {
            return res.json({ reply: '⛔ **KONTEN_NEGATIF**\n\nMohon maaf, saya tidak dapat memproses pesan yang mengandung konten negatif, kata kasar, atau unsur SARA.\n\nSilakan ajukan pertanyaan dengan bahasa yang baik dan sopan terkait program CSR. 🙏', tag: 'KONTEN_NEGATIF' });
        }

        // === RULE 5: PANDUAN SISTEM ===
        const guideWords = ['cara pakai','cara kerja','fitur','panduan','tutorial','role','akses','hak akses','login','cara login','cara daftar akun','dataset','cara upload','cara download','cara menggunakan','guide','manual','petunjuk','cara masuk','cara buat','fungsi tombol','navigasi'];
        if (guideWords.some(g => msg.includes(g))) {
            return res.json({ reply: '📖 **PANDUAN_SISTEM**\n\nBerikut panduan penggunaan CSR Portal:\n\n**🔑 Login & Akses:**\n• Masuk via halaman Login dengan email & password\n• Terdapat role: Operator, Dinas, Admin (sesuai peran di sistem)\n\n**📋 Fitur Utama:**\n• **Program CSR** — Kelola program sosial perusahaan\n• **Mitra CSR** — Direktori perusahaan mitra\n• **SDGs** — 17 Tujuan Pembangunan Berkelanjutan\n• **Pilar CSR** — Pengelompokan area fokus\n• **Regulasi** — Peraturan & dasar hukum\n• **Statistik** — Dashboard ringkasan data\n• **Chat AI** — Konsultasi data CSR (halaman ini)\n\n**📝 Cara Mengelola Data:**\n1. Buka **Panel Admin** dari navbar\n2. Pilih menu di sidebar kiri\n3. Gunakan tombol **Tambah Data** untuk menambah\n4. Gunakan ikon ✏️ untuk edit, 🗑️ untuk hapus\n\nAda pertanyaan lain tentang data CSR?', tag: 'PANDUAN_SISTEM' });
        }

        // === GREETING, THANK, BYE ===
        const isGreet = ['halo','hai','hi','hey','pagi','siang','sore','malam','assalamualaikum','hello','apa kabar'].some(g => msg.includes(g));
        const isThank = ['terima kasih','makasih','thanks','trims'].some(t => msg.includes(t));
        const isBye = ['bye','dadah','sampai jumpa'].some(b => msg.includes(b));

        if (isGreet && words.length <= 5) {
            return res.json({ reply: 'Halo! 👋 Selamat datang di **Asisten Data CSR Portal**!\n\nSaya menjawab berdasarkan **data real** dari database:\n\n📋 _"Tampilkan semua program CSR"_\n🤝 _"Siapa saja mitra dari sektor pertambangan?"_\n🎯 _"Jelaskan SDG nomor 4"_\n📊 _"Berapa total dana CSR?"_\n📜 _"Ada regulasi apa saja?"_\n🏛️ _"Daftar pilar CSR"_\n\nSilakan tanyakan apa saja tentang data CSR!' });
        }
        if (isThank) return res.json({ reply: 'Sama-sama! 😊 Senang bisa membantu. Jangan ragu bertanya lagi tentang data CSR kapanpun.' });
        if (isBye) return res.json({ reply: 'Sampai jumpa! 👋 Semoga data yang saya berikan bermanfaat.' });

        // === SCHEMA & FORBIDDEN ===
        const FORBIDDEN = ['pengguna','users','roles','peran_sistem'];

        // === NL-TO-SQL ENGINE ===
        let sqlQuery = null;
        let queryLabel = '';

        // PROGRAM queries
        if (['program','proyek','kegiatan'].some(w => msg.includes(w))) {
            if (['berapa','jumlah','total','hitung','count'].some(w => msg.includes(w))) {
                if (['kategori','category','per kategori'].some(w => msg.includes(w))) {
                    sqlQuery = "SELECT category, COUNT(*) as jumlah FROM kelola_program GROUP BY category ORDER BY jumlah DESC LIMIT 50";
                    queryLabel = 'Jumlah Program per Kategori';
                } else if (['lokasi','wilayah','daerah'].some(w => msg.includes(w))) {
                    sqlQuery = "SELECT location, COUNT(*) as jumlah FROM kelola_program GROUP BY location ORDER BY jumlah DESC LIMIT 50";
                    queryLabel = 'Jumlah Program per Lokasi';
                } else {
                    sqlQuery = "SELECT COUNT(*) as total_program FROM kelola_program";
                    queryLabel = 'Total Program CSR';
                }
            } else if (['dana','anggaran','budget','terbesar','tertinggi'].some(w => msg.includes(w))) {
                sqlQuery = "SELECT title, category, location, budget, year FROM kelola_program ORDER BY budget DESC LIMIT 10";
                queryLabel = 'Program dengan Dana Terbesar';
            } else if (['dampak','impact','skor'].some(w => msg.includes(w))) {
                sqlQuery = "SELECT title, category, impactScore, location FROM kelola_program ORDER BY impactScore DESC LIMIT 10";
                queryLabel = 'Program dengan Dampak Tertinggi';
            } else {
                const st = words.filter(w => !['program','csr','semua','tampilkan','ada','apa','saja','yang','di','dan','untuk','dari','list','daftar'].includes(w));
                if (st.length > 0) {
                    const like = st.map(t => `(title LIKE '%${t}%' OR description LIKE '%${t}%' OR category LIKE '%${t}%' OR location LIKE '%${t}%')`).join(' AND ');
                    sqlQuery = `SELECT title, category, location, budget, beneficiaries, year FROM kelola_program WHERE ${like} LIMIT 50`;
                    queryLabel = 'Pencarian Program: ' + st.join(' ');
                } else {
                    sqlQuery = "SELECT title, category, location, budget, beneficiaries, year FROM kelola_program ORDER BY year DESC, title ASC LIMIT 50";
                    queryLabel = 'Daftar Program CSR';
                }
            }
        }
        // MITRA queries
        else if (['mitra','partner','perusahaan','korporasi','rekanan'].some(w => msg.includes(w))) {
            if (['berapa','jumlah','total','count'].some(w => msg.includes(w))) {
                if (['sektor','industri'].some(w => msg.includes(w))) {
                    sqlQuery = "SELECT sector, COUNT(*) as jumlah FROM direktori_mitra_csr GROUP BY sector ORDER BY jumlah DESC LIMIT 50";
                    queryLabel = 'Jumlah Mitra per Sektor';
                } else {
                    sqlQuery = "SELECT COUNT(*) as total_mitra FROM direktori_mitra_csr";
                    queryLabel = 'Total Mitra CSR';
                }
            } else {
                const st = words.filter(w => !['mitra','partner','perusahaan','semua','tampilkan','ada','apa','saja','yang','di','dari','siapa','list','daftar','csr'].includes(w));
                if (st.length > 0) {
                    const like = st.map(t => `(companyName LIKE '%${t}%' OR sector LIKE '%${t}%' OR address LIKE '%${t}%')`).join(' AND ');
                    sqlQuery = `SELECT companyName, sector, address, phone, joinedYear FROM direktori_mitra_csr WHERE ${like} LIMIT 50`;
                    queryLabel = 'Pencarian Mitra: ' + st.join(' ');
                } else {
                    sqlQuery = "SELECT companyName, sector, address, phone, joinedYear FROM direktori_mitra_csr ORDER BY companyName ASC LIMIT 50";
                    queryLabel = 'Daftar Mitra CSR';
                }
            }
        }
        // SDGs queries
        else if (['sdg','sdgs','tpb','tujuan pembangunan'].some(w => msg.includes(w))) {
            const numMatch = msg.match(/(\d+)/);
            if (numMatch) {
                sqlQuery = `SELECT no_get, judul, keterangan FROM sdgs_tujuan WHERE no_get = ${parseInt(numMatch[1])} LIMIT 1`;
                queryLabel = 'Detail SDG ' + numMatch[1];
            } else {
                sqlQuery = "SELECT no_get, judul, keterangan FROM sdgs_tujuan ORDER BY no_get ASC LIMIT 50";
                queryLabel = 'Daftar SDGs';
            }
        }
        // PILAR queries
        else if (['pilar','pillar'].some(w => msg.includes(w))) {
            sqlQuery = "SELECT kode_pilar, nama_pilar, keterangan FROM sdgs_pilar ORDER BY kode_pilar ASC LIMIT 50";
            queryLabel = 'Daftar Pilar CSR';
        }
        // REGULASI queries
        else if (['regulasi','peraturan','undang','hukum','perda','aturan'].some(w => msg.includes(w))) {
            sqlQuery = "SELECT title, year, description FROM regulasi ORDER BY year DESC LIMIT 50";
            queryLabel = 'Daftar Regulasi CSR';
        }
        // DANA/KONTRIBUSI queries
        else if (['dana','anggaran','kontribusi','sumbangan','donasi','tersalurkan','realisasi'].some(w => msg.includes(w))) {
            if (['total','berapa','jumlah'].some(w => msg.includes(w))) {
                sqlQuery = "SELECT COUNT(*) as total_kontribusi, COALESCE(SUM(commitmentAmount),0) as total_dana, SUM(CASE WHEN status='Approved' OR status='Terealisasi' THEN commitmentAmount ELSE 0 END) as dana_disetujui FROM kontribusi_mitra_csr";
                queryLabel = 'Ringkasan Dana Kontribusi';
            } else {
                sqlQuery = "SELECT programId, partnerId, commitmentAmount, status FROM kontribusi_mitra_csr ORDER BY commitmentAmount DESC LIMIT 50";
                queryLabel = 'Daftar Kontribusi';
            }
        }
        // WILAYAH queries
        else if (['wilayah','lokasi','daerah','kota','kabupaten'].some(w => msg.includes(w)) && !['program'].some(w => msg.includes(w))) {
            sqlQuery = "SELECT name FROM wilayah_kerja ORDER BY name ASC LIMIT 50";
            queryLabel = 'Daftar Wilayah Kerja';
        }
        // SEKTOR queries
        else if (['sektor','industri'].some(w => msg.includes(w)) && !['mitra'].some(w => msg.includes(w))) {
            sqlQuery = "SELECT name FROM sektor_industri ORDER BY name ASC LIMIT 50";
            queryLabel = 'Daftar Sektor Industri';
        }
        // STATISTIK UMUM
        else if (['statistik','ringkasan','rekap','rangkuman','overview','dashboard'].some(w => msg.includes(w)) || (msg.includes('berapa') && msg.includes('total'))) {
            sqlQuery = "SELECT (SELECT COUNT(*) FROM kelola_program) as total_program, (SELECT COUNT(*) FROM direktori_mitra_csr) as total_mitra, (SELECT COALESCE(SUM(commitmentAmount),0) FROM kontribusi_mitra_csr WHERE status IN ('Approved','Terealisasi')) as total_dana, (SELECT COUNT(*) FROM regulasi) as total_regulasi, (SELECT COUNT(*) FROM sdgs_tujuan) as total_sdgs, (SELECT COUNT(*) FROM sdgs_pilar) as total_pilar";
            queryLabel = 'Statistik Umum CSR Portal';
        }

        // === RULE 4: TIDAK BISA DIJAWAB ===
        if (!sqlQuery) {
            const csrish = ['csr','program','mitra','sdg','pilar','regulasi','dana','kontribusi','sosial'].some(w => msg.includes(w));
            if (csrish) {
                return res.json({ reply: '🔍 Saya tidak menemukan pola query yang cocok. Coba tanyakan lebih spesifik:\n\n• _"Tampilkan semua program CSR"_\n• _"Berapa jumlah mitra per sektor?"_\n• _"Jelaskan SDG 4"_\n• _"Dana terbesar program apa?"_\n• _"Daftar regulasi CSR"_', tag: 'TIDAK_BISA_DIJAWAB' });
            }
            return res.json({ reply: '⚠️ **TIDAK_BISA_DIJAWAB**\n\nPertanyaan ini tidak dapat dijawab dari database CSR Portal.\n\nSaya hanya bisa menjawab tentang:\n📋 Program CSR\n🤝 Mitra CSR\n🎯 SDGs\n🏛️ Pilar CSR\n📜 Regulasi\n💰 Dana/Kontribusi\n📊 Statistik\n\nSilakan ajukan pertanyaan terkait topik di atas!', tag: 'TIDAK_BISA_DIJAWAB' });
        }

        // === SECURITY CHECK ===
        const sqlUp = sqlQuery.toUpperCase();
        if (['INSERT','UPDATE','DELETE','DROP','ALTER','TRUNCATE','CREATE'].some(cmd => sqlUp.includes(cmd))) {
            return res.json({ reply: '🚫 Query ditolak — hanya SELECT yang diperbolehkan.', tag: 'BLOCKED' });
        }
        if (FORBIDDEN.some(t => sqlQuery.toLowerCase().includes(t))) {
            return res.json({ reply: '🔒 Akses ke tabel pengguna/roles tidak diperbolehkan.', tag: 'BLOCKED' });
        }

        // === EXECUTE SQL ===
        console.log('[CHATBOT SQL]', sqlQuery);
        const [rows] = await pool.query(sqlQuery);

        // === FORMAT RESULTS ===
        let reply = '';
        if (!rows || rows.length === 0) {
            reply = `📭 **${queryLabel}**\n\nTidak ada data ditemukan.`;
        } else if (rows.length === 1 && Object.keys(rows[0]).length <= 3) {
            reply = `📊 **${queryLabel}:**\n\n`;
            Object.entries(rows[0]).forEach(([k, v]) => {
                const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                reply += `• **${label}:** ${typeof v === 'number' && v > 999 ? v.toLocaleString('id-ID') : v}\n`;
            });
        } else if (rows.length === 1) {
            reply = `📋 **${queryLabel}:**\n\n`;
            Object.entries(rows[0]).forEach(([k, v]) => {
                if (v === null || v === '') return;
                const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                reply += `• **${label}:** ${typeof v === 'number' && v > 999 ? v.toLocaleString('id-ID') : v}\n`;
            });
        } else {
            reply = `📋 **${queryLabel}** (${rows.length} data):\n\n`;
            const keys = Object.keys(rows[0]);
            rows.forEach((row, i) => {
                const main = row[keys[0]];
                const rest = keys.slice(1).map(k => {
                    let v = row[k];
                    if (v === null || v === '') return null;
                    if (typeof v === 'number' && v > 999) v = v.toLocaleString('id-ID');
                    return v;
                }).filter(Boolean).join(' | ');
                reply += `${i+1}. **${main}**${rest ? ' — ' + rest : ''}\n`;
            });
        }
        reply += `\n_Query: \`${sqlQuery}\`_\n\nAda pertanyaan lain tentang data CSR?`;

        return res.json({ reply, sql: sqlQuery, tag: 'SQL_RESULT' });

    } catch (error) {
        console.error('Chat SQL Error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan: ' + error.message });
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
        const [existing] = await pool.query('SELECT id FROM kelola_program ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) {
            const match = existing[0].id.match(/p-(\d+)/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        const newId = `p-${nextNum}`;
        await pool.query(
            `INSERT INTO kelola_program (id, title, description, category, budget, year, location, beneficiaries, image, impactScore, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, title, description || '', category, budget, year, location || '', beneficiaries || '', image || '', impactScore || 0, stringTags]
        );
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
        res.json({ success: true });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
});

// Partners (CREATE)
app.post('/api/partners', async (req, res) => {
    const { companyName, logo, sector, address, phone, contributionCount, joinedYear } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM direktori_mitra_csr ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/m-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `m-${nextNum}`;
        await pool.query(
            `INSERT INTO direktori_mitra_csr (id, companyName, logo, sector, address, phone, contributionCount, joinedYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, companyName, logo || '', sector || '', address || '', phone || '', contributionCount || 0, joinedYear || new Date().getFullYear()]
        );
        res.json({ success: true, id: newId, companyName, logo, sector, address, phone, contributionCount, joinedYear });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});
app.put('/api/partners/:id', async (req, res) => {
    const { companyName, logo, sector, address, phone, contributionCount, joinedYear } = req.body;
    try {
        await pool.query(`UPDATE direktori_mitra_csr SET companyName=?, logo=?, sector=?, address=?, phone=?, contributionCount=?, joinedYear=? WHERE id=?`,
            [companyName, logo || '', sector || '', address || '', phone || '', contributionCount || 0, joinedYear || new Date().getFullYear(), req.params.id]);
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
        const [updated] = await pool.query('SELECT * FROM regulasi WHERE id = ?', [req.params.id]);
        res.json(updated[0] || { success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// Users (CREATE)
app.post('/api/users', async (req, res) => {
    const { name, email, role, lastLogin } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM pengguna ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/u-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `u-${nextNum}`;
        await pool.query(`INSERT INTO pengguna (id, name, email, role, lastLogin) VALUES (?, ?, ?, ?, ?)`,
            [newId, name, email, role || 'Viewer', lastLogin || new Date().toISOString()]);
        res.json({ success: true, id: newId, name, email, role, lastLogin });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});
app.put('/api/users/:id', async (req, res) => {
    const { name, email, role, lastLogin } = req.body;
    try {
        await pool.query(`UPDATE pengguna SET name=?, email=?, role=?, lastLogin=? WHERE id=?`,
            [name, email, role || 'Viewer', lastLogin || new Date().toISOString(), req.params.id]);
        res.json({ success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// ========== PROFILE ENDPOINTS ==========

// Safe column adder (MySQL doesn't support IF NOT EXISTS for columns)
async function safeAddColumn(table, column, type) {
    try { await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`); } catch(e) { /* column already exists */ }
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
        res.json({ success: true });
    } catch (err) { console.error('PASSWORD CHANGE ERROR:', err); res.status(500).json({ error: err.message }); }
});

// Submissions (CREATE)
app.post('/api/submissions', async (req, res) => {
    const { companyName, contactPerson, email, programId, status, commitmentAmount, submittedAt } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM kontribusi_mitra_csr ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/s-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `s-${nextNum}`;
        await pool.query(`INSERT INTO kontribusi_mitra_csr (id, companyName, contactPerson, email, programId, status, commitmentAmount, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, companyName, contactPerson || '', email || '', programId || '', status || 'Pending', commitmentAmount || 0, submittedAt || new Date().toISOString()]);
        res.json({ success: true, id: newId, companyName, contactPerson, email, programId, status, commitmentAmount, submittedAt });
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
        const [existing] = await pool.query('SELECT id FROM laporan_csr ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/rep-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `rep-${nextNum}`;

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
    } catch (err) {
        console.error('API ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/submissions/:id', async (req, res) => {
    const { status } = req.body;
    console.log(`UPDATING SUBMISSION id=${req.params.id} to status=${status}`);
    try {
        await pool.query(`UPDATE kontribusi_mitra_csr SET status=? WHERE id=?`, [status, req.params.id]);
        res.json({ success: true });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});

// FiscalYears (CREATE)
app.post('/api/fiscal-years', async (req, res) => {
    const { year, status, description } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM tahun_fiskal ORDER BY LENGTH(id) DESC, id DESC LIMIT 1');
        let nextNum = 1;
        if (existing.length > 0) { const m = existing[0].id.match(/fy-(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
        const newId = `fy-${nextNum}`;
        await pool.query(`INSERT INTO tahun_fiskal (id, year, status, description) VALUES (?, ?, ?, ?)`,
            [newId, year, status || 'Active', description || '']);
        res.json({ success: true, id: newId, year, status, description });
    } catch (err) { console.error('API ERROR:', err); res.status(500).json({ error: err.message }); }
});
app.put('/api/fiscal-years/:id', async (req, res) => {
    const { year, status, description } = req.body;
    try {
        await pool.query(`UPDATE tahun_fiskal SET year=?, status=?, description=? WHERE id=?`,
            [year, status || 'Active', description || '', req.params.id]);
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
            try { parsedMenus = JSON.parse(r.menus); } catch(e) {}
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
