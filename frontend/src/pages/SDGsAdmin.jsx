import React, { useState, useEffect, useRef } from 'react';
import api, { BASE_URL } from '../services/api';
import { Search, Info, PlusCircle, Edit3, Trash2, X, ImagePlus, Target, BarChart3 } from 'lucide-react';

// ============================================================
//  TAB 1: TUJUAN SDGs (KODE ASLI TIDAK DIUBAH)
// ============================================================
function TujuanTab() {
    const [sdgs, setSdgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({ no_get: '', judul: '', keterangan: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const fileRef = useRef(null);

    useEffect(() => { fetchSDGs(); }, []);

    const fetchSDGs = async () => {
        try {
            const response = await api.get('/sdgs');
            const sortedData = response.data.sort((a, b) => a.no_get - b.no_get);
            setSdgs(sortedData);
        } catch (error) {
            console.error('Gagal mengambil data SDGs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSdgs = sdgs.filter(s => 
        s.judul.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.no_get.toString().includes(searchTerm)
    );

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('no_get', formData.no_get);
            data.append('judul', formData.judul);
            data.append('keterangan', formData.keterangan);
            data.append('warna', editItem?.warna || '#4c9f38');
            if (selectedFile) {
                data.append('gambar', selectedFile);
            } else if (editItem?.gambar) {
                data.append('gambar', editItem.gambar);
            }

            if (editItem) {
                await api.put(`/sdgs/${editItem.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('/sdgs', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            setShowModal(false);
            setEditItem(null);
            setFormData({ no_get: '', judul: '', keterangan: '' });
            setSelectedFile(null);
            setPreviewUrl('');
            fetchSDGs();
            alert('Data SDGs berhasil disimpan!');
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan data.');
        }
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            no_get: item.no_get,
            judul: item.judul,
            keterangan: item.keterangan
        });
        setSelectedFile(null);
        setPreviewUrl(item.gambar || '');
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus tujuan SDGs ini?')) return;
        try {
            await api.delete(`/sdgs/${id}`);
            fetchSDGs();
            alert('Data SDGs berhasil dihapus.');
        } catch (err) { console.error(err); alert('Gagal menghapus.'); }
    };

    const openAdd = () => {
        setEditItem(null);
        setFormData({ no_get: sdgs.length + 1, judul: '', keterangan: '' });
        setSelectedFile(null);
        setPreviewUrl('');
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button onClick={openAdd} className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-800 transition-all shadow-sm">
                    <PlusCircle className="w-4 h-4" /> Tambah Data
                </button>
                <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
                    <input type="text" placeholder="Cari" className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                                <th className="px-5 py-4 font-black whitespace-nowrap" style={{width:'10%'}}>Gambar</th>
                                <th className="px-5 py-4 font-black whitespace-nowrap" style={{width:'20%'}}>Tujuan</th>
                                <th className="px-5 py-4 font-black whitespace-nowrap" style={{width:'55%'}}>Keterangan</th>
                                <th className="px-5 py-4 font-black whitespace-nowrap text-center" style={{width:'15%'}}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse"><td colSpan="4" className="px-5 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td></tr>
                                ))
                            ) : filteredSdgs.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-16"><Info className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 font-bold text-sm">Data tidak ditemukan</p></td></tr>
                            ) : (
                                filteredSdgs.map(sdg => (
                                    <tr key={sdg.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-5 py-4">
                                            {sdg.gambar ? (
                                                <img src={sdg.gambar} alt={`SDG ${sdg.no_get}`} className="w-11 h-11 rounded-xl object-cover shadow-sm border border-slate-100" />
                                            ) : (
                                                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-black shadow-md" style={{ backgroundColor: sdg.warna, boxShadow: `0 3px 8px -2px ${sdg.warna}50` }}>{sdg.no_get}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4"><span className="text-sm font-bold text-slate-700">{sdg.no_get}. {sdg.judul}</span></td>
                                        <td className="px-5 py-4"><span className="text-sm text-slate-500 font-medium line-clamp-1">{sdg.keterangan}</span></td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit(sdg)} className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(sdg.id)} className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && filteredSdgs.length > 0 && (
                    <div className="px-5 py-4 border-t border-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
                        Menampilkan {filteredSdgs.length} dari {sdgs.length} data
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-scale-up">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-800">{editItem ? 'Ubah Tujuan SDGs' : 'Tambah Tujuan SDGs'}</h3>
                            <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Nomor</label>
                                <input type="number" value={formData.no_get} onChange={(e) => setFormData({...formData, no_get: parseInt(e.target.value) || ''})} placeholder="1" required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Tujuan</label>
                                <input value={formData.judul} onChange={(e) => setFormData({...formData, judul: e.target.value})} placeholder="Tanpa Kemiskinan" required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Keterangan</label>
                                <textarea value={formData.keterangan} onChange={(e) => setFormData({...formData, keterangan: e.target.value})} placeholder="Mengakhiri kemiskinan dalam segala bentuk apapun" rows={3} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all resize-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Gambar</label>
                                <div className="flex items-center gap-4">
                                    {previewUrl && (<img src={previewUrl} alt="Preview" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm" />)}
                                    <div className="flex-1">
                                        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                        <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 transition-all cursor-pointer">
                                            <ImagePlus className="w-4 h-4 text-slate-400" />
                                            {selectedFile ? selectedFile.name : (previewUrl ? 'Ganti gambar...' : 'Pilih File')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Batal</button>
                                <button type="submit" className="px-8 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 transition-all shadow-sm">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
//  TAB 2: TARGET SDGs (BARU)
// ============================================================
function TargetTab() {
    const [targets, setTargets] = useState([]);
    const [sdgs, setSdgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({ sdg_id: '', kode_target: '', deskripsi: '' });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [tRes, sRes] = await Promise.all([api.get('/sdgs-targets'), api.get('/sdgs')]);
            setTargets(tRes.data || []);
            setSdgs((sRes.data || []).sort((a, b) => a.no_get - b.no_get));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const filtered = targets.filter(t =>
        (t.kode_target || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.deskripsi || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.sdg_judul || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editItem) {
                await api.put(`/sdgs-targets/${editItem.id}`, formData);
            } else {
                await api.post('/sdgs-targets', formData);
            }
            setShowModal(false); setEditItem(null);
            setFormData({ sdg_id: '', kode_target: '', deskripsi: '' });
            fetchData();
            alert('Target SDGs berhasil disimpan!');
        } catch (err) { console.error(err); alert('Gagal menyimpan.'); }
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({ sdg_id: item.sdg_id, kode_target: item.kode_target, deskripsi: item.deskripsi });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus target ini? Semua indikator terkait akan ikut terhapus.')) return;
        try { await api.delete(`/sdgs-targets/${id}`); fetchData(); alert('Berhasil dihapus.'); }
        catch (err) { console.error(err); alert('Gagal menghapus.'); }
    };

    const openAdd = () => {
        setEditItem(null);
        setFormData({ sdg_id: sdgs[0]?.id || '', kode_target: '', deskripsi: '' });
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button onClick={openAdd} className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-800 transition-all shadow-sm">
                    <PlusCircle className="w-4 h-4" /> Tambah Target
                </button>
                <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
                    <input type="text" placeholder="Cari target..." className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                                <th className="px-5 py-4 font-black" style={{width:'15%'}}>Kode</th>
                                <th className="px-5 py-4 font-black" style={{width:'20%'}}>Tujuan SDGs</th>
                                <th className="px-5 py-4 font-black" style={{width:'50%'}}>Deskripsi Target</th>
                                <th className="px-5 py-4 font-black text-center" style={{width:'15%'}}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [...Array(3)].map((_, i) => (<tr key={i} className="animate-pulse"><td colSpan="4" className="px-5 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td></tr>))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-16"><Info className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 font-bold text-sm">Belum ada data target</p></td></tr>
                            ) : (
                                filtered.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4"><span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black">{t.kode_target}</span></td>
                                        <td className="px-5 py-4"><span className="text-sm font-bold text-slate-700">{t.sdg_no}. {t.sdg_judul}</span></td>
                                        <td className="px-5 py-4"><span className="text-sm text-slate-500 font-medium line-clamp-2">{t.deskripsi}</span></td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit(t)} className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors"><Edit3 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(t.id)} className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && filtered.length > 0 && (
                    <div className="px-5 py-4 border-t border-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-widest">Menampilkan {filtered.length} data</div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-scale-up">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-800">{editItem ? 'Ubah Target SDGs' : 'Tambah Target SDGs'}</h3>
                            <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Tujuan SDGs</label>
                                <select value={formData.sdg_id} onChange={(e) => setFormData({...formData, sdg_id: e.target.value})} required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all">
                                    <option value="">-- Pilih Tujuan SDGs --</option>
                                    {sdgs.map(s => (<option key={s.id} value={s.id}>{s.no_get}. {s.judul}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Kode Target</label>
                                <input value={formData.kode_target} onChange={(e) => setFormData({...formData, kode_target: e.target.value})} placeholder="1.1" required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Deskripsi</label>
                                <textarea value={formData.deskripsi} onChange={(e) => setFormData({...formData, deskripsi: e.target.value})} placeholder="Deskripsi target..." rows={3} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all resize-none" />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Batal</button>
                                <button type="submit" className="px-8 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 transition-all shadow-sm">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
//  TAB 3: INDIKATOR SDGs (BARU)
// ============================================================
function IndikatorTab() {
    const [indikators, setIndikators] = useState([]);
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({ target_id: '', kode_indikator: '', deskripsi: '', keterangan: '' });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [iRes, tRes] = await Promise.all([api.get('/sdgs-indikators'), api.get('/sdgs-targets')]);
            setIndikators(iRes.data || []);
            setTargets(tRes.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const filtered = indikators.filter(i =>
        (i.kode_indikator || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.deskripsi || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.kode_target || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editItem) {
                await api.put(`/sdgs-indikators/${editItem.id}`, formData);
            } else {
                await api.post('/sdgs-indikators', formData);
            }
            setShowModal(false); setEditItem(null);
            setFormData({ target_id: '', kode_indikator: '', deskripsi: '', keterangan: '' });
            fetchData();
            alert('Indikator SDGs berhasil disimpan!');
        } catch (err) { console.error(err); alert('Gagal menyimpan.'); }
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({ 
            target_id: item.target_id, 
            kode_indikator: item.kode_indikator, 
            deskripsi: item.deskripsi,
            keterangan: item.keterangan || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus indikator ini?')) return;
        try { await api.delete(`/sdgs-indikators/${id}`); fetchData(); alert('Berhasil dihapus.'); }
        catch (err) { console.error(err); alert('Gagal menghapus.'); }
    };

    const openAdd = () => {
        setEditItem(null);
        setFormData({ target_id: targets[0]?.id || '', kode_indikator: '', deskripsi: '', keterangan: '' });
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button onClick={openAdd} className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-800 transition-all shadow-sm">
                    <PlusCircle className="w-4 h-4" /> Tambah Indikator
                </button>
                <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
                    <input type="text" placeholder="Cari indikator..." className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                                <th className="px-5 py-4 font-black" style={{width:'10%'}}>No. Target</th>
                                <th className="px-5 py-4 font-black" style={{width:'15%'}}>No.</th>
                                <th className="px-5 py-4 font-black" style={{width:'30%'}}>Nama indikator</th>
                                <th className="px-5 py-4 font-black" style={{width:'30%'}}>Keterangan</th>
                                <th className="px-5 py-4 font-black text-center" style={{width:'15%'}}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [...Array(3)].map((_, i) => (<tr key={i} className="animate-pulse"><td colSpan="5" className="px-5 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td></tr>))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-16"><Info className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 font-bold text-sm">Belum ada data indikator</p></td></tr>
                            ) : (
                                filtered.map(ind => (
                                    <tr key={ind.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4"><span className="text-sm font-black text-indigo-600">{ind.kode_target || '-'}</span></td>
                                        <td className="px-5 py-4"><span className="text-sm font-black text-slate-800">{ind.kode_indikator}</span></td>
                                        <td className="px-5 py-4"><span className="text-sm text-slate-500 font-medium line-clamp-2">{ind.deskripsi}</span></td>
                                        <td className="px-5 py-4"><span className="text-sm text-slate-400 italic line-clamp-2">{ind.keterangan || '-'}</span></td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit(ind)} className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors" title="Ubah"><Edit3 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(ind.id)} className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && filtered.length > 0 && (
                    <div className="px-5 py-4 border-t border-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-widest">Menampilkan {filtered.length} data</div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-scale-up">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-800">{editItem ? 'Ubah Indikator SDGs' : 'Tambah Indikator SDGs'}</h3>
                            <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Target SDGs</label>
                                <select value={formData.target_id} onChange={(e) => setFormData({...formData, target_id: e.target.value})} required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all">
                                    <option value="">-- Pilih Target --</option>
                                    {targets.map(t => (<option key={t.id} value={t.id}>{t.kode_target} - {(t.deskripsi || '').substring(0, 60)}...</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Kode Indikator</label>
                                <input value={formData.kode_indikator} onChange={(e) => setFormData({...formData, kode_indikator: e.target.value})} placeholder="1.4.1.(a)" required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Indikator</label>
                                <textarea value={formData.deskripsi} onChange={(e) => setFormData({...formData, deskripsi: e.target.value})} placeholder="Nama indikator..." rows={2} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all resize-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Keterangan</label>
                                <textarea value={formData.keterangan} onChange={(e) => setFormData({...formData, keterangan: e.target.value})} placeholder="Keterangan tambahan..." rows={2} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all resize-none" />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Batal</button>
                                <button type="submit" className="px-8 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 transition-all shadow-sm">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
//  MAIN COMPONENT: SDGsAdmin (DENGAN 3 TAB)
// ============================================================
const TABS = [
    { id: 'tujuan', label: 'Tujuan SDGs', icon: <Target className="w-4 h-4" /> },
    { id: 'target', label: 'Target SDGs', icon: <Search className="w-4 h-4" /> },
    { id: 'indikator', label: 'Indikator SDGs', icon: <BarChart3 className="w-4 h-4" /> },
];

export default function SDGsAdmin() {
    const [activeTab, setActiveTab] = useState('tujuan');

    return (
        <div className="animate-fade-in space-y-6">
            {/* TAB NAVIGATION */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-0">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all -mb-[1px] ${
                            activeTab === tab.id
                                ? 'border-emerald-600 text-emerald-700'
                                : 'border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'tujuan' && <TujuanTab />}
            {activeTab === 'target' && <TargetTab />}
            {activeTab === 'indikator' && <IndikatorTab />}
        </div>
    );
}
