const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Logo Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'logo-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Regulation Uploads
const regStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const regDir = path.join(__dirname, '..', 'regulations');
        if (!fs.existsSync(regDir)) fs.mkdirSync(regDir);
        cb(null, regDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, safeName);
    }
});
const uploadReg = multer({ storage: regStorage });

// Report Uploads
const reportStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const reportDir = path.join(__dirname, '..', 'reports');
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
        cb(null, reportDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, 'report-' + Date.now() + '-' + safeName);
    }
});
const uploadReport = multer({ storage: reportStorage });

module.exports = {
    upload,
    uploadReg,
    uploadReport
};
