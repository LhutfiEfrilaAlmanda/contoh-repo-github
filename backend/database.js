const mysql = require('mysql2/promise');
require('dotenv').config();

// =============================================
// KONFIGURASI KONEKSI MYSQL
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

            // PERAN_SISTEM
            await conn.query(`CREATE TABLE IF NOT EXISTS peran_sistem (
                id VARCHAR(191) PRIMARY KEY,
                role_name TEXT,
                description TEXT,
                columns_config TEXT,
                menus TEXT,
                color TEXT
            )`);
            try { await conn.query('ALTER TABLE peran_sistem ADD COLUMN columns_config TEXT'); } catch (e) { }

            // SDGS_TUJUAN
            await conn.query(`CREATE TABLE IF NOT EXISTS sdgs_tujuan (
                id VARCHAR(191) PRIMARY KEY,
                no_get INT,
                judul TEXT,
                keterangan TEXT,
                warna TEXT,
                gambar TEXT
            )`);
            try { await conn.query('ALTER TABLE sdgs_tujuan ADD COLUMN gambar TEXT'); } catch (e) { }

            // SDGS_PILAR
            await conn.query(`CREATE TABLE IF NOT EXISTS sdgs_pilar (
                id VARCHAR(191) PRIMARY KEY,
                kode_pilar TEXT,
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
                kode_target TEXT,
                deskripsi TEXT
            )`);

            // SDGS_INDIKATOR
            await conn.query(`CREATE TABLE IF NOT EXISTS sdgs_indikator (
                id VARCHAR(191) PRIMARY KEY,
                target_id VARCHAR(191),
                kode_indikator TEXT,
                deskripsi TEXT
            )`);

            // NOTIFIKASI (BARU)
            await conn.query(`CREATE TABLE IF NOT EXISTS notifikasi (
                id VARCHAR(191) PRIMARY KEY,
                message TEXT,
                type VARCHAR(50),
                is_read TINYINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // --- AUTO MIGRATIONS (MEMASTIKAN KOLOM BARU ADA) ---
            const alterTable = async (table, column, definition) => {
                try {
                    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                    console.log(`[DB MIGRATION] Added column ${column} to ${table}`);
                } catch (e) { /* Column likely exists */ }
            };

            // Migrasi untuk kelola_program
            await alterTable('kelola_program', 'impactScore', 'INT DEFAULT 0');
            await alterTable('kelola_program', 'tags', 'TEXT');
            await alterTable('kelola_program', 'beneficiaries', 'TEXT');
            await alterTable('kelola_program', 'image', 'TEXT');

            // Migrasi untuk pengguna
            await alterTable('pengguna', 'password', 'TEXT');
            await alterTable('pengguna', 'instansi', 'TEXT');
            await alterTable('pengguna', 'emailDinas', 'TEXT');
            await alterTable('sdgs_indikator', 'keterangan', 'TEXT');

            // Migrasi untuk kontribusi_mitra_csr
            await alterTable('kontribusi_mitra_csr', 'phone', 'VARCHAR(50)');

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

            await conn.query(`INSERT IGNORE INTO profil_organisasi (id, name, vision, mission, address, email, phone, website, licenseKey, logo) VALUES ('1', 'PT Tomo Teknologi Sinergi', 'Mewujudkan pembangunan daerah yang berkelanjutan melalui sinergi kemitraan strategis.', 'Memfasilitasi kolaborasi antara pemerintah dan sektor swasta secara transparan dan akuntabel.', 'Gedung Sate, Bandung', 'csr@pemda.go.id', '022-1234567', 'www.csr-pemda.go.id', 'MISC-7721-BNDG-2024', '')`);

            const [roleRows] = await conn.query('SELECT COUNT(*) as count FROM peran_sistem');
            if (roleRows[0].count === 0) {
                const initRoles = [
                    ['r-1', 'Administrator', 'Memiliki kendali penuh terhadap seluruh modul sistem dan pengaturan.', '[]', JSON.stringify(['Ringkasan', 'Data Induk', 'SDGs', 'Pilar', 'Tahun Fiskal', 'Program CSR', 'Mitra Industri', 'Regulasi', 'Laporan CSR', 'Pengguna', 'Profil Saya']), 'rose'],
                    ['r-2', 'Operator', 'Bertugas memasukkan data operasional program, mitra, dan mengelola laporan.', '[]', JSON.stringify(['Ringkasan', 'Program CSR', 'Mitra Industri', 'Laporan CSR', 'Profil Saya']), 'indigo'],
                    ['r-3', 'Verifikator', 'Bertugas melakukan verifikasi laporan dan persetujuan kontribusi.', '[]', JSON.stringify(['Ringkasan', 'Laporan CSR', 'Mitra Industri', 'Profil Saya']), 'emerald']
                ];
                for (const rol of initRoles) { await conn.query('INSERT IGNORE INTO peran_sistem (id, role_name, description, columns_config, menus, color) VALUES (?, ?, ?, ?, ?, ?)', rol); }
            }

            const [sdgRows] = await conn.query('SELECT COUNT(*) as count FROM sdgs_tujuan');
            if (sdgRows[0].count === 0) {
                const sdgs = [
                    ['sdg-1', 1, 'Tanpa Kemiskinan', 'Mengakhiri kemiskinan dalam segala bentuk di mana pun.', '#e5243b'],
                    ['sdg-2', 2, 'Tanpa Kelaparan', 'Mengakhiri kelaparan, mencapai ketahanan pangan, memperbaiki nutrisi, dan menggalakkan pertanian berkelanjutan.', '#dda63a'],
                    ['sdg-3', 3, 'Kehidupan Sehat dan Sejahtera', 'Menjamin kehidupan yang sehat dan meningkatkan kesejahteraan seluruh penduduk untuk semua usia.', '#4c9f38'],
                    ['sdg-4', 4, 'Pendidikan Berkualitas', 'Menjamin kualitas pendidikan yang inklusif dan merata serta meningkatkan kesempatan belajar sepanjang hayat untuk semua.', '#c5192d'],
                    ['sdg-5', 5, 'Kesetaraan Gender', 'Mencapai kesetaraan gender dan memberdayakan kaum perempuan.', '#ff3a21'],
                    ['sdg-6', 6, 'Air Bersih dan Sanitasi Layak', 'Menjamin ketersediaan serta pengelolaan air bersih dan sanitasi yang berkelanjutan untuk semua.', '#26bde2'],
                    ['sdg-7', 7, 'Energi Bersih dan Terjangkau', 'Menjamin akses terhadap energi yang terjangkau, andal, berkelanjutan, dan modern untuk semua.', '#fcc30b'],
                    ['sdg-8', 8, 'Pekerjaan Layak dan Pertumbuhan Ekonomi', 'Meningkatkan pertumbuhan ekonomi yang inklusif dan berkelanjutan, kesempatan kerja yang produktif dan menyeluruh, serta pekerjaan yang layak untuk semua.', '#a21942'],
                    ['sdg-9', 9, 'Industri, Inovasi, dan Infrastruktur', 'Membangun infrastruktur yang tangguh, meningkatkan industrialisasi inklusif dan berkelanjutan, serta mendorong inovasi.', '#fd6925'],
                    ['sdg-10', 10, 'Berkurangnya Kesenjangan', 'Mengurangi kesenjangan di dalam dan antarnegara.', '#dd1367'],
                    ['sdg-11', 11, 'Kota dan Komunitas Berkelanjutan', 'Menjadikan kota dan pemukiman inklusif, aman, tangguh, dan berkelanjutan.', '#fd9d24'],
                    ['sdg-12', 12, 'Konsumsi dan Produksi yang Bertanggung Jawab', 'Menjamin pola produksi dan konsumsi yang berkelanjutan.', '#bf8b2e'],
                    ['sdg-13', 13, 'Penanganan Perubahan Iklim', 'Mengambil tindakan cepat untuk mengatasi perubahan iklim dan dampaknya.', '#3f7e44'],
                    ['sdg-14', 14, 'Ekosistem Laut', 'Melestarikan dan memanfaatkan secara berkelanjutan sumber daya laut, samudra, dan ekosistem maritim.', '#0a97d9'],
                    ['sdg-15', 15, 'Ekosistem Daratan', 'Melindungi, merestorasi, dan meningkatkan pemanfaatan berkelanjutan ekosistem daratan, mengelola hutan secara berkelanjutan, menghentikan penggurunan, memulihkan degradasi lahan, serta menghentikan kehilangan keanekaragaman hayati.', '#56c02b'],
                    ['sdg-16', 16, 'Perdamaian, Keadilan, dan Kelembagaan yang Tangguh', 'Menguatkan masyarakat yang inklusif dan damai untuk pembangunan berkelanjutan, menyediakan akses keadilan untuk semua, dan membangun lembaga yang efektif, akuntabel, dan inklusif di semua tingkatan.', '#00689d'],
                    ['sdg-17', 17, 'Kemitraan untuk Mencapai Tujuan', 'Memperkuat sarana implementasi dan merevitalisasi kemitraan global untuk pembangunan berkelanjutan.', '#19486a']
                ];
                for (const s of sdgs) { await conn.query('INSERT IGNORE INTO sdgs_tujuan (id, no_get, judul, keterangan, warna) VALUES (?, ?, ?, ?, ?)', s); }
            }

            const [pilarRows] = await conn.query('SELECT COUNT(*) as count FROM sdgs_pilar');
            if (pilarRows[0].count === 0) {
                const initPillars = [
                    ['pil-1', 'P1', 'Ekonomi', 'Pilar pembangunan ekonomi untuk pertumbuhan berkelanjutan.'],
                    ['pil-2', 'P2', 'Kesehatan', 'Pilar pembangunan kesehatan dan kesejahteraan masyarakat.'],
                    ['pil-3', 'P3', 'Pendidikan', 'Pilar peningkatan kualitas sumber daya manusia melalui pendidikan.'],
                    ['pil-4', 'P4', 'Lingkungan', 'Pilar pelestarian lingkungan hidup dan perubahan iklim.']
                ];
                for (const p of initPillars) { await conn.query('INSERT IGNORE INTO sdgs_pilar (id, kode_pilar, nama_pilar, keterangan) VALUES (?, ?, ?, ?)', p); }

                const mapping = [
                    // P2 Kesehatan -> 2, 3, 6
                    ['map-1', 'pil-2', 'sdg-2'], ['map-2', 'pil-2', 'sdg-3'], ['map-3', 'pil-2', 'sdg-6'],
                    // P3 Pendidikan -> 4, 8, 10, 17
                    ['map-4', 'pil-3', 'sdg-4'], ['map-5', 'pil-3', 'sdg-8'], ['map-6', 'pil-3', 'sdg-10'], ['map-7', 'pil-3', 'sdg-17'],
                    // P4 Lingkungan -> 8, 12, 13
                    ['map-8', 'pil-4', 'sdg-8'], ['map-9', 'pil-4', 'sdg-12'], ['map-10', 'pil-4', 'sdg-13'],
                    // P1 Ekonomi -> 7, 9, 11
                    ['map-11', 'pil-1', 'sdg-7'], ['map-12', 'pil-1', 'sdg-9'], ['map-13', 'pil-1', 'sdg-11']
                ];
                for (const m of mapping) { await conn.query('INSERT IGNORE INTO sdgs_pilar_mapping (id, pilar_id, sdg_id) VALUES (?, ?, ?)', m); }
            }

            // SEED SDGS_TARGET
            const [targetRows] = await conn.query('SELECT COUNT(*) as count FROM sdgs_target');
            if (targetRows[0].count === 0) {
                const initTargets = [
                    ['tgt-1', 'sdg-5', '5.1', 'Mengakhiri segala bentuk diskriminasi terhadap kaum perempuan dan anak perempuan di mana saja.'],
                    ['tgt-2', 'sdg-5', '5.2', 'Menghapuskan segala bentuk kekerasan terhadap kaum perempuan dan anak perempuan di ruang publik dan pribadi, termasuk perdagangan orang dan eksploitasi seksual serta jenis eksploitasi lainnya.'],
                    ['tgt-3', 'sdg-2', '2.2', 'Pada tahun 2030, menghilangkan segala bentuk kekurangan gizi, termasuk pada tahun 2025 mencapai target yang disepakati secara internasional untuk penurunan stunting dan wasting pada balita, dan mengatasi kebutuhan gizi remaja perempuan, ibu hamil dan menyusui serta lansia.'],
                    ['tgt-4', 'sdg-3', '3.1', 'Pada tahun 2030, mengurangi rasio angka kematian ibu hingga kurang dari 70 per 100.000 kelahiran hidup.'],
                    ['tgt-5', 'sdg-3', '3.2', 'Pada tahun 2030, mengakhiri kematian bayi baru lahir dan balita yang dapat dicegah, dengan seluruh negara berusaha menurunkan angka kematian neonatal setidaknya hingga setingkat 12 per 1.000 kelahiran hidup dan angka kematian balita setidaknya hingga setingkat 25 per 1.000 kelahiran hidup.'],
                    ['tgt-6', 'sdg-4', '4.2', 'Pada tahun 2030, menjamin bahwa semua anak perempuan dan laki-laki memiliki akses terhadap perkembangan, pengasuhan, dan pendidikan anak usia dini yang berkualitas sehingga mereka siap untuk memasuki pendidikan dasar.'],
                    ['tgt-7', 'sdg-1', '1.3', 'Implementasikan secara nasional sistem dan langkah perlindungan sosial yang tepat bagi semua, termasuk cakupannya, dan pada tahun 2030 mencapai cakupan substansial bagi kelompok miskin dan rentan.'],
                    ['tgt-8', 'sdg-1', '1.4', 'Pada tahun 2030, menjamin bahwa seluruh laki-laki dan perempuan, khususnya masyarakat miskin dan rentan, memiliki hak yang sama terhadap sumber daya ekonomi, serta akses terhadap pelayanan dasar, kepemilikan dan kontrol atas tanah dan bentuk kepemilikan lain, warisan, sumber daya alam, teknologi baru yang sesuai dan jasa keuangan, termasuk keuangan mikro.'],
                    ['tgt-9', 'sdg-1', '1.2', 'Pada tahun 2030, mengurangi setidaknya setengah proporsi laki-laki, perempuan dan anak-anak dari semua usia yang hidup dalam kemiskinan dalam semua dimensi sesuai dengan definisi nasional.'],
                    ['tgt-10', 'sdg-1', '1.5', 'Pada tahun 2030, membangun ketahanan masyarakat miskin dan mereka yang berada dalam kondisi rentan, dan mengurangi kerentanan mereka terhadap kejadian ekstrim terkait iklim dan guncangan ekonomi, sosial, lingkungan dan bencana lainnya.'],
                    ['tgt-11', 'sdg-1', '1.a', 'Menjamin mobilisasi sumber daya yang signifikan dari berbagai sumber, termasuk melalui kerjasama pembangunan yang ditingkatkan, untuk menyediakan sarana yang memadai dan terprediksi bagi negara berkembang, khususnya negara kurang berkembang, untuk mengimplementasikan program dan kebijakan mengakhiri kemiskinan di semua dimensi.'],
                    ['tgt-12', 'sdg-1', '1.b', 'Membuat kerangka kebijakan yang kuat di tingkat nasional, regional dan internasional, berdasarkan strategi pembangunan yang memihak pada kelompok miskin dan peka gender, untuk mendukung investasi yang dipercepat dalam tindakan pemberantasan kemiskinan.']
                ];
                for (const t of initTargets) {
                    await conn.query('INSERT IGNORE INTO sdgs_target (id, sdg_id, kode_target, deskripsi) VALUES (?, ?, ?, ?)', t);
                }
                console.log('[SEED] Data Target SDGs berhasil ditambahkan.');
            }

            // SEED SDGS_INDIKATOR
            const [indikatorRows] = await conn.query('SELECT COUNT(*) as count FROM sdgs_indikator');
            if (indikatorRows[0].count === 0) {
                const initIndikators = [
                    ['ind-1', 'tgt-8', '1.4.1.(a)', 'Persentase perempuan pernah kawin umur 15-49 tahun yang proses melahirkan terakhirnya dibantu oleh tenaga kesehatan terlatih', 'Indikator nasional sebagai proksi indikator global'],
                    ['ind-2', 'tgt-7', '1.3.1.(d)', 'Jumlah rumah tangga yang mendapatkan bantuan pangan non-tunai (BPNT)', 'Indikator nasional sebagai tambahan indikator nasional'],
                    ['ind-3', 'tgt-8', '1.4.1', 'Proporsi penduduk/rumah tangga dengan akses terhadap pelayanan dasar', 'Indikator global yang memiliki proksi dan data'],
                    ['ind-4', 'tgt-7', '1.3.1.(b)', 'Proporsi peserta Program Jaminan Sosial Bidang Ketenagakerjaan', 'Indikator nasional sebagai proksi indikator global'],
                    ['ind-5', 'tgt-7', '1.3.1', 'Proporsi penduduk yang menerima program jaminan sosial, menurut jenis kelamin, kelompok usia', 'Indikator global yang memiliki proksi dan data'],
                    ['ind-6', 'tgt-7', '1.3.1.(a)', 'Proporsi peserta jaminan kesehatan melalui SJSN', 'Indikator nasional sebagai proksi indikator global']
                ];
                for (const i of initIndikators) {
                    await conn.query('INSERT IGNORE INTO sdgs_indikator (id, target_id, kode_indikator, deskripsi, keterangan) VALUES (?, ?, ?, ?, ?)', i);
                }
                console.log('[SEED] Data Indikator SDGs berhasil ditambahkan.');
            }

            // MIGRASI PERBAIKAN: Hubungkan Indikator Yatim (tanpa target_id) ke Target yang Benar
            try {
                await conn.query(`
                    UPDATE sdgs_indikator i
                    JOIN sdgs_target t ON (
                        i.kode_indikator LIKE CONCAT(t.kode_target, '.%') OR 
                        i.kode_indikator = t.kode_target
                    )
                    SET i.target_id = t.id
                    WHERE (i.target_id IS NULL OR i.target_id = '' OR i.target_id = 'null')
                `);
                console.log('[MIGRATION] Orphan indicators linked to targets.');
            } catch (migErr) {
                console.warn('[MIGRATION WARNING] Gagal sinkronisasi otomatis indikator:', migErr.message);
            }

            // SEED KELOLA_PROGRAM (Data Programs)
            const [progRows] = await conn.query('SELECT COUNT(*) as count FROM kelola_program');
            if (progRows[0].count === 0) {
                const progs = [
                    ['prog-1', 'Beasiswa Pendidikan Berkelanjutan', 'Pemberian beasiswa untuk 1000 siswa berprestasi.', 'Pendidikan', 500000000, 2024, 'Kabupaten Tasikmalaya', 'Pelajar SMA/SMK', '', 85, JSON.stringify(['Beasiswa', 'Pendidikan'])],
                    ['prog-2', 'Penghijauan DAS Citarum', 'Penanaman 10.000 pohon di sepanjang aliran sungai.', 'Lingkungan', 250000000, 2024, 'Lintas Wilayah', 'Masyarakat Sekitar', '', 92, JSON.stringify(['Lingkungan', 'CSR'])]
                ];
                for (const p of progs) { await conn.query('INSERT IGNORE INTO kelola_program (id, title, description, category, budget, year, location, beneficiaries, image, impactScore, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', p); }
            }

            // SEED MITRA (Data Partners)
            const [partnerRows] = await conn.query('SELECT COUNT(*) as count FROM direktori_mitra_csr');
            if (partnerRows[0].count === 0) {
                const partners = [
                    ['mitra-1', 'PT Bank Pembangunan Daerah', '', 'Perbankan', 'Bandung', '022-123456', 5, 2019],
                    ['mitra-2', 'PT Energi Hijau Nusantara', '', 'Energi', 'Jakarta', '021-998877', 3, 2021]
                ];
                for (const m of partners) { await conn.query('INSERT IGNORE INTO direktori_mitra_csr (id, companyName, logo, sector, address, phone, contributionCount, joinedYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', m); }
            }

            // SEED FISCAL YEAR
            const [fiscRows] = await conn.query('SELECT COUNT(*) as count FROM tahun_fiskal');
            if (fiscRows[0].count === 0) {
                const years = [
                    ['f-2023', 2023, 'Lalu', 'Tahun anggaran sebelumnya'],
                    ['f-2024', 2024, 'Aktif', 'Tahun anggaran berjalan']
                ];
                for (const y of years) { await conn.query('INSERT IGNORE INTO tahun_fiskal (id, year, status, description) VALUES (?, ?, ?, ?)', y); }
            }

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

module.exports = { get pool() { return pool; }, initDB };
