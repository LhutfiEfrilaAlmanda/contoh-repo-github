const express = require('express');
const router = express.Router();
const { pool } = require('../database.js');
const { getHandler, createNotification } = require('../utils/helpers.js');

// Programs List
router.get('/programs', async (req, res) => {
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/programs', async (req, res) => {
    const { title, description, category, budget, year, location, beneficiaries, image, impactScore, tags } = req.body;
    const stringTags = tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : '[]';
    try {
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
        res.json({ success: true, id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/programs/:id', async (req, res) => {
    const { title, description, category, budget, year, location, beneficiaries, image, impactScore, tags } = req.body;
    const stringTags = tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : '[]';
    try {
        await pool.query(
            `UPDATE kelola_program SET title=?, description=?, category=?, budget=?, year=?, location=?, beneficiaries=?, image=?, impactScore=?, tags=? WHERE id=?`,
            [title, description || '', category, budget, year, location || '', beneficiaries || '', image || '', impactScore || 0, stringTags, req.params.id]
        );
        await createNotification(`Program "${title}" telah diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Categories, Locations, Fiscal Years
router.get('/categories', getHandler('kelompok_program', r => r.name));
router.get('/locations', getHandler('wilayah_kerja'));
router.get('/fiscal-years', getHandler('tahun_fiskal'));

router.post('/categories', async (req, res) => {
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/locations', async (req, res) => {
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/fiscal-years', async (req, res) => {
    const { year, status, description } = req.body;
    try {
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
        res.json({ success: true, id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/fiscal-years/:id', async (req, res) => {
    const { year, status, description } = req.body;
    try {
        await pool.query(`UPDATE tahun_fiskal SET year=?, status=?, description=? WHERE id=?`,
            [year, status || 'Active', description || '', req.params.id]);
        await createNotification(`Tahun fiskal ${year} diperbarui.`, 'info');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
