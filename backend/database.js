const mysql = require('mysql2/promise');
require('dotenv').config();

// =============================================
// KONFIGURASI KONEKSI MYSQL
// Gunakan environment variables untuk production
// =============================================
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'portal_csr',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDB() {
    let attempts = 0;
    while (attempts < 5) {
        try {
            const conn = await pool.getConnection();
            console.log('Terhubung ke MySQL database.');

            // KELOLA_PROGRAM
            await conn.query(`CREATE TABLE IF NOT EXISTS kelola_program (
                id VARCHAR(191) PRIMARY KEY,
                title TEXT,
                description TEXT,
                category TEXT,
                budget BIGINT,
                year INT,
                location TEXT,
                beneficiaries TEXT,
                image TEXT,
                impactScore INT,
                tags TEXT
            )`);

            // DIREKTORI_MITRA_CSR
            await conn.query(`CREATE TABLE IF NOT EXISTS direktori_mitra_csr (
                id VARCHAR(191) PRIMARY KEY,
                companyName TEXT,
                logo TEXT,
                sector TEXT,
                address TEXT,
                phone TEXT,
                contributionCount INT,
                joinedYear INT
            )`);

            // REGULASI
            await conn.query(`CREATE TABLE IF NOT EXISTS regulasi (
                id VARCHAR(191) PRIMARY KEY,
                title TEXT,
                number TEXT,
                year INT,
                type TEXT,
                description TEXT,
                fileSize TEXT,
                fileUrl TEXT
            )`);

            // PENGGUNA
            await conn.query(`CREATE TABLE IF NOT EXISTS pengguna (
                id VARCHAR(191) PRIMARY KEY,
                name TEXT,
                email TEXT,
                role TEXT,
                lastLogin TEXT
            )`);

            // KONTRIBUSI_MITRA_CSR
            await conn.query(`CREATE TABLE IF NOT EXISTS kontribusi_mitra_csr (
                id VARCHAR(191) PRIMARY KEY,
                companyName TEXT,
                contactPerson TEXT,
                email TEXT,
                programId TEXT,
                status TEXT,
                commitmentAmount BIGINT,
                submittedAt TEXT
            )`);

            // LAPORAN_CSR
            await conn.query(`CREATE TABLE IF NOT EXISTS laporan_csr (
                id VARCHAR(191) PRIMARY KEY,
                nama_file TEXT,
                tipe_file TEXT,
                ukuran_file TEXT,
                path_url TEXT,
                diunggah_oleh TEXT,
                tanggal_unggah TEXT,
                id_mitra TEXT,
                id_program TEXT
            )`);

            // KELOMPOK_PROGRAM
            await conn.query(`CREATE TABLE IF NOT EXISTS kelompok_program (
                name VARCHAR(191) PRIMARY KEY
            )`);

            // SEKTOR_INDUSTRI
            await conn.query(`CREATE TABLE IF NOT EXISTS sektor_industri (
                name VARCHAR(191) PRIMARY KEY
            )`);

            // WILAYAH_KERJA
            await conn.query(`CREATE TABLE IF NOT EXISTS wilayah_kerja (
                name VARCHAR(191) PRIMARY KEY
            )`);

            // TAHUN_FISKAL
            await conn.query(`CREATE TABLE IF NOT EXISTS tahun_fiskal (
                id VARCHAR(191) PRIMARY KEY,
                year INT,
                status TEXT,
                description TEXT
            )`);

            // PROFIL_ORGANISASI
            await conn.query(`CREATE TABLE IF NOT EXISTS profil_organisasi (
                id VARCHAR(191) PRIMARY KEY,
                name TEXT,
                vision TEXT,
                mission TEXT,
                address TEXT,
                email TEXT,
                phone TEXT,
                website TEXT,
                licenseKey TEXT,
                logo TEXT
            )`);

            // --- SEED SECTIONS ---
            const [regRows] = await conn.query('SELECT COUNT(*) as count FROM regulasi');
            if (regRows[0].count === 0) {
                const regs = [
                    ['reg-1', 'Peraturan Daerah tentang Tanggung Jawab Sosial Perusahaan', 'Perda No. 5 Tahun 2022', 2022, 'Peraturan Daerah', 'Mekanisme pelaksanaan CSR.', '2.4 MB', ''],
                    ['reg-2', 'Pedoman Teknis Pelaksanaan CSR', 'Pergub No. 12 Tahun 2023', 2023, 'Peraturan Gubernur', 'Panduan teknis CSR.', '1.8 MB', '']
                ];
                for (const r of regs) { await conn.query('INSERT IGNORE INTO regulasi (id, title, number, year, type, description, fileSize, fileUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', r); }
            }

            const [catRows] = await conn.query('SELECT COUNT(*) as count FROM kelompok_program');
            if (catRows[0].count === 0) {
                for (const c of ['Ekonomi', 'Pendidikan', 'Kesehatan', 'Lingkungan']) {
                    await conn.query('INSERT IGNORE INTO kelompok_program (name) VALUES (?)', [c]);
                }
            }

            const [secRows] = await conn.query('SELECT COUNT(*) as count FROM sektor_industri');
            if (secRows[0].count === 0) {
                for (const s of ['Manufaktur', 'Perbankan', 'Teknologi', 'Energi']) {
                    await conn.query('INSERT IGNORE INTO sektor_industri (name) VALUES (?)', [s]);
                }
            }

            const [locRows] = await conn.query('SELECT COUNT(*) as count FROM wilayah_kerja');
            if (locRows[0].count === 0) {
                for (const l of ['Kabupaten Tasikmalaya', 'Kecamatan Cibalong', 'Kota Tasikmalaya']) {
                    await conn.query('INSERT IGNORE INTO wilayah_kerja (name) VALUES (?)', [l]);
                }
            }

            await conn.query(
                `INSERT IGNORE INTO profil_organisasi (id, name, vision, mission, address, email, phone, website, licenseKey, logo) 
                 VALUES ('1', 'PT Tomo Teknologi Sinergi', 'Mewujudkan pembangunan daerah yang berkelanjutan melalui sinergi kemitraan strategis.', 'Memfasilitasi kolaborasi antara pemerintah dan sektor swasta secara transparan dan akuntabel.', 'Gedung Sate, Bandung', 'csr@pemda.go.id', '022-1234567', 'www.csr-pemda.go.id', 'MISC-7721-BNDG-2024', '')`
            );

            conn.release();
            console.log('Inisialisasi database dan seed selesai.');
            return;
        } catch (err) {
            attempts++;
            console.error(`Gagal inisialisasi database (Attempt ${attempts}/5):`, err.message);
            if (attempts >= 5) process.exit(1);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

module.exports = { pool, initDB };
