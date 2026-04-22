const express = require('express');
const router = express.Router();
const path = require('path');
const { pool } = require('../database.js');
const { createNotification } = require('../utils/helpers.js');
const { upload, uploadReport } = require('../middleware/upload.js');

// Dashboard Stats
router.get('/stats/dashboard', async (req, res) => {
    try {
        const [programs] = await pool.query('SELECT COUNT(*) as total FROM kelola_program');
        const [partners] = await pool.query('SELECT COUNT(*) as total FROM direktori_mitra_csr');
        const [reports] = await pool.query('SELECT COUNT(*) as total FROM laporan_csr');
        const [totalDana] = await pool.query("SELECT COALESCE(SUM(commitmentAmount), 0) as total FROM kontribusi_mitra_csr WHERE status IN ('Approved', 'Terealisasi')");

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

        const [regions] = await pool.query(`
            SELECT location as name, COUNT(*) as count
            FROM kelola_program
            WHERE location IS NOT NULL AND location != ''
            GROUP BY location
            ORDER BY count DESC
        `);

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
    } catch (error) { res.status(500).json({ error: 'Gagal mengambil statistik.' }); }
});

// Notifications
router.get('/notifications', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM notifikasi ORDER BY created_at DESC LIMIT 50');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notifications', async (req, res) => {
    try {
        await pool.query('DELETE FROM notifikasi');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notifications/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM notifikasi WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notifications/read-all', async (req, res) => {
    try {
        await pool.query('UPDATE notifikasi SET is_read = 1');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reports (Laporan CSR)
router.get('/reports', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM laporan_csr ORDER BY tanggal_unggah DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reports/upload', uploadReport.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { id_mitra, id_program } = req.body;
    try {
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
        
        await pool.query(
            `INSERT INTO laporan_csr (id, nama_file, tipe_file, ukuran_file, path_url, diunggah_oleh, tanggal_unggah, id_mitra, id_program)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, nama_file, tipe_file, ukuran_file, path_url, 'Admin', new Date().toISOString(), id_mitra || null, id_program || null]
        );
        await createNotification(`Laporan CSR baru diunggah: ${nama_file}`, 'success');
        res.json({ success: true, url: path_url, data: { id: newId, nama_file, ukuran_file, tipe_file } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Org Profile
router.get('/org-profile', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM profil_organisasi LIMIT 1');
        res.json(rows[0] || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/org-profile', async (req, res) => {
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Role Management
router.get('/roles', async (req, res) => {
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

router.post('/roles', async (req, res) => {
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

router.put('/roles/:id', async (req, res) => {
    const { role_name, description, menus, color } = req.body;
    try {
        const menusStr = JSON.stringify(Array.isArray(menus) ? menus : []);
        await pool.query('UPDATE peran_sistem SET role_name=?, description=?, menus=?, color=? WHERE id=?',
            [role_name, description, menusStr, color, req.params.id]);
        await createNotification(`Pengaturan peran "${role_name}" telah diubah.`, 'info');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Generic Upload
router.post('/upload', upload.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const PORT = process.env.PORT || 5000;
    const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

module.exports = router;
