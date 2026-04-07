import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Trash2, Edit3, PlusCircle, Search } from 'lucide-react';

export default function PilarAdmin() {
    const [pillars, setPillars] = useState([]);
    const [sdgs, setSdgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({ kode_pilar: '', nama_pilar: '', keterangan: '', sdg_ids: [] });

    useEffect(() => {
        fetchPillars();
        fetchSDGs();
    }, []);

    const fetchPillars = async () => {
        try {
            const res = await api.get('pillars');
            setPillars(res.data);
            setLoading(false);
        } catch (err) { console.error(err); setLoading(false); }
    };

    const fetchSDGs = async () => {
        try {
            const res = await api.get('sdgs');
            setSdgs(res.data);
        } catch (err) { console.error(err); }
    };

    const handleToggleSDG = (id) => {
        setFormData(prev => ({
            ...prev,
            sdg_ids: prev.sdg_ids.includes(id) 
                ? prev.sdg_ids.filter(x => x !== id) 
                : [...prev.sdg_ids, id]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editItem) {
                await api.put(`pillars/${editItem.id}`, formData);
            } else {
                await api.post('pillars', formData);
            }
            setShowModal(false);
            setEditItem(null);
            setFormData({ kode_pilar: '', nama_pilar: '', keterangan: '', sdg_ids: [] });
            fetchPillars();
            alert('Pilar berhasil disimpan!');
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan pilar.');
        }
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            kode_pilar: item.kode_pilar,
            nama_pilar: item.nama_pilar,
            keterangan: item.keterangan,
            sdg_ids: item.sdgs.map(s => s.sdg_id)
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus pilar ini?')) return;
        try {
            await api.delete(`pillars/${id}`);
            fetchPillars();
            alert('Pilar berhasil dihapus.');
        } catch (error) { console.error(error); }
    };

    const filteredPillars = pillars.filter(p => 
        p.nama_pilar.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.kode_pilar.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.keterangan && p.keterangan.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-end">
                <button 
                    onClick={() => { setEditItem(null); setFormData({ kode_pilar: '', nama_pilar: '', keterangan: '', sdg_ids: [] }); setShowModal(true); }}
                    className="bg-emerald-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-900 transition-all shadow-sm"
                >
                    <PlusCircle className="w-4 h-4" /> Tambah Data
                </button>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-8">
                <div className="flex justify-end mb-6">
                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari"
                            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-0">
                        <thead>
                            <tr className="text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                                <th className="px-4 py-4 font-black whitespace-nowrap" style={{width:'12%'}}>Kode Pilar</th>
                                <th className="px-4 py-4 font-black whitespace-nowrap" style={{width:'18%'}}>Nama Pilar</th>
                                <th className="px-4 py-4 font-black whitespace-nowrap" style={{width:'25%'}}>Keterangan</th>
                                <th className="px-4 py-4 font-black whitespace-nowrap" style={{width:'30%'}}>SDGs Terkait</th>
                                <th className="px-4 py-4 font-black whitespace-nowrap text-right" style={{width:'15%'}}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-8"><div className="h-4 bg-slate-100 rounded"></div></td>
                                    </tr>
                                ))
                            ) : (
                                filteredPillars.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-6 text-sm font-bold text-slate-700">{p.kode_pilar}</td>
                                        <td className="px-6 py-6 text-sm font-bold text-slate-700">{p.nama_pilar}</td>
                                        <td className="px-6 py-6 text-sm font-medium text-slate-500">{p.keterangan || '-'}</td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-wrap gap-2 max-w-md">
                                                {p.sdgs.map(s => (
                                                    <div key={s.id} className="bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg flex items-center gap-2">
                                                        <span className="text-amber-700 text-[11px] font-bold">{s.sdg_no}. {s.sdg_judul}</span>
                                                    </div>
                                                ))}
                                                {p.sdgs.length === 0 && <span className="text-slate-300 text-[10px] font-bold italic">Tidak ada mapping</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEdit(p)} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all">
                                                    <Edit3 className="w-3.5 h-3.5" /> Ubah
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all shadow-sm">
                                                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredPillars.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
                        Menampilkan 1 sampai {filteredPillars.length} dari {filteredPillars.length} hasil
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] animate-scale-up">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editItem ? 'Ubah Pilar' : 'Tambah Pilar Baru'}</h3>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer">×</button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Kode Pilar</label>
                                <input 
                                    value={formData.kode_pilar} 
                                    onChange={(e) => setFormData({...formData, kode_pilar: e.target.value})} 
                                    placeholder="Contoh: P1" 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nama Pilar</label>
                                <input 
                                    value={formData.nama_pilar} 
                                    onChange={(e) => setFormData({...formData, nama_pilar: e.target.value})} 
                                    placeholder="Contoh: Ekonomi" 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Keterangan</label>
                                <input 
                                    value={formData.keterangan} 
                                    onChange={(e) => setFormData({...formData, keterangan: e.target.value})} 
                                    placeholder="Contoh: Pilar Ekonomi" 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">SDGs Terkait</label>
                                <div className="border border-slate-100 rounded-2xl bg-slate-50/30 p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    <div className="flex flex-col">
                                        {sdgs.map(s => (
                                            <label 
                                                key={s.id} 
                                                className="flex items-center gap-4 p-3 hover:bg-white rounded-xl cursor-pointer transition-colors group"
                                            >
                                                <div className="relative flex items-center justify-center">
                                                    <input 
                                                        type="checkbox"
                                                        checked={formData.sdg_ids.includes(s.id)}
                                                        onChange={() => handleToggleSDG(s.id)}
                                                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                </div>
                                                <span className={`text-sm font-semibold transition-colors ${formData.sdg_ids.includes(s.id) ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>
                                                    {s.no_get}. {s.judul}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 border-t border-slate-100 flex justify-end">
                            <button onClick={handleSubmit} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                                SIMPAN PILAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
