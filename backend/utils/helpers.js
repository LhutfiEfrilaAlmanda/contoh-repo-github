const axios = require('axios');
const path = require('path');
const db = require('../database.js');

// NOTIFICATION HELPER
const createNotification = async (message, type = 'info') => {
    try {
        const id = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await db.pool.query('INSERT INTO notifikasi (id, message, type) VALUES (?, ?, ?)', [id, message, type]);
        console.log('[NOTIF]', message);
    } catch (err) { console.error('Failed to create notification:', err); }
};

// HELPER: KIRIM WHATSAPP VIA FONNTE
async function sendWhatsapp(target, message) {
    const token = process.env.FONNTE_TOKEN;
    if (!token || !target) {
        console.warn('[WA SKIP] Token atau Target kosong');
        return;
    }

    let formattedTarget = target.toString().replace(/[^0-9]/g, '');
    if (formattedTarget.startsWith('0')) {
        formattedTarget = '62' + formattedTarget.slice(1);
    }

    try {
        console.log(`[WA ATTEMPT] Mengirim ke ${formattedTarget}...`);
        const response = await axios.post('https://api.fonnte.com/send', {
            target: formattedTarget,
            message: message
        }, {
            headers: { 'Authorization': token }
        });
        
        if (response.data && response.data.status) {
            console.log('[WA SUCCESS]', formattedTarget);
        } else {
            console.error('[WA FAILED]', formattedTarget, response.data?.reason || 'Unknown Reason');
        }
    } catch (err) {
        console.error('[WA ERROR]', formattedTarget, err.response?.data?.reason || err.message);
    }
}

// GET all rows from a table
const getHandler = (tableName, mapFunc) => async (req, res) => {
    try {
        let orderBy = '';
        if (['kelompok_program', 'sektor_industri', 'wilayah_kerja'].includes(tableName)) {
            orderBy = ' ORDER BY name ASC';
        } else if (['kelola_program', 'direktori_mitra_csr', 'regulasi', 'pengguna', 'kontribusi_mitra_csr'].includes(tableName)) {
            orderBy = ' ORDER BY LENGTH(id), id ASC';
        }
        const [rows] = await db.pool.query(`SELECT * FROM ${tableName}${orderBy}`);
        res.json(mapFunc ? rows.map(mapFunc) : rows);
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
};

// DELETE by id
const deleteHandler = (tableName, idField = 'id') => async (req, res) => {
    try {
        const monitoredTables = [
            'kelola_program', 'direktori_mitra_csr', 'regulasi', 
            'pengguna', 'kontribusi_mitra_csr', 'tahun_fiskal', 
            'kelompok_program', 'sektor_industri', 'wilayah_kerja', 'peran_sistem'
        ];
        if (monitoredTables.includes(tableName)) {
            const [rows] = await db.pool.query(`SELECT * FROM ${tableName} WHERE ${idField} = ?`, [req.params.id]);
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
        
        const [result] = await db.pool.query(`DELETE FROM ${tableName} WHERE ${idField} = ?`, [req.params.id]);
        res.json({ success: true, changes: result.affectedRows });
    } catch (err) {
        console.error('API ERROR:', err); res.status(500).json({ error: err.message });
    }
};

// Safe column adder
async function safeAddColumn(table, column, type) {
    try { await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`); } catch (e) { /* column already exists */ }
}

// Ensure profile columns initialization
let profileMigrated = false;
async function ensureProfileColumns() {
    if (profileMigrated) return;
    await safeAddColumn('pengguna', 'password', 'TEXT');
    await safeAddColumn('pengguna', 'instansi', 'TEXT');
    await safeAddColumn('pengguna', 'emailDinas', 'TEXT');
    profileMigrated = true;
}

module.exports = {
    createNotification,
    sendWhatsapp,
    getHandler,
    deleteHandler,
    safeAddColumn,
    ensureProfileColumns
};
