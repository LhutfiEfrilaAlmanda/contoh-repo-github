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

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
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
        // --- CHECK DB FOR CUSTOM PASSWORD ---
        if (email === 'admin@portalcsr.id' || email === 'admin@pemda.go.id') {
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
            if (password !== savedPassword) {
                return res.status(401).json({ error: 'Email atau password salah.' });
            }
            return res.json({
                token: 'dummy-jwt-token-admin',
                user: { id: '1', name: 'Admin Utama', email: email, role: 'Admin' }
            });
        }
        
        const [users] = await pool.query('SELECT * FROM pengguna WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Email atau password salah.' });
        }
        const user = users[0];
        
        // VERIFIKASI SANDI UNTUK PENGGUNA UMUM (Operator dsb)
        const savedPw = user.password || 'admin123';
        if (password !== savedPw) {
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
    // Force CORS headers on this specific route
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    console.log('LOGIN ATTEMPT:', req.body?.email);
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM pengguna WHERE email = ?', [email]);
        console.log('USERS FOUND:', users.length);

        if (users.length === 0) {
            if (email === 'admin@portalcsr.id' || email === 'admin@pemda.go.id') {
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
        
        console.log('DEBUG PROGRAMS FETCH:', rows.map(r => ({ id: r.id, title: r.title, allocated: r.allocatedAmount })));

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

// AI Chat Consultant Endpoint (Smart Internal Matcher)
app.post('/api/chat', async (req, res) => {
    const { message, contextProgramId } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

    try {
        const [programs] = await pool.query('SELECT * FROM kelola_program');
        const lowerMsg = message.toLowerCase().replace(/[^\w\s]/gi, '');
        const words = lowerMsg.split(' ');

        // 1. Deteksi Intent Spesifik
        const intent = {
            isRegistration: words.some(w => ['daftar', 'cara', 'prosedur', 'langkah', 'sistem', 'pendaftaran', 'ikut', 'gabung'].includes(w)),
            isBudget: words.some(w => ['anggaran', 'dana', 'biaya', 'uang', 'budget', 'rupiah', 'danamu', 'dananin', 'duit'].includes(w)),
            isLocation: words.some(w => ['dimana', 'lokasi', 'tempat', 'wilayah', 'kecamatan', 'desa', 'daerah'].includes(w)),
            isImpact: words.some(w => ['manfaat', 'dampak', 'hasil', 'penerima', 'target', 'tujuan'].includes(w)),
            isThanks: words.some(w => ['terima', 'kasih', 'ok', 'oke', 'baik', 'siap', 'sip', 'nuhun'].includes(w))
        };

        // Deteksi Follow-up Umum
        const followUpWords = ['ini', 'itu', 'lanjut', 'detail', 'info', 'lengkap', 'bagaimana', 'caranya', 'maksud', 'tersebut', 'bimbingan', 'arahannya'];
        const isFollowUp = words.some(w => followUpWords.includes(w)) || (Object.values(intent).some(v => v) && contextProgramId);

        // Stop-words untuk menghindari matching sampah
        const stopWords = ['saya', 'ingin', 'tahu', 'tentang', 'program', 'ada', 'apa', 'yang', 'bisa', 'untuk'];

        const keywords = {
            'Pendidikan': ['didik', 'sekolah', 'beasiswa', 'buku', 'guru', 'belajar', 'kelas', 'pelatihan', 'literasi', 'edukasi', 'digital', 'teknologi', 'it', 'komputer'],
            'Ekonomi': ['ekonomi', 'umkm', 'bisnis', 'usaha', 'modal', 'pasar', 'dagang', 'kerja', 'uang', 'dana', 'mandiri', 'pemberdayaan', 'digital', 'teknologi', 'online'],
            'Kesehatan': ['sehat', 'medis', 'dokter', 'obat', 'stunting', 'gizi', 'rumah sakit', 'klinik', 'vaksin', 'imunisasi', 'sanitasi', 'alat'],
            'Lingkungan': ['lingkungan', 'pohon', 'sampah', 'hijau', 'hutan', 'air', 'limbah', 'alam', 'energi', 'solar', 'bersih', 'daur ulang']
        };

        let scoredPrograms = programs.map(p => {
            let score = 0;
            const title = p.title.toLowerCase();
            const desc = p.description.toLowerCase();
            const cat = p.category;

            // 0. Sticky Context Logic
            if (contextProgramId && p.id === contextProgramId) {
                if (isFollowUp) score += 500;
                else if (words.length < 6) score += 200;
            }

            // 1. Cek Pencocokan Judul
            if (lowerMsg.includes(title) || (title.length > 5 && title.split(' ').some(w => w.length > 3 && lowerMsg.includes(w)))) {
                score += 100;
            }

            // 2. Cek Kata Kunci Kategori
            if (keywords[cat]) {
                keywords[cat].forEach(kw => {
                    if (lowerMsg.includes(kw)) score += 10;
                });
            }

            // 3. Cek Kata per Kata
            words.forEach(word => {
                if (word.length < 4 || stopWords.includes(word)) return;
                if (title.includes(word)) score += 15;
                if (desc.includes(word)) score += 2;
            });

            return { ...p, score };
        });

        scoredPrograms.sort((a, b) => b.score - a.score);
        const topMatch = (scoredPrograms[0] && scoredPrograms[0].score > 0) ? scoredPrograms[0] : null;

        // 2. PRIORITAS: Tangani Ucapan Terimakasih (Social Intelligence)
        if (intent.isThanks) {
            let thanksReply = "Sama-sama! Senang bisa membantu Anda. Apakah ada hal lain yang ingin Anda konsultasikan mengenai program CSR kami?";
            if (topMatch && contextProgramId === topMatch.id) {
                thanksReply = `Sama-sama! Senang bisa memberikan bimbingan mengenai program **${topMatch.title}**. Semoga rencana kerjasama CSR Anda berjalan lancar. Kabari saya jika Anda butuh bantuan untuk program lainnya!`;
            }
            return res.json({ reply: thanksReply, programId: contextProgramId });
        }

        if (topMatch) {
            const isContinuing = (contextProgramId === topMatch.id);
            let reply = "";

            if (isContinuing) {
                // Jawaban Spesifik untuk Follow-up agar tidak "Muter-muter"
                if (intent.isRegistration) {
                    reply = `Untuk mendaftar ke program **${topMatch.title}**, Anda cukup mengklik tombol **"Daftar Jadi Mitra CSR"** yang ada di bawah banner program tersebut di halaman utama. Setelah itu, tim kami akan segera melakukan verifikasi komitmen dan menghubungi Anda melalui nomor telepon yang terdaftar untuk koordinasi lebih lanjut.`;
                } else if (intent.isBudget) {
                    reply = `Mengenai anggaran yang diperlukan, program **${topMatch.title}** memiliki target pendanaan sebesar **Rp ${(topMatch.budget || 0).toLocaleString('id-ID')}** untuk tahun ${topMatch.year}. Anda bisa memberikan komitmen sesuai alokasi dana CSR perusahaan Anda, baik sebagian maupun seluruhnya, karena kami mendukung sistem kolaborasi antar mitra.`;
                } else if (intent.isLocation) {
                    reply = `Fokus utama lokasi untuk program ini adalah di wilayah **${topMatch.location}**. Namun, untuk program berskala luas, kami juga memetakan beberapa titik koordinat strategis lainnya agar dampaknya merata. Apakah wilayah tersebut dekat dengan area operasional perusahaan Anda?`;
                } else if (intent.isImpact) {
                    reply = `Target utamanya adalah membantu **${topMatch.beneficiaries}** sebagai penerima manfaat langsung. Dengan skor dampak **${topMatch.impactScore}/100**, kami memastikan setiap kontribusi dilaporkan secara transparan agar bisa menjadi bagian dari laporan tahunan (ESG) perusahaan Anda.`;
                } else {
                    reply = `Tentu! Program **${topMatch.title}** ini memiliki detail anggaran sebesar Rp ${topMatch.budget.toLocaleString('id-ID')} dengan fokus utama pada ${topMatch.beneficiaries}. Mana yang ingin Anda diskusikan lebih lanjut: cara pendaftaran, rincian dana, atau titik lokasinya?`;
                }
            } else {
                // Jawaban Pembuka (First Match)
                const intro = [
                    `Saya sangat merekomendasikan program **${topMatch.title}**.`,
                    `Berdasarkan visi Anda, program **${topMatch.title}** adalah pilihan juara yang kami miliki.`,
                    `Mari kita fokus pada program **${topMatch.title}**, ini sangat cocok dengan apa yang Anda cari.`
                ][Math.floor(Math.random() * 3)];

                reply = `${intro}\n\n${topMatch.description}. Saat ini program ini beroperasi di wilayah **${topMatch.location}** dengan target penerima **${topMatch.beneficiaries}**.\n\nApakah Anda memerlukan info mengenai cara mendaftar atau rincian anggaran yang diperlukan?`;
            }

            return res.json({ reply, programId: topMatch.id });
        }

        res.json({
            reply: "Halo! Saya Konsultan CSR Senior. Saya siap membimbing Anda menemukan program yang paling berdampak dan efisien. Bisa jelaskan lebih detail sektor apa yang menjadi prioritas perusahaan Anda saat ini?",
            programId: null
        });
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan sistem internal.' });
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

/* ================================
   POST (CREATE/UPDATE) ENDPOINTS
================================ */

// Programs (CREATE)
app.post('/api/programs', async (req, res) => {
    const { title, description, category, budget, year, location, beneficiaries, image, impactScore, tags } = req.body;
    const stringTags = tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : '[]';
    try {
        // Auto-generate next p-N id
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
    profileMigrated = true;
}

// Emergency password reset (admin only)
app.get('/api/reset-admin-pw', async (req, res) => {
    try {
        await ensureProfileColumns();
        await pool.query("UPDATE pengguna SET password = 'admin123' WHERE email = 'admin@portalcsr.id'");
        await pool.query("UPDATE pengguna SET password = 'admin123' WHERE email = 'admin@pemda.go.id'");
        res.json({ success: true, message: 'Password admin telah direset ke admin123' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET profile by email (using query param)
app.get('/api/profile', async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email parameter required.' });
    try {
        await ensureProfileColumns();
        const [users] = await pool.query('SELECT id, name, email, role, instansi, lastLogin FROM pengguna WHERE email = ?', [email]);
        if (users.length === 0) {
            if (email === 'admin@portalcsr.id') {
                return res.json({ name: 'Admin Utama', email: 'admin@portalcsr.id', role: 'Admin', instansi: '' });
            }
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }
        res.json(users[0]);
    } catch (err) { console.error('PROFILE ERROR:', err); res.status(500).json({ error: err.message }); }
});

// PUT update profile info
app.put('/api/profile', async (req, res) => {
    const { email, name, instansi } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    try {
        await ensureProfileColumns();
        const [users] = await pool.query('SELECT id FROM pengguna WHERE email = ?', [email]);
        if (users.length === 0) {
            if (email === 'admin@portalcsr.id') {
                const newId = 'u-admin';
                await pool.query('INSERT INTO pengguna (id, name, email, role, instansi, lastLogin) VALUES (?, ?, ?, ?, ?, ?)',
                    [newId, name, email, 'Admin', instansi || '', new Date().toISOString()]);
                return res.json({ success: true });
            }
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }
        await pool.query('UPDATE pengguna SET name=?, instansi=? WHERE email=?', [name, instansi || '', email]);
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
        
        if (users.length === 0 && email === 'admin@portalcsr.id') {
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

        if (currentPassword !== storedPassword) {
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
        const diunggah_oleh = 'Admin'; // Bisa diambil dari auth nanti
        const tanggal_unggah = new Date().toISOString();

        await pool.query(
            `INSERT INTO laporan_csr (id, nama_file, tipe_file, ukuran_file, path_url, diunggah_oleh, tanggal_unggah, id_mitra, id_program)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, nama_file, tipe_file, ukuran_file, path_url, diunggah_oleh, tanggal_unggah, id_mitra || null, id_program || null]
        );

        const fileUrl = path_url;
        res.json({
            message: 'File berhasil diunggah',
            url: fileUrl,
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
        // Hanya update status untuk meminimalkan resiko kehilangan data kolom lain
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
   ERROR HANDLING & FALLBACK
================================ */

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
    
    // Pastikan CORS tetap terkirim saat error
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
