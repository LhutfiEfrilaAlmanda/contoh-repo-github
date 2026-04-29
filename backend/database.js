const mysql = require('mysql2/promise');
require('dotenv').config();

// =============================================
// KONFIGURASI KONEKSI MYSQL
// =============================================
const DB_NAME = process.env.DB_NAME || 'portal_csr';
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
};

// Pool TANPA database dulu (untuk auto-create)
let pool;

// Fungsi untuk memastikan database ada sebelum koneksi utama
async function ensureDatabase() {
    const tempPool = mysql.createPool(dbConfig); // tanpa database
    try {
        await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
        console.log(`Database "${DB_NAME}" siap.`);
    } finally {
        await tempPool.end();
    }
    // Buat pool utama DENGAN database
    pool = mysql.createPool({ ...dbConfig, database: DB_NAME });
}

async function initDB() {
    // LANGKAH 1: Pastikan database ada (auto-create jika belum)
    await ensureDatabase();

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

            // SEKTOR_INDUSTRI
            await conn.query(`CREATE TABLE IF NOT EXISTS sektor_industri (
                name VARCHAR(191) PRIMARY KEY
            )`);

            // WILAYAH_KERJA
            await conn.query(`CREATE TABLE IF NOT EXISTS wilayah_kerja (
                name VARCHAR(191) PRIMARY KEY
            )`);

            // KELOMPOK_PROGRAM
            await conn.query(`CREATE TABLE IF NOT EXISTS kelompok_program (
                name VARCHAR(191) PRIMARY KEY
            )`);

            // PENGGUNA
            await conn.query(`CREATE TABLE IF NOT EXISTS pengguna (
                id VARCHAR(191) PRIMARY KEY,
                name TEXT,
                email VARCHAR(191) UNIQUE,
                role TEXT,
                password TEXT,
                instansi TEXT,
                emailDinas TEXT,
                lastLogin TEXT
            )`);

            // NOTIFIKASI
            await conn.query(`CREATE TABLE IF NOT EXISTS notifikasi (
                id VARCHAR(191) PRIMARY KEY,
                message TEXT,
                type TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // KONTRIBUSI_MITRA_CSR
            await conn.query(`CREATE TABLE IF NOT EXISTS kontribusi_mitra_csr (
                id VARCHAR(191) PRIMARY KEY,
                companyName TEXT,
                contactPerson TEXT,
                email TEXT,
                phone TEXT,
                programId VARCHAR(191),
                partnerId VARCHAR(191),
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
                id_mitra VARCHAR(191),
                id_program VARCHAR(191)
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
                logo TEXT,
                licenseKey TEXT
            )`);

            // PERAN_SISTEM
            await conn.query(`CREATE TABLE IF NOT EXISTS peran_sistem (
                id VARCHAR(191) PRIMARY KEY,
                role_name VARCHAR(191) UNIQUE,
                description TEXT,
                menus TEXT,
                color TEXT
            )`);

            // SDGS_TUJUAN
            await conn.query(`CREATE TABLE IF NOT EXISTS sdgs_tujuan (
                id VARCHAR(191) PRIMARY KEY,
                no_get INT,
                judul TEXT,
                keterangan TEXT,
                warna TEXT,
                gambar TEXT
            )`);

            // SDGS_PILAR
            await conn.query(`CREATE TABLE IF NOT EXISTS sdgs_pilar (
                id VARCHAR(191) PRIMARY KEY,
                kode_pilar VARCHAR(191) UNIQUE,
                nama_pilar TEXT,
                keterangan TEXT
            )`);

            // SDGS_PILAR_MAPPING
            await conn.query(`CREATE TABLE IF NOT EXISTS sdgs_pilar_mapping (
                id VARCHAR(191) PRIMARY KEY,
                pilar_id VARCHAR(191),
                sdg_id VARCHAR(191)
            )`);

            // SDGS_TARGET
            await conn.query(`CREATE TABLE IF NOT EXISTS sdgs_target (
                id VARCHAR(191) PRIMARY KEY,
                sdg_id VARCHAR(191),
                kode_target VARCHAR(191) UNIQUE,
                deskripsi TEXT
            )`);

            // SDGS_INDIKATOR
            await conn.query(`CREATE TABLE IF NOT EXISTS sdgs_indikator (
                id VARCHAR(191) PRIMARY KEY,
                target_id VARCHAR(191),
                kode_indikator VARCHAR(191) UNIQUE,
                deskripsi TEXT,
                keterangan TEXT
            )`);

            // --- MIGRATIONS ---
            const [cols] = await conn.query("SHOW COLUMNS FROM pengguna LIKE 'password'");
            if (cols.length === 0) await conn.query("ALTER TABLE pengguna ADD COLUMN password TEXT");
            
            const [cols2] = await conn.query("SHOW COLUMNS FROM pengguna LIKE 'instansi'");
            if (cols2.length === 0) await conn.query("ALTER TABLE pengguna ADD COLUMN instansi TEXT");

            const [cols3] = await conn.query("SHOW COLUMNS FROM pengguna LIKE 'emailDinas'");
            if (cols3.length === 0) await conn.query("ALTER TABLE pengguna ADD COLUMN emailDinas TEXT");

            const [cols4] = await conn.query("SHOW COLUMNS FROM sdgs_indikator LIKE 'keterangan'");
            if (cols4.length === 0) await conn.query("ALTER TABLE sdgs_indikator ADD COLUMN keterangan TEXT");

            const [cols5] = await conn.query("SHOW COLUMNS FROM kontribusi_mitra_csr LIKE 'phone'");
            if (cols5.length === 0) await conn.query("ALTER TABLE kontribusi_mitra_csr ADD COLUMN phone TEXT");

            // --- SEEDING (Optional: Add your seeds here) ---
            
            conn.release();
            console.log('Inisialisasi database selesai.');
            return;
        } catch (err) {
            attempts++;
            console.error(`Gagal inisialisasi database (Attempt ${attempts}/5):`, err.message);
            if (attempts >= 5) process.exit(1);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

module.exports = { get pool() { return pool; }, initDB };
