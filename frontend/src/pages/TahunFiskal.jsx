import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function TahunFiskal() {
    const [fiscalYears, setFiscalYears] = useState([]);
    const [editItem, setEditItem] = useState(null);

    useEffect(() => {
        api.get('fiscal-years').then(r => setFiscalYears(r.data || []))
            .catch(e => console.error('Gagal load tahun fiskal:', e));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const item = {
            year: Number(fd.get('year')),
            description: fd.get('description') || '',
            status: editItem?.status || 'Inactive'
        };

        try {
            if (editItem) {
                await api.put('fiscal-years/' + editItem.id, item);
                setFiscalYears(prev => prev.map(x => x.id === editItem.id ? { ...x, ...item } : x));
            } else {
                const r = await api.post('fiscal-years', item);
                setFiscalYears(prev => [r.data, ...prev]);
            }
            setEditItem(null);
            e.target.reset();
            alert('Tahun Fiskal berhasil disimpan!');
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan tahun fiskal.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin menghapus tahun fiskal ini?')) return;
        try {
            await api.delete('fiscal-years/' + id);
            setFiscalYears(prev => prev.filter(x => x.id !== id));
            alert('Tahun fiskal dihapus.');
        } catch (err) {
            alert('Gagal menghapus.');
        }
    };

    const handleSetActive = async (id) => {
        try {
            // Set semua jadi Inactive dulu, lalu set yang dipilih jadi Active
            for (const fy of fiscalYears) {
                if (fy.id !== id && fy.status === 'Active') {
                    await api.put('fiscal-years/' + fy.id, { ...fy, status: 'Inactive' });
                }
            }
            const target = fiscalYears.find(f => f.id === id);
            await api.put('fiscal-years/' + id, { ...target, status: 'Active' });
            setFiscalYears(prev => prev.map(x => ({ ...x, status: x.id === id ? 'Active' : 'Inactive' })));
            alert('Tahun fiskal aktif diperbarui.');
        } catch (err) {
            alert('Gagal update status.');
        }
    };

    return (
        <div className="animate-fade-in">
            <form key={editItem?.id || 'new-fiscal'} onSubmit={handleSubmit}
                className={`p-8 rounded-3xl mb-8 border-2 ${editItem ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <input name="year" required type="number" placeholder="Tahun Fiskal (Contoh: 2024)"
                        defaultValue={editItem?.year || ''}
                        className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm" />
                    <input name="description" type="text" placeholder="Deskripsi (Opsional)"
                        defaultValue={editItem?.description || ''}
                        className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm" />
                </div>
                <div className="flex gap-3 mt-6">
                    <button type="submit" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm">
                        {editItem ? 'Simpan Perubahan' : 'Tambah Tahun Fiskal'}
                    </button>
                    {editItem && (
                        <button type="button" onClick={() => setEditItem(null)}
                            className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm">
                            Batal
                        </button>
                    )}
                </div>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                            <th className="pb-4 px-4">Tahun</th>
                            <th className="pb-4 px-4">Deskripsi</th>
                            <th className="pb-4 px-4 text-center">Status</th>
                            <th className="pb-4 px-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {fiscalYears.map(fy => (
                            <tr key={fy.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-4 px-4 font-semibold text-base text-slate-900">{fy.year}</td>
                                <td className="py-4 px-4 text-xs text-slate-500">{fy.description || '-'}</td>
                                <td className="py-4 px-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${fy.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                        {fy.status === 'Active' ? 'Aktif' : 'Non-Aktif'}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-right space-x-2">
                                    {fy.status !== 'Active' && (
                                        <button onClick={() => handleSetActive(fy.id)}
                                            className="text-emerald-600 font-bold text-xs">Set Aktif</button>
                                    )}
                                    <button onClick={() => setEditItem(fy)}
                                        className="text-indigo-600 font-bold text-xs">Edit</button>
                                    <button onClick={() => handleDelete(fy.id)}
                                        className="text-rose-600 font-bold text-xs">Hapus</button>
                                </td>
                            </tr>
                        ))}
                        {fiscalYears.length === 0 && (
                            <tr><td colSpan="4" className="py-8 text-center text-slate-400 text-sm">Belum ada data tahun fiskal.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
