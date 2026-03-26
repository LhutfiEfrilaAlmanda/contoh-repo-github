import React, { useState, useEffect, useRef, useContext } from 'react';
import api, { BASE_URL } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import {
    Upload, FileText, Trash2, Download, CheckCircle2,
    AlertCircle, Loader2, File, Clock, User2
} from 'lucide-react';

const ReportUpload = () => {
    const { user } = useContext(AuthContext);
    const [reports, setReports] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [formData, setFormData] = useState({ id_mitra: '', id_program: '' });
    const fileInputRef = useRef(null);

    // Fetch daftar laporan
    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await api.get('reports');
            setReports(res.data);
        } catch (err) {
            console.error('Gagal memuat daftar laporan:', err);
        }
    };

    // Handle file selection
    const handleFileSelect = (file) => {
        if (file) {
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                setError('Ukuran file terlalu besar. Maksimal 10 MB.');
                return;
            }
            setSelectedFile(file);
            setError('');
            setUploadResult(null);
        }
    };

    // Drag & Drop Handlers
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    // Upload ke backend
    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Pilih file terlebih dahulu.');
            return;
        }

        setIsUploading(true);
        setError('');
        setUploadResult(null);

        const data = new FormData();
        data.append('file', selectedFile);
        if (formData.id_mitra) data.append('id_mitra', formData.id_mitra);
        if (formData.id_program) data.append('id_program', formData.id_program);

        try {
            const res = await api.post('reports/upload', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUploadResult(res.data);
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchReports(); // Refresh list
        } catch (err) {
            const msg = err.response?.data?.error || 'Gagal mengunggah file.';
            setError(msg);
        } finally {
            setIsUploading(false);
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const getFileIcon = (tipe) => {
        const t = (tipe || '').toUpperCase();
        if (['PDF'].includes(t)) return '📄';
        if (['JPG', 'JPEG', 'PNG', 'GIF'].includes(t)) return '🖼️';
        if (['DOC', 'DOCX'].includes(t)) return '📝';
        if (['XLS', 'XLSX'].includes(t)) return '📊';
        return '📎';
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* UPLOAD AREA */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                            <Upload className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Unggah Dokumen Laporan CSR</h3>
                            <p className="text-sm text-slate-500 font-medium">Format: PDF, DOCX, XLSX, JPG, PNG. Maks 10 MB.</p>
                        </div>
                    </div>

                    {/* Drag & Drop Zone */}
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
                            ${dragActive
                                ? 'border-indigo-500 bg-indigo-50 scale-[1.02]'
                                : selectedFile
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileSelect(e.target.files[0])}
                        />

                        {selectedFile ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl">
                                    {getFileIcon(selectedFile.name.split('.').pop())}
                                </div>
                                <div>
                                    <p className="font-black text-slate-800 text-lg">{selectedFile.name}</p>
                                    <p className="text-sm text-slate-500 font-medium">
                                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                                    className="text-xs text-rose-500 font-bold hover:text-rose-700 flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" /> Hapus & Pilih Ulang
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                    <Upload className={`w-8 h-8 ${dragActive ? 'text-indigo-500' : 'text-slate-300'}`} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-600">
                                        {dragActive ? 'Lepaskan file di sini...' : 'Seret & Lepaskan file di sini'}
                                    </p>
                                    <p className="text-sm text-slate-400 mt-1">atau <span className="text-indigo-600 font-bold">klik untuk memilih file</span></p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Optional Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">ID Mitra (Opsional)</label>
                            <input
                                type="number"
                                placeholder="Contoh: 1"
                                value={formData.id_mitra}
                                onChange={(e) => setFormData({ ...formData, id_mitra: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">ID Program (Opsional)</label>
                            <input
                                type="number"
                                placeholder="Contoh: 3"
                                value={formData.id_program}
                                onChange={(e) => setFormData({ ...formData, id_program: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                            />
                        </div>
                    </div>

                    {/* Upload Button */}
                    <button
                        onClick={handleUpload}
                        disabled={!selectedFile || isUploading}
                        className="w-full md:w-auto mt-6 px-10 py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isUploading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Sedang Mengunggah...</>
                        ) : (
                            <><Upload className="w-5 h-5" /> Unggah Dokumen</>
                        )}
                    </button>

                    {/* Status Messages */}
                    {error && (
                        <div className="mt-4 bg-rose-50 text-rose-600 p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-fade-in">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}
                    {uploadResult && (
                        <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-start gap-3 text-sm font-bold animate-fade-in">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p>{uploadResult.message}</p>
                                <p className="text-xs text-emerald-500 mt-1 font-medium">
                                    File: {uploadResult.data?.nama_file} ({uploadResult.data?.ukuran_file})
                                </p>
                                <a
                                    href={uploadResult.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline mt-2 text-xs"
                                >
                                    <Download className="w-3 h-3" /> Buka Link File
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* REPORTS TABLE */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                            <FileText className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Riwayat Dokumen Terunggah</h3>
                            <p className="text-sm text-slate-500 font-medium">{reports.length} dokumen tersimpan di sistem</p>
                        </div>
                    </div>

                    {reports.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <File className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="font-bold text-slate-500">Belum ada dokumen terunggah</p>
                            <p className="text-sm text-slate-400 mt-1">Unggah dokumen pertama Anda menggunakan form di atas.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                                        <th className="pb-4 px-4">Dokumen</th>
                                        <th className="pb-4 px-4">Tipe</th>
                                        <th className="pb-4 px-4">Ukuran</th>
                                        <th className="pb-4 px-4">Oleh</th>
                                        <th className="pb-4 px-4">Tanggal</th>
                                        <th className="pb-4 px-4 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {reports.map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">{getFileIcon(r.tipe_file)}</span>
                                                    <span className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">{r.nama_file}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase">{r.tipe_file || '-'}</span>
                                            </td>
                                            <td className="py-4 px-4 text-xs text-slate-500 font-medium">{r.ukuran_file || '-'}</td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                    <User2 className="w-3 h-3" /> {r.diunggah_oleh || 'Anonim'}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                    <Clock className="w-3 h-3" /> {formatDate(r.tanggal_unggah)}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <a
                                                    href={`${BASE_URL}${r.path_url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-indigo-600 font-bold text-xs hover:text-indigo-800 inline-flex items-center gap-1"
                                                >
                                                    <Download className="w-3.5 h-3.5" /> Unduh
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportUpload;
