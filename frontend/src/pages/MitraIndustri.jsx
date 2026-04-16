import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Building2, FileCheck, CheckCircle2, XCircle, Clock, Calendar, Info, MapPin, Phone } from 'lucide-react';

export default function MitraIndustri() {
    const [activeTab, setActiveTab] = useState('direktori'); // 'direktori' | 'kontribusi'
    const [partners, setPartners] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [programs, setPrograms] = useState([]);
    
    // UI States
    const [editItem, setEditItem] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [showSubForm, setShowSubForm] = useState(false); // Form input kontribusi manual
    const [selectedPartner, setSelectedPartner] = useState(null); // State untuk Modal Detail

    // States for filtering Verifikasi Kontribusi
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('Semua');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [p, s, sub, prog] = await Promise.all([
                    api.get('partners'),
                    api.get('sectors'),
                    api.get('submissions'),
                    api.get('programs')
                ]);
                setPartners(p.data || []);
                setSectors(s.data || []);
                setSubmissions(sub.data || []);
                setPrograms(Array.isArray(prog.data) ? prog.data : (prog.data.data || []));
            } catch (e) {
                console.error('Gagal load data rutin mitra:', e);
            }
        };
        loadData();
    }, []);

    // --- MANAJEMEN DIREKTORI MITRA ---
    const handleMitraSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        // Sekarang kita tidak menyertakan contributionCount karena otomatis
        const item = {
            companyName: fd.get('name'),
            sector: fd.get('sector'),
            address: fd.get('address'),
            phone: fd.get('phone'),
            logo: fd.get('logo') || '',
            joinedYear: Number(fd.get('joinedYear') || new Date().getFullYear())
        };

        try {
            if (editItem) {
                await api.put('partners/' + editItem.id, item);
                setPartners(prev => prev.map(x => x.id === editItem.id ? { ...x, ...item } : x));
            } else {
                const r = await api.post('partners', item);
                setPartners(prev => [...prev, r.data]);
            }
            setEditItem(null); 
            setShowForm(false); 
            e.target.reset();
            alert('Mitra berhasil disimpan!');
        } catch (err) { 
            console.error(err);
            alert('Gagal menyimpan Mitra.'); 
        }
    };

    const handleDeleteMitra = async (id) => {
        if (!window.confirm('Yakin hapus mitra ini?')) return;
        try {
            await api.delete('partners/' + id);
            setPartners(prev => prev.filter(x => x.id !== id));
        } catch (err) { alert('Gagal menghapus.'); }
    };

    // --- MANAJEMEN KONTRIBUSI (VERIFIKASI & INPUT MANUAL) ---
    const handleSubFormSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const item = {
            companyName: fd.get('companyName'),
            programId: fd.get('programId'),
            commitmentAmount: Number(fd.get('commitmentAmount') || 0),
            status: fd.get('status') || 'Terealisasi',
            contactPerson: fd.get('contactPerson') || 'Admin',
            email: fd.get('email') || '',
            submittedAt: new Date().toISOString()
        };

        try {
            const r = await api.post('submissions', item);
            setSubmissions(prev => [r.data, ...prev]);

            // --- AUTO REGISTER MITRA JIKA BELUM ADA ---
            const partnerExists = partners.some(p => (p.companyName || p.name) === item.companyName);
            if (!partnerExists) {
                const newPartner = {
                    companyName: item.companyName,
                    sector: 'Ditambahkan Manual',
                    address: '-',
                    phone: fd.get('phone') || '-',
                    logo: '',
                    joinedYear: new Date().getFullYear()
                };
                await api.post('partners', newPartner).then(res => {
                    setPartners(prev => [...prev, res.data]);
                });
            }

            setShowSubForm(false);
            e.target.reset();
            alert('Kontribusi berhasil dicatat dan diverifikasi!');
        } catch (err) {
            console.error(err);
            alert('Gagal mencatat kontribusi.');
        }
    };

    const handleUpdateStatus = async (subId, newStatus) => {
        if (!window.confirm(`Ubah status kontribusi ini jadi ${newStatus}?`)) return;
        try {
            const sub = submissions.find(s => s.id === subId);
            if (!sub) return;

            // --- AUTO REGISTER MITRA ---
            // Jika status diubah jadi 'Terealisasi', cek apakah mitra sudah ada di direktori
            if (newStatus === 'Terealisasi' || newStatus.toLowerCase() === 'approved') {
                const partnerExists = partners.some(p => (p.companyName || p.name) === sub.companyName);
                
                if (!partnerExists) {
                    console.log('Mendaftarkan mitra baru secara otomatis:', sub.companyName);
                    const newPartner = {
                        companyName: sub.companyName,
                        sector: 'Lainnya',
                        address: '-',
                        phone: '-',
                        logo: '',
                        joinedYear: new Date().getFullYear()
                    };
                    const resPartner = await api.post('partners', newPartner);
                    setPartners(prev => [...prev, resPartner.data]);
                }
            }

            const updated = { ...sub, status: newStatus };
            await api.put(`submissions/${subId}`, updated);
            setSubmissions(prev => prev.map(s => s.id === subId ? updated : s));
            
            alert(`Berhasil. Status diubah menjadi ${newStatus}`);
        } catch (error) {
            console.error(error);
            alert('Gagal merubah status verifikasi.');
        }
    };

    const getProgramTitle = (progId) => {
        const match = programs.find(p => p.id === progId);
        return match ? match.title : 'Program ' + progId;
    };

    // Filter Logic untuk Tab Verifikasi
    const filteredSubmissions = submissions.filter(sub => {
        const matchSearch = (sub.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                             getProgramTitle(sub.programId).toLowerCase().includes(searchQuery.toLowerCase());
        
        if (statusFilter === 'Semua') return matchSearch;
        
        let currentStatus = 'Pending';
        const s = (sub.status || '').toLowerCase();
        if (s === 'terealisasi' || s === 'approved') currentStatus = 'Terealisasi';
        else if (s === 'ditolak' || s === 'rejected') currentStatus = 'Ditolak';
        else currentStatus = 'Menunggu Verifikasi';

        return matchSearch && currentStatus === statusFilter;
    });

    return (
        <div className="animate-fade-in relative">
            {/* Header Tabs Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex bg-slate-100 p-1 rounded-2xl w-fit border border-slate-200">
                    <button
                        onClick={() => { setActiveTab('direktori'); setEditItem(null); setShowForm(false); }}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${activeTab === 'direktori' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        <Building2 className="w-4 h-4" /> Manajemen Direktori
                    </button>
                    <button
                        onClick={() => { setActiveTab('kontribusi'); setEditItem(null); setShowForm(false); }}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${activeTab === 'kontribusi' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        <FileCheck className="w-4 h-4" /> Verifikasi Kontribusi
                        {submissions.filter(s => (s.status || '').toLowerCase() === 'pending' || (s.status || '').toLowerCase() === 'menunggu verifikasi').length > 0 && (
                            <span className="bg-rose-500 text-white rounded-full px-2 py-0.5 text-[10px]">
                                {submissions.filter(s => (s.status || '').toLowerCase() === 'pending' || (s.status || '').toLowerCase() === 'menunggu verifikasi').length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex gap-2">
                    {activeTab === 'direktori' && (
                        <button 
                            onClick={() => setShowForm(!showForm)}
                            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-sm ${showForm ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            {showForm ? '✕ Tutup Form' : '+ Tambah Mitra BARU'}
                        </button>
                    )}
                    {activeTab === 'kontribusi' && (
                        <button 
                            onClick={() => setShowSubForm(!showSubForm)}
                            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-sm ${showSubForm ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            {showSubForm ? '✕ Tutup Form' : '+ Input Kontribusi'}
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'direktori' ? (
                <>
                    {/* FORM ADD/EDIT MITRA */}
                    {showForm && (
                        <form key={editItem?.id || 'new'} onSubmit={handleMitraSubmit}
                            className={`p-6 rounded-3xl mb-8 border-2 animate-in slide-in-from-top duration-300 ${editItem ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input name="name" required placeholder="Nama Perusahaan" defaultValue={editItem?.companyName || editItem?.name || ''}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" />
                                <select name="sector" required defaultValue={editItem?.sector || ''}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium">
                                    <option value="">Pilih Sektor</option>
                                    {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                                <input name="address" placeholder="Alamat" defaultValue={editItem?.address || ''}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" />
                                <input name="phone" placeholder="No. Telepon" defaultValue={editItem?.phone || ''}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" />
                                <input name="joinedYear" type="number" placeholder="Tahun Bergabung" defaultValue={editItem?.joinedYear || new Date().getFullYear()}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" />
                            </div>
                            <div className="flex gap-3 mt-5">
                                <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-indigo-600 transition-colors">
                                    {editItem ? 'Simpan Perubahan' : 'Simpan Mitra'}
                                </button>
                                {editItem && <button type="button" onClick={() => { setEditItem(null); setShowForm(false); }} className="px-6 py-3 bg-slate-100 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>}
                            </div>
                        </form>
                    )}

                    {/* GRID MITRA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {partners.map(p => {
                            const partnerContributions = submissions.filter(s => s.companyName === (p.companyName || p.name));
                            return (
                                <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col group relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 pr-2">
                                            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded mb-1.5 inline-block">{p.sector}</span>
                                            <h4 className="font-bold text-sm text-slate-800 leading-tight">{p.companyName || p.name}</h4>
                                        </div>
                                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditItem(p); setShowForm(true); }} className="text-indigo-500 bg-indigo-50 hover:bg-indigo-100 w-7 h-7 rounded-lg flex items-center justify-center text-[10px]">✏️</button>
                                            <button onClick={() => handleDeleteMitra(p.id)} className="text-rose-500 bg-rose-50 hover:bg-rose-100 w-7 h-7 rounded-lg flex items-center justify-center text-[10px]">🗑️</button>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-500 space-y-1.5 mt-auto pt-3 border-t border-slate-50">
                                        <div className="flex items-start gap-2"><MapPin className="w-3 h-3 grayscale opacity-50 shrink-0 mt-0.5" /> <span className="line-clamp-1">{p.address || '-'}</span></div>
                                        <div className="flex items-center gap-2"><Phone className="w-3 h-3 grayscale opacity-50 shrink-0" /> <span className="line-clamp-1">{p.phone || '-'}</span></div>
                                        
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50/50">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Bergabung</span>
                                                <span className="text-xs font-black text-slate-700">{p.joinedYear}</span>
                                            </div>
                                            <button 
                                                onClick={() => setSelectedPartner(p)}
                                                className="flex flex-col text-right hover:opacity-75 transition-opacity group/stat"
                                            >
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider group-hover/stat:text-indigo-500">Total Program</span>
                                                <span className="text-xs font-black text-indigo-600 flex items-center justify-end gap-1">
                                                    {partnerContributions.length}
                                                    <Info className="w-2 h-2" />
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    {/* FORM INPUT KONTRIBUSI MANUAL (ADMIN) */}
                    {showSubForm && (
                        <form onSubmit={handleSubFormSubmit}
                            className="p-6 rounded-3xl mb-8 bg-indigo-50 border-2 border-indigo-100 animate-in slide-in-from-top duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Pilih / Ketik Mitra</label>
                                    <input 
                                        name="companyName" 
                                        list="partner-list"
                                        required 
                                        placeholder="Ketik Nama Perusahaan..."
                                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" 
                                    />
                                    <datalist id="partner-list">
                                        {partners.map(p => (
                                            <option key={p.id} value={p.companyName || p.name} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Pilih Program</label>
                                    <select name="programId" required className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium">
                                        <option value="">-- Pilih Program CSR --</option>
                                        {programs.map(pr => <option key={pr.id} value={pr.id}>{pr.title}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nilai Anggaran (Rp)</label>
                                    <input name="commitmentAmount" type="number" required placeholder="Contoh: 50000000"
                                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Status</label>
                                    <select name="status" className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium">
                                        <option value="Terealisasi">Terealisasi (Selesai)</option>
                                        <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                                        <option value="Ditolak">Ditolak</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nama Kontak / Admin</label>
                                    <input name="contactPerson" defaultValue="Administrator" placeholder="Nama penginput"
                                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-indigo-500 uppercase ml-1">Nomor WhatsApp Mitra</label>
                                    <input name="phone" placeholder="Contoh: 0812345678"
                                        className="bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-slate-900 transition-colors shadow-lg shadow-indigo-200">
                                    Simpan Kontribusi
                                </button>
                                <button type="button" onClick={() => setShowSubForm(false)} className="px-6 py-3 bg-white text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors">Batal</button>
                            </div>
                        </form>
                    )}

                    {/* TAB VERIFIKASI KONTRIBUSI */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                placeholder="Cari nama mitra atau program..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-6 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                            />
                        </div>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 shadow-sm min-w-[200px]"
                        >
                            <option value="Semua">Semua Status</option>
                            <option value="Terealisasi">Terealisasi</option>
                            <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                            <option value="Ditolak">Ditolak</option>
                        </select>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[800px]">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Informasi Mitra & Program</th>
                                        <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Anggaran</th>
                                        <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSubmissions.map(sub => (
                                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-slate-800 text-sm">{sub.companyName}</div>
                                                <div className="font-medium text-slate-500 text-xs">{getProgramTitle(sub.programId)}</div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="text-sm font-black text-slate-700">Rp {(sub.commitmentAmount || 0).toLocaleString('id-ID')}</div>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase mt-1 inline-block ${
                                                    (sub.status || '').toLowerCase() === 'terealisasi' ? 'bg-emerald-50 text-emerald-600' : 
                                                    (sub.status || '').toLowerCase() === 'ditolak' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                    {sub.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right space-x-2">
                                                {((sub.status || '').toLowerCase() === 'pending' || (sub.status || '').toLowerCase() === 'menunggu verifikasi') && (
                                                    <>
                                                        <button onClick={() => handleUpdateStatus(sub.id, 'Terealisasi')} className="text-[10px] font-black bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">Terima</button>
                                                        <button onClick={() => handleUpdateStatus(sub.id, 'Ditolak')} className="text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-100">Tolak</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL DETAIL MITRA */}
            {selectedPartner && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">{selectedPartner.companyName || selectedPartner.name}</h3>
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">Riwayat Program</p>
                            </div>
                            <button onClick={() => setSelectedPartner(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500">✕</button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                             <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Program</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Anggaran</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {submissions.filter(s => s.companyName === (selectedPartner.companyName || selectedPartner.name)).map(sub => (
                                        <tr key={sub.id}>
                                            <td className="py-4 pr-4">
                                                <div className="text-sm font-bold text-slate-800">{getProgramTitle(sub.programId)}</div>
                                            </td>
                                            <td className="py-4">
                                                <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${
                                                    (sub.status || '').toLowerCase() === 'terealisasi' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                }`}>{sub.status || 'Pending'}</span>
                                            </td>
                                            <td className="py-4 text-right">
                                                <div className="text-xs font-black">Rp {(sub.commitmentAmount || 0).toLocaleString('id-ID')}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {submissions.filter(s => s.companyName === (selectedPartner.companyName || selectedPartner.name)).length === 0 && (
                                        <tr><td colSpan="3" className="py-8 text-center text-slate-400 text-sm font-bold">Belum ada riwayat program.</td></tr>
                                    )}
                                </tbody>
                             </table>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setSelectedPartner(null)} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600">Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
