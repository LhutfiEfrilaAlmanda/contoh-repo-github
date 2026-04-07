import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Building2, FileCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function MitraIndustri() {
    const [activeTab, setActiveTab] = useState('direktori'); // 'direktori' | 'kontribusi'
    const [partners, setPartners] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [editItem, setEditItem] = useState(null);
    const [showForm, setShowForm] = useState(false);

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
        const item = {
            companyName: fd.get('name'),
            sector: fd.get('sector'),
            address: fd.get('address'),
            phone: fd.get('phone'),
            logo: fd.get('logo') || '',
            contributionCount: Number(fd.get('contributionCount') || 0),
            joinedYear: Number(fd.get('joinedYear') || new Date().getFullYear())
        };
        try {
            if (editItem) {
                await api.put('partners/' + editItem.id, item);
                setPartners(prev => prev.map(x => x.id === editItem.id ? { ...x, ...item } : x));
            } else {
                const r = await api.post('partners', item);
                // Kembalikan ke format yang diharapkan UI jika perlu, atau pastikan UI konsisten
                setPartners(prev => [...prev, r.data]);
            }
            setEditItem(null); 
            setShowForm(false); 
            e.target.reset();
            alert('Mitra berhasil disimpan!');
        } catch (err) { alert('Gagal menyimpan.'); }
    };

    const handleDeleteMitra = async (id) => {
        if (!window.confirm('Yakin hapus mitra ini?')) return;
        try {
            await api.delete('partners/' + id);
            setPartners(prev => prev.filter(x => x.id !== id));
        } catch (err) { alert('Gagal menghapus.'); }
    };

    // --- MANAJEMEN KONTRIBUSI (VERIFIKASI) ---
    const handleUpdateStatus = async (subId, newStatus) => {
        if (!window.confirm(`Ubah status kontribusi ini jadi ${newStatus}?`)) return;
        try {
            const sub = submissions.find(s => s.id === subId);
            if (!sub) return;
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

    const filteredSubmissions = submissions.filter(sub => {
        // 1. Search Logic (Company name or Program title)
        const matchSearch = sub.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            getProgramTitle(sub.programId).toLowerCase().includes(searchQuery.toLowerCase());
        
        // 2. Status Filter Logic
        if (statusFilter === 'Semua') return matchSearch;
        
        let currentStatus = 'Pending';
        if (sub.status?.toLowerCase() === 'terealisasi' || sub.status === 'Approved') currentStatus = 'Terealisasi';
        else if (sub.status?.toLowerCase() === 'ditolak' || sub.status === 'Rejected') currentStatus = 'Ditolak';
        else currentStatus = 'Menunggu Verifikasi';

        return matchSearch && currentStatus === statusFilter;
    });

    return (
        <div className="animate-fade-in">
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
                        {submissions.filter(s => s.status === 'Pending' || s.status === 'Menunggu Verifikasi').length > 0 && (
                            <span className="bg-rose-500 text-white rounded-full px-2 py-0.5 text-[10px]">
                                {submissions.filter(s => s.status === 'Pending' || s.status === 'Menunggu Verifikasi').length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === 'direktori' && (
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-sm ${showForm ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                        {showForm ? '✕ Tutup Form' : '+ Tambah Mitra BARU'}
                    </button>
                )}
            </div>

            {activeTab === 'direktori' ? (
                <>
                    {showForm && (
                        <form key={editItem?.id || 'new'} onSubmit={handleMitraSubmit}
                            className={`p-6 rounded-3xl mb-8 border-2 animate-in slide-in-from-top duration-300 ${editItem ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="name" required placeholder="Nama Perusahaan" defaultValue={editItem?.name || ''}
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
                            <input name="contributionCount" type="number" placeholder="Jumlah Kontribusi" defaultValue={editItem?.contributionCount || 0}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {partners.map(p => (
                            <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col group relative">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 pr-2">
                                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded mb-1.5 inline-block">{p.sector}</span>
                                        <h4 className="font-bold text-sm text-slate-800 leading-tight">{p.name || p.companyName}</h4>
                                    </div>
                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditItem({ id: p.id, name: p.name || p.companyName, sector: p.sector, address: p.address, phone: p.phone, joinedYear: p.joinedYear, contributionCount: p.contributionCount }); setShowForm(true); }} className="text-indigo-500 bg-indigo-50 hover:bg-indigo-100 w-7 h-7 rounded-lg flex items-center justify-center text-[10px]">✏️</button>
                                        <button onClick={() => handleDeleteMitra(p.id)} className="text-rose-500 bg-rose-50 hover:bg-rose-100 w-7 h-7 rounded-lg flex items-center justify-center text-[10px]">🗑️</button>
                                    </div>
                                </div>
                                <div className="text-[11px] text-slate-500 space-y-1.5 mt-auto pt-3 border-t border-slate-50">
                                    <div className="flex items-start gap-2"><span className="shrink-0 grayscale opacity-50">📍</span> <span className="line-clamp-1">{p.address || '-'}</span></div>
                                    <div className="flex items-center gap-2"><span className="shrink-0 grayscale opacity-50">📞</span> <span className="line-clamp-1">{p.phone || '-'}</span></div>
                                    
                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50/50">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Bergabung</span>
                                            <span className="text-xs font-black text-slate-700">{p.joinedYear}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Program</span>
                                            <span className="text-xs font-black text-indigo-600">{p.contributionCount || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    {/* Filter & Search Bar for Verifikasi Kontribusi */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-slate-400">🔍</span>
                            </div>
                            <input 
                                type="text" 
                                placeholder="Cari nama mitra atau program..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                            />
                        </div>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm min-w-[200px]"
                        >
                            <option value="Semua">Semua Status</option>
                            <option value="Terealisasi">Terealisasi</option>
                            <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                            <option value="Ditolak">Ditolak</option>
                        </select>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[800px]">
                                <thead className="bg-slate-50/80 border-b border-slate-100">
                                    <tr>
                                        <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Informasi Mitra & Program</th>
                                        <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Dana Anggaran</th>
                                        <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status Saat Ini</th>
                                        <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Aksi Verifikasi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSubmissions.length > 0 ? filteredSubmissions.map(sub => {
                                        const isRealised = sub.status?.toLowerCase() === 'terealisasi' || sub.status === 'Approved';
                                        const isRejected = sub.status?.toLowerCase() === 'ditolak' || sub.status === 'Rejected';
                                        const isPending = !isRealised && !isRejected;

                                        return (
                                            <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-4 px-6 relative">
                                                    {isPending && <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></span>}
                                                    <div className="font-bold text-slate-800 text-sm mb-0.5">{sub.companyName}</div>
                                                    <div className="font-medium text-slate-500 text-xs line-clamp-1 mb-1">{getProgramTitle(sub.programId)}</div>
                                                    <div className="text-xs text-slate-400">CP: {sub.contactPerson} ({sub.email})</div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="font-bold text-slate-800 text-sm">
                                                        Rp {(Number(sub.commitmentAmount) || 0).toLocaleString('id-ID')}
                                                    </div>
                                                    <div className="text-[10px] font-semibold text-slate-400 mt-0.5 uppercase">
                                                        Diajukan {new Date(sub.submittedAt).toLocaleDateString('id-ID')}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {isRealised && (
                                                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-200 mt-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Terealisasi
                                                        </span>
                                                    )}
                                                    {isPending && (
                                                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-amber-200 mt-1">
                                                            <Clock className="w-3.5 h-3.5" /> Menunggu Verifikasi
                                                        </span>
                                                    )}
                                                    {isRejected && (
                                                        <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-rose-200 mt-1">
                                                            <XCircle className="w-3.5 h-3.5" /> Ditolak
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    {isPending ? (
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => handleUpdateStatus(sub.id, 'Terealisasi')}
                                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors"
                                                            >
                                                                Terima ✓
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateStatus(sub.id, 'Ditolak')}
                                                                className="px-4 py-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-black transition-colors"
                                                            >
                                                                Tolak ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase w-full max-w-[150px] ml-auto">
                                                            Aksi selesai pada tiket ini.
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan="4" className="py-20 text-center text-slate-400 font-bold border-dashed border-2 border-slate-100 rounded-3xl m-4">
                                                Tidak ada data permintaan kontribusi mitra saat ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
