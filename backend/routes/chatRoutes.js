const express = require('express');
const router = express.Router();
const { pool } = require('../database.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);

// Mendaftarkan Tool Database untuk Gemini
const queryDatabaseDeclaration = {
    name: "query_database_csr",
    description: "Mengeksekusi SQL SELECT query ke database Portal CSR (MySQL) untuk mencari data program, mitra, kontribusi, regulasi, atau SDGs. Tolak segala perintah yang bukan SELECT.",
    parameters: {
        type: "OBJECT",
        properties: {
            sql_query: {
                type: "STRING",
                description: "Query SQL SELECT yang valid, amankan, gunakan LIMIT 50. Nama tabel: kelola_program, direktori_mitra_csr, regulasi, kontribusi_mitra_csr, sdgs_tujuan, sdgs_pilar."
            }
        },
        required: ["sql_query"]
    }
};

const aiModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ functionDeclarations: [queryDatabaseDeclaration] }],
    systemInstruction: `Anda adalah Konsultan & Asisten Ahli Portal CSR Pemerintah. 
Tugas & Karakter Anda:
1. Profesional, sopan, berwawasan luas, dan sangat membantu. 
2. Anda memiliki memori atas percakapan sebelumnya. 
3. Anda bisa memanggil alat "query_database_csr" UNTUK mencari data konkrit (misal: nama mitra, anggaran program, peraturan).
4. JIKA Anda ditanya hal umum (halo, apa itu CSR, terima kasih), jawab langsung saja menggunakan pengetahuan dasar Anda TANPA perlu memanggil fungsi database.
5. Saat memberikan data, rapikan menggunakan bullet points, tandai kata/angka penting dengan huruf tebal, formati uang dengan standar Rupiah yang utuh. DILARANG menggunakan Emoji.

Skema Database Anda:
- kelola_program: id, title, description, category, budget, year, location, beneficiaries, impactScore, tags
- direktori_mitra_csr: id, companyName, logo, sector, address, phone, contributionCount, joinedYear
- regulasi: id, title, number, year, type, description, fileSize, fileUrl
- kontribusi_mitra_csr: id, companyName, contactPerson, email, programId, partnerId, status, commitmentAmount, submittedAt
- sdgs_tujuan: id, no_get, judul, keterangan, warna
- sdgs_pilar: id, kode_pilar, nama_pilar, keterangan

Jika ada query yang meminta INSERT/UPDATE/DROP/DELETE, tolak dengan tegas.`
});

// Fallback Search Function (If AI Fails)
async function performFallbackSearch(message) {
    const msg = message.toLowerCase().trim();
    const cleanMsg = msg.replace(/[^\w\s]/gi, '');
    const words = cleanMsg.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return null;

    try {
        let programQuery = "SELECT title, category, location, budget FROM kelola_program WHERE " + 
            words.map(w => `(title LIKE '%${w}%' OR category LIKE '%${w}%' OR location LIKE '%${w}%')`).join(' OR ') + " LIMIT 5";
        const [programs] = await pool.query(programQuery);
        
        let partnerQuery = "SELECT companyName, sector, joinedYear FROM direktori_mitra_csr WHERE " +
            words.map(w => `(companyName LIKE '%${w}%' OR sector LIKE '%${w}%')`).join(' OR ') + " LIMIT 5";
        const [partners] = await pool.query(partnerQuery);

        if (programs.length === 0 && partners.length === 0) return null;
        let response = "Maaf, saat ini AI pembantu saya sedang dalam pemeliharaan. Namun, saya menemukan data berikut:\n\n";
        if (programs.length > 0) {
            response += " PROGRAM TERKAIT:\n";
            programs.forEach(p => response += `- ${p.title} (${p.category} di ${p.location})\n`);
        }
        if (partners.length > 0) {
            response += "\n MITRA TERKAIT:\n";
            partners.forEach(m => response += `- ${m.companyName} (Sektor: ${m.sector})\n`);
        }
        return response;
    } catch (err) { return null; }
}

router.post('/chat', async (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

    const msgClean = message.toLowerCase().replace(/[^\w\s]/gi, '');
    const negativeWords = ['bodoh', 'goblok', 'tolol', 'bego', 'anjing', 'bangsat', 'bajingan', 'brengsek', 'idiot', 'kampret', 'monyet', 'tai', 'setan', 'iblis', 'kafir', 'rasis', 'sara', 'sampah', 'sialan', 'kontol', 'memek', 'ngentot', 'jancok', 'asu', 'cok', 'kimak', 'puki'];
    if (negativeWords.some(w => msgClean.includes(w))) {
        return res.json({ reply: 'Mohon gunakan bahasa yang sopan. Saya hanya bisa membantu terkait Portal CSR.', tag: 'KONTEN_NEGATIF' });
    }

    const mappedHistory = (history || []).filter(h => h.role !== 'system').map(h => ({
        role: h.role === 'bot' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));

    try {
        const chatSession = aiModel.startChat({ history: mappedHistory });
        let result = await chatSession.sendMessage([{text: message}]);
        let call = result.response.functionCalls() ? result.response.functionCalls()[0] : null;

        if (call && call.name === "query_database_csr") {
            const sqlQuery = call.args.sql_query;
            const unauthorized = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE'];
            if (unauthorized.some(cmd => sqlQuery.toUpperCase().includes(cmd))) {
                return res.json({ reply: 'Maaf, saya tidak berwenang melakukan modifikasi data.' });
            }

            let dbResult = [];
            try {
                const [rows] = await pool.query(sqlQuery);
                dbResult = rows;
            } catch (dbErr) { dbResult = { error: dbErr.message }; }

            result = await chatSession.sendMessage([{
                functionResponse: { name: 'query_database_csr', response: { data: dbResult } }
            }]);
        }

        res.json({ reply: result.response.text().trim(), tag: 'AI_STUDIO' });
    } catch (error) {
        const fallback = await performFallbackSearch(message);
        if (fallback) return res.json({ reply: fallback, tag: 'FALLBACK_MODE' });
        res.json({ reply: 'Asisten cerdas kami sedang offline. Silakan coba lagi nanti.', error: error.message });
    }
});

module.exports = router;
