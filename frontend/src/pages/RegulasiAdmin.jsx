import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function RegulasiAdmin() {
    const [regulations, setRegulations] = useState([]);
    const [editItem, setEditItem] = useState(null);

    useEffect(() => {
        api.get('regulations').then(r => setRegulations(r.data || []))
            .catch(e => console.error('Gagal load regulasi:', e));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const config = { headers: { 'Content-Type': 'multipart/form-data' } };

        try {
            if (editItem) {
                const r = await api.put('regulations/' + editItem.id, fd, config);
                setRegulations(prev => prev.map(x => x.id === editItem.id ? r.data : x));
            } else {
                const r = await api.post('regulations', fd, config);
                setRegulations(prev => [...prev, r.data]);
            }
            setEditItem(null); e.target.reset();
            alert('Regulasi berhasil disimpan!');
        } catch (err) { alert('Gagal menyimpan.'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin hapus regulasi ini?')) return;
        try {
            await api.delete('regulations/' + id);
            setRegulations(prev => prev.filter(x => x.id !== id));
        } catch (err) { alert('Gagal menghapus.'); }
    };

    return (
        <div className="animate-fade-in">
            <form key={editItem?.id || 'new'} onSubmit={handleSubmit}
                className={`p-6 rounded-3xl mb-8 border-2 ${editItem ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="title" required placeholder="Judul Regulasi" defaultValue={editItem?.title || ''}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm" />
                    <input name="number" required placeholder="Nomor Regulasi" defaultValue={editItem?.number || ''}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm" />
                    <input name="year" required type="number" placeholder="Tahun" defaultValue={editItem?.year || new Date().getFullYear()}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm" />
                    <select name="type" required defaultValue={editItem?.type || ''}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
                        <option value="">Pilih Jenis</option>
                        <option value="Peraturan Daerah">Peraturan Daerah</option>
                        <option value="Peraturan Gubernur">Peraturan Gubernur</option>
                        <option value="Peraturan Bupati">Peraturan Bupati</option>
                        <option value="Surat Keputusan">Surat Keputusan</option>
                        <option value="Instruksi">Instruksi</option>
                    </select>
                </div>
                <div className="mt-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Berkas Pendukung (PDF)</label>
                    <input type="file" name="file" accept=".pdf" className="text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100" />
                    {editItem?.fileUrl && <p className="mt-2 text-[10px] text-emerald-600 font-bold italic">✓ File sudah terunggah</p>}
                </div>
                <textarea name="description" placeholder="Deskripsi Regulasi" defaultValue={editItem?.description || ''} rows="2"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm mt-4" />
                <div className="flex gap-3 mt-5">
                    <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm">
                        {editItem ? 'Simpan Perubahan' : 'Tambah Regulasi'}
                    </button>
                    {editItem && <button type="button" onClick={() => setEditItem(null)} className="px-6 py-3 bg-slate-100 rounded-2xl font-bold text-sm">Batal</button>}
                </div>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                            <th className="pb-3 px-3">Judul</th>
                            <th className="pb-3 px-3">Nomor</th>
                            <th className="pb-3 px-3">Tahun</th>
                            <th className="pb-3 px-3">Jenis</th>
                            <th className="pb-3 px-3 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {regulations.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-3 font-bold text-sm text-slate-900 max-w-[250px] truncate">{r.title}</td>
                                <td className="py-3 px-3 text-xs text-slate-500">{r.number}</td>
                                <td className="py-3 px-3 text-xs text-slate-500">{r.year}</td>
                                <td className="py-3 px-3"><span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full">{r.type}</span></td>
                                <td className="py-3 px-3 text-right space-x-2">
                                    <button onClick={() => setEditItem(r)} className="text-indigo-600 font-bold text-xs">Edit</button>
                                    <button onClick={() => handleDelete(r.id)} className="text-rose-600 font-bold text-xs">Hapus</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
