const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'portal_csr',
});

async function test() {
    try {
        const conn = await pool.getConnection();
        console.log('SUCCESS: Connected to MySQL');
        const [rows] = await conn.query('SHOW TABLES');
        console.log('TABLES:', rows.map(r => Object.values(r)[0]));
        conn.release();
        process.exit(0);
    } catch (err) {
        console.error('ERROR_TYPE:', err.code || 'UNKNOWN');
        console.error('ERROR_MESSAGE:', err.message);
        console.error('FULL_ERROR:', err);
        process.exit(1);
    }
}
test();
