const express = require('express');
const router = express.Router();
const { pool } = require('../database.js');
const { getHandler, createNotification, sendWhatsapp } = require('../utils/helpers.js');

// Partners List
router.get('/partners', getHandler('direktori_mitra_csr'));

router.post('/partners', async (req, res) => {
    const { companyName, logo, sector, address, phone, contributionCount, joinedYear, name } = req.body;
    const finalName = companyName || name;
    try {
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
        res.json({ success: true, id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/partners/:id', async (req, res) => {
    const { companyName, logo, sector, address, phone, contributionCount, joinedYear, name } = req.body;
    const finalName = companyName || name;
    try {
        await pool.query(`UPDATE direktori_mitra_csr SET companyName=?, logo=?, sector=?, address=?, phone=?, contributionCount=?, joinedYear=? WHERE id=?`,
            [finalName, logo || '', sector || '', address || '', phone || '', contributionCount || 0, joinedYear || new Date().getFullYear(), req.params.id]);
        await createNotification(`Data mitra "${finalName}" telah diubah.`, 'info');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sectors
router.get('/sectors', getHandler('sektor_industri'));
router.post('/sectors', async (req, res) => {
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Submissions (Kontribusi)
router.get('/submissions', getHandler('kontribusi_mitra_csr'));

router.post('/submissions', async (req, res) => {
    const { companyName, contactPerson, email, phone, programId, status, commitmentAmount, submittedAt } = req.body;
    try {
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
        
        // WhatsApp Notifications
        const adminWA = process.env.ADMIN_WA_NUMBER;
        if (adminWA) {
            const [prog] = await pool.query('SELECT title FROM kelola_program WHERE id = ?', [programId]);
            const progTitle = prog[0]?.title || 'Program CSR';
            const adminMsg = `📢 *PENGAJUAN CSR BARU*\n\nDari: *${companyName}*\nKontak: ${contactPerson}\nProgram: ${progTitle}\nNilai: Rp ${Number(commitmentAmount).toLocaleString('id-ID')}\n\nSilakan cek dashboard admin untuk verifikasi.`;
            sendWhatsapp(adminWA, adminMsg);
        }

        if (phone) {
            const isApproved = (status === 'Terealisasi' || (status || '').toLowerCase() === 'approved');
            const [prog] = await pool.query('SELECT title FROM kelola_program WHERE id = ?', [programId]);
            const progTitle = prog[0]?.title || 'Program CSR';
            let clientMsg = isApproved 
                ? `Halo *${contactPerson || 'Mitra'}*,\n\nTerima kasih! Kontribusi perusahaan *${companyName}* untuk program *${progTitle}* senilai *Rp ${Number(commitmentAmount).toLocaleString('id-ID')}* telah berhasil diverifikasi.\n\nPartisipasi Anda sangat berarti bagi pembangunan daerah.`
                : `Halo *${contactPerson}*,\n\nTerima kasih atas partisipasi perusahaan *${companyName}* dalam program CSR kami. Pengajuan Anda telah kami terima dan saat ini sedang dalam proses verifikasi.`;
            sendWhatsapp(phone, clientMsg);
        }

        res.json({ success: true, id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/submissions/:id', async (req, res) => {
    const { status, companyName, contactPerson, phone, commitmentAmount, programId } = req.body;
    try {
        await pool.query(`UPDATE kontribusi_mitra_csr SET status = ? WHERE id = ?`, [status, req.params.id]);
        
        if (phone && (status === 'Terealisasi' || status.toLowerCase() === 'approved')) {
            const [prog] = await pool.query('SELECT title FROM kelola_program WHERE id = ?', [programId]);
            const progTitle = prog[0]?.title || 'Program CSR';
            const msg = `Halo *${contactPerson || 'Mitra'}*,\n\nKontribusi perusahaan *${companyName}* untuk program *${progTitle}* senilai *Rp ${Number(commitmentAmount).toLocaleString('id-ID')}* telah berhasil diverifikasi oleh Admin Portal CSR.\n\nTerima kasih atas partisipasi aktif Anda dalam pembangunan daerah.`;
            sendWhatsapp(phone, msg);
        }

        await createNotification(`Status kontribusi ${companyName} diubah menjadi ${status}`, 'success');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
