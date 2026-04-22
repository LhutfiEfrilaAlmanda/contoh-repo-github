const express = require('express');
const router = express.Router();
const { pool } = require('../database.js');
const { createNotification } = require('../utils/helpers.js');
const { upload } = require('../middleware/upload.js');

// SDGs Tujuan
router.get('/sdgs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM sdgs_tujuan ORDER BY no_get ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sdgs', upload.single('gambar'), async (req, res) => {
    const { no_get, judul, keterangan, warna } = req.body;
    const PORT = process.env.PORT || 5000;
    const gambar = req.file ? `http://localhost:${PORT}/uploads/${req.file.filename}` : (req.body.gambar || '');
    try {
        const newId = `sdg-${no_get}`;
        await pool.query('INSERT INTO sdgs_tujuan (id, no_get, judul, keterangan, warna, gambar) VALUES (?,?,?,?,?,?)',
            [newId, no_get, judul, keterangan || '', warna || '#4c9f38', gambar]);
        await createNotification(`Tujuan SDG baru ditambahkan: ${judul}`, 'success');
        res.json({ success: true, id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/sdgs/:id', upload.single('gambar'), async (req, res) => {
    const { no_get, judul, keterangan, warna } = req.body;
    const PORT = process.env.PORT || 5000;
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sdgs/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM sdgs_pilar_mapping WHERE sdg_id = ?', [req.params.id]);
        await pool.query('DELETE FROM sdgs_tujuan WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pillars
router.get('/pillars', async (req, res) => {
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/pillars', async (req, res) => { // Fixed duplicate path logic in original server.js
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// SDGs Targets
router.get('/sdgs-targets', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, s.no_get as sdg_no, s.judul as sdg_judul
            FROM sdgs_target t
            LEFT JOIN sdgs_tujuan s ON t.sdg_id = s.id
            ORDER BY s.no_get ASC, t.kode_target ASC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sdgs-targets', async (req, res) => {
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/sdgs-targets/:id', async (req, res) => {
    const { sdg_id, kode_target, deskripsi } = req.body;
    try {
        await pool.query('UPDATE sdgs_target SET sdg_id=?, kode_target=?, deskripsi=? WHERE id=?',
            [sdg_id, kode_target, deskripsi || '', req.params.id]);
        await createNotification(`Target SDGs "${kode_target}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sdgs-targets/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM sdgs_indikator WHERE target_id = ?', [req.params.id]);
        await pool.query('DELETE FROM sdgs_target WHERE id = ?', [req.params.id]);
        await createNotification(`Target SDGs ID ${req.params.id} telah dihapus.`, 'warning');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// SDGs Indicators
router.get('/sdgs-indikators', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT i.*, t.kode_target, t.sdg_id, s.no_get as sdg_no, s.judul as sdg_judul
            FROM sdgs_indikator i
            LEFT JOIN sdgs_target t ON i.target_id = t.id
            LEFT JOIN sdgs_tujuan s ON t.sdg_id = s.id
            ORDER BY s.no_get ASC, t.kode_target ASC, i.kode_indikator ASC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sdgs-indikators', async (req, res) => {
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/sdgs-indikators/:id', async (req, res) => {
    const { target_id, kode_indikator, deskripsi, keterangan } = req.body;
    try {
        await pool.query('UPDATE sdgs_indikator SET target_id=?, kode_indikator=?, deskripsi=?, keterangan=? WHERE id=?',
            [target_id, kode_indikator, deskripsi || '', keterangan || '', req.params.id]);
        await createNotification(`Indikator SDGs "${kode_indikator}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sdgs-indikators/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM sdgs_indikator WHERE id = ?', [req.params.id]);
        await createNotification(`Indikator SDGs ID ${req.params.id} telah dihapus.`, 'warning');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
