import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Layers, Settings2 } from 'lucide-react';
import LocationPicker from '../components/LocationPicker';

export default function ProgramCSR() {
    const [activeTab, setActiveTab] = useState('kelompok'); // 'kelompok' | 'kelola'
    const [programs, setPrograms] = useState([]);
    const [editItem, setEditItem] = useState(null);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [newCategory, setNewCategory] = useState('');

    useEffect(() => {
        Promise.all([api.get('programs'), api.get('categories'), api.get('locations')])
            .then(([p, c, l]) => {
                setPrograms(Array.isArray(p.data) ? p.data : (p.data?.data || []));
                setCategories(c.data || []);
                setLocations(l.data || []);
            })
            .catch(e => console.error('Gagal load program:', e));
    }, []);

    // --- KELOMPOK PROGRAM ---
    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategory.trim()) return;
        try {
            await api.post('categories', { name: newCategory.trim() });
            const c = await api.get('categories');
            setCategories(c.data || []);
            setNewCategory('');
            alert('Kelompok program berhasil ditambahkan!');
        } catch (err) { alert('Gagal menambahkan.'); }
    };

    const handleDeleteCategory = async (catName) => {
        if (!window.confirm(`Yakin hapus kelompok "${catName}"?`)) return;
        try {
            await api.delete('categories/' + encodeURIComponent(catName));
            const c = await api.get('categories');
            setCategories(c.data || []);
        } catch (err) { alert('Gagal menghapus.'); }
    };

    const getCategorySummary = (catName) => {
        const name = typeof catName === 'object' ? catName.name : catName;
        const matched = programs.filter(p => {
            const pCat = typeof p.category === 'object' ? p.category.name : p.category;
            return pCat === name;
        });
        const totalBudget = matched.reduce((s, p) => s + (Number(p.budget) || 0), 0);
        const totalAllocated = matched.reduce((s, p) => s + (Number(p.allocatedAmount) || 0), 0);
        return {
            count: matched.length,
            budget: totalBudget,
            allocated: totalAllocated
        };
    };

    // --- KELOLA PROGRAM ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const item = {
            title: fd.get('title'),
            description: fd.get('description'),
            category: fd.get('category'),
            budget: Number(fd.get('budget')),
            year: Number(fd.get('year')),
            location: fd.get('location'),
            beneficiaries: fd.get('beneficiaries'),
            image: fd.get('image') || '',
            impactScore: Number(fd.get('impactScore') || 0),
            tags: fd.get('tags') || ''
        };
        try {
            if (editItem) {
                await api.put('programs/' + editItem.id, item);
                setPrograms(prev => prev.map(x => x.id === editItem.id ? { ...x, ...item } : x));
            } else {
                const r = await api.post('programs', item);
                setPrograms(prev => [...prev, r.data]);
            }
            setEditItem(null); e.target.reset();
            alert('Program berhasil disimpan!');
        } catch (err) { alert('Gagal menyimpan.'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin hapus program ini?')) return;
        try {
            await api.delete('programs/' + id);
            setPrograms(prev => prev.filter(x => x.id !== id));
        } catch (err) { alert('Gagal menghapus.'); }
    };

    return (
        <div className="animate-fade-in">
            {/* Tab Navigation */}
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-8 w-fit border border-slate-200">
                <button
                    onClick={() => { setActiveTab('kelompok'); setEditItem(null); }}
                    className={`px-6 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 ${activeTab === 'kelompok' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    <Layers className="w-4 h-4" /> KELOMPOK PROGRAM
                </button>
                <button
                    onClick={() => { setActiveTab('kelola'); setEditItem(null); }}
                    className={`px-6 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 ${activeTab === 'kelola' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    <Settings2 className="w-4 h-4" /> KELOLA PROGRAM
                </button>
            </div>

            {activeTab === 'kelompok' ? (
                <>
                    {/* Info Box */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-8">
                        <p className="text-sm text-indigo-900 leading-relaxed">
                            <strong>Keterangan:</strong> Gunakan formulir di bawah ini untuk menambahkan kelompok program (kategori) prioritas baru. Kelompok ini nantinya akan muncul sebagai pilihan saat petugas mendaftarkan program CSR baru.
                        </p>
                    </div>

                    {/* Add Category Form */}
                    <form onSubmit={handleAddCategory} className="mb-8">
                        <input
                            type="text"
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            placeholder="Nama Kelompok Program Baru (Contoh: Pemberdayaan Wanita)"
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-semibold text-sm hover:bg-indigo-600 transition-colors">
                            Simpan Data
                        </button>
                    </form>

                    {/* Category List Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-bold uppercase text-slate-400 border-b-2 border-slate-100 tracking-widest">
                                    <th className="pb-4 px-3">Informasi</th>
                                    <th className="pb-4 px-3">Keterangan</th>
                                    <th className="pb-4 px-3 text-center">Peserta</th>
                                    <th className="pb-4 px-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {programs.map(p => {
                                    const catName = typeof p.category === 'object' ? p.category.name : p.category;
                                    const budget = Number(p.budget) || 0;
                                    const allocated = Number(p.allocatedAmount) || 0;
                                    
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-5 px-3">
                                                <div className="font-semibold text-base text-slate-900 leading-tight">{p.title}</div>
                                                <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">{catName}</div>
                                            </td>
                                            <td className="py-5 px-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[11px] text-slate-500 font-medium">
                                                        Alokasi: <span className="text-indigo-600 font-bold text-sm">Rp {allocated.toLocaleString('id-ID')}</span> / 
                                                        Total: <span className="text-slate-900">Rp {budget.toLocaleString('id-ID')}</span>
                                                    </div>
                                                    {/* Visual Progress Bar - Individual Program */}
                                                    <div className="w-48 h-2 bg-slate-100 rounded-full mt-1 overflow-hidden shadow-inner">
                                                        <div 
                                                            className={`h-full transition-all duration-700 ${allocated >= budget ? 'bg-rose-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`}
                                                            style={{ width: `${Math.min(100, (allocated / (budget || 1)) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-3 text-center">
                                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-xs font-bold">
                                                    👥 {Number(p.participantCount) || 0} Mitra
                                                </span>
                                            </td>
                                            <td className="py-5 px-3 text-right">
                                                <button onClick={() => handleDelete(p.id)} className="text-rose-600 font-bold text-sm hover:text-rose-700">Hapus</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {programs.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="py-12 text-center text-slate-400 font-bold">Belum ada program yang terdaftar.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <>
                    {/* Info Box */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-8">
                        <p className="text-sm text-indigo-900 leading-relaxed">
                            <strong>Keterangan:</strong> Melalui tab ini, Anda dapat mendaftarkan rincian program pembangunan spesifik, menentukan target anggaran, serta memilih wilayah lokasi pelaksanaan program. Program yang aktif akan muncul di katalog publik portal CSR.
                        </p>
                    </div>

                    {/* Program Form */}
                    <form key={editItem?.id || 'new'} onSubmit={handleSubmit}
                        className={`p-6 rounded-3xl mb-8 border-2 ${editItem ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="title" required placeholder="Judul Program" defaultValue={editItem?.title || ''}
                                className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium" />
                            <select name="category" required defaultValue={editItem?.category || ''}
                                className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium">
                                <option value="">Pilih Kategori</option>
                                {categories.map(c => { const name = typeof c === 'object' ? c.name : c; return <option key={name} value={name}>{name}</option>; })}
                            </select>
                            <div className="md:col-span-2 bg-slate-50/50 p-4 rounded-3xl border border-dashed border-slate-200">
                                <LocationPicker defaultValue={editItem?.location || ''} />
                            </div>
                            <input name="budget" required type="number" placeholder="Anggaran" defaultValue={editItem?.budget ? Number(editItem.budget) : ''}
                                className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium" />
                            <input name="year" required type="number" placeholder="Tahun Program (Contoh: 2024)" defaultValue={editItem?.year || new Date().getFullYear()}
                                className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium md:col-span-2" />
                        </div>
                        <textarea name="description" placeholder="Deskripsi" defaultValue={editItem?.description || ''} rows="3"
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium mt-4" />
                        <input name="beneficiaries" placeholder="Penerima Manfaat" defaultValue={editItem?.beneficiaries || ''}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium mt-4 hidden" />
                        <input name="image" type="hidden" defaultValue={editItem?.image || ''} />
                        <input name="impactScore" type="hidden" defaultValue={editItem?.impactScore || 0} />
                        <input name="tags" type="hidden" defaultValue={editItem?.tags || ''} />
                        <div className="flex gap-3 mt-5">
                            <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-semibold text-sm hover:bg-indigo-600 transition-colors">
                                {editItem ? 'Simpan Perubahan' : 'Simpan Data'}
                            </button>
                            {editItem && <button type="button" onClick={() => setEditItem(null)} className="px-6 py-3 bg-slate-100 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>}
                        </div>
                    </form>

                    {/* Program Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-bold uppercase text-slate-400 border-b-2 border-slate-100 tracking-widest">
                                    <th className="pb-4 px-3">Judul</th>
                                    <th className="pb-4 px-3">Kategori</th>
                                    <th className="pb-4 px-3">Anggaran</th>
                                    <th className="pb-4 px-3">Tahun</th>
                                    <th className="pb-4 px-3">Lokasi</th>
                                    <th className="pb-4 px-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {programs.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-3 font-semibold text-sm text-slate-900 max-w-[200px] truncate">{p.title}</td>
                                        <td className="py-4 px-3 text-xs text-slate-500">{typeof p.category === 'object' ? p.category.name : p.category}</td>
                                        <td className="py-4 px-3 text-xs font-bold text-slate-700">Rp {Number(p.budget).toLocaleString('id-ID')}</td>
                                        <td className="py-4 px-3 text-xs text-slate-500">{p.year}</td>
                                        <td className="py-4 px-3 text-xs text-slate-500">{typeof p.location === 'object' ? p.location.name : p.location}</td>
                                        <td className="py-4 px-3 text-right space-x-2">
                                            <button onClick={() => setEditItem(p)} className="text-indigo-600 font-bold text-xs">Edit</button>
                                            <button onClick={() => handleDelete(p.id)} className="text-rose-600 font-bold text-xs">Hapus</button>
                                        </td>
                                    </tr>
                                ))}
                                {programs.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-slate-400 font-bold">Belum ada program.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
