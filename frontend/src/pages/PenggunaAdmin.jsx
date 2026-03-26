import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ROLES = ['Admin', 'Super Admin', 'Perusahaan', 'Pemerintah', 'Operator', 'Verifikator', 'User'];

export default function PenggunaAdmin() {
    const [users, setUsers] = useState([]);
    const [editItem, setEditItem] = useState(null);

    useEffect(() => {
        api.get('/users').then(r => setUsers(r.data || []))
            .catch(e => console.error('Gagal load pengguna:', e));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const item = { name: fd.get('name'), email: fd.get('email'), role: fd.get('role') };
        try {
            if (editItem) {
                await api.put('/users/' + editItem.id, item);
                setUsers(prev => prev.map(x => x.id === editItem.id ? { ...x, ...item } : x));
                setEditItem(null); e.target.reset();
                alert('Pengguna berhasil diperbarui!');
            }
        } catch (err) { alert('Gagal menyimpan.'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin hapus pengguna ini?')) return;
        try {
            await api.delete('/users/' + id);
            setUsers(prev => prev.filter(x => x.id !== id));
        } catch (err) { alert('Gagal menghapus.'); }
    };

    return (
        <div className="animate-fade-in">
            {editItem && (
                <form onSubmit={handleSubmit}
                    className="p-6 rounded-3xl mb-8 border-2 bg-indigo-50/50 border-indigo-200">
                    <h4 className="text-sm font-black text-slate-800 mb-4">Edit Pengguna</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input name="name" required placeholder="Nama" defaultValue={editItem.name}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm" />
                        <input name="email" required type="email" placeholder="Email" defaultValue={editItem.email}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm" />
                        <select name="role" required defaultValue={editItem.role}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-3 mt-5">
                        <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm">Simpan</button>
                        <button type="button" onClick={() => setEditItem(null)} className="px-6 py-3 bg-slate-100 rounded-2xl font-bold text-sm">Batal</button>
                    </div>
                </form>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                            <th className="pb-3 px-3">Nama</th>
                            <th className="pb-3 px-3">Email</th>
                            <th className="pb-3 px-3">Role</th>
                            <th className="pb-3 px-3">Login Terakhir</th>
                            <th className="pb-3 px-3 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-3 font-bold text-sm text-slate-900">{u.name}</td>
                                <td className="py-3 px-3 text-xs text-slate-500">{u.email}</td>
                                <td className="py-3 px-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${u.role === 'Admin' || u.role === 'Super Admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="py-3 px-3 text-xs text-slate-400">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('id-ID') : '-'}</td>
                                <td className="py-3 px-3 text-right space-x-2">
                                    <button onClick={() => setEditItem(u)} className="text-indigo-600 font-bold text-xs">Edit</button>
                                    <button onClick={() => handleDelete(u.id)} className="text-rose-600 font-bold text-xs">Hapus</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
