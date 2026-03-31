import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, Shield, Edit, Trash2, Lock } from 'lucide-react';

const ROLES = ['Admin', 'Operator', 'Perusahaan', 'Pemerintah', 'Verifikator', 'User'];

const ROLE_DEFINITIONS = [
    {
        name: 'Administrator',
        description: 'Memiliki kendali penuh terhadap seluruh modul sistem dan pengaturan.',
        menus: ['Ringkasan', 'Data Induk', 'Tahun Fiskal', 'Program CSR', 'Mitra Industri', 'Regulasi', 'Laporan CSR', 'Pengguna', 'Profil Saya'],
        color: 'rose'
    },
    {
        name: 'Operator',
        description: 'Bertugas memasukkan data operasional program, mitra, dan mengelola laporan.',
        menus: ['Ringkasan', 'Program CSR', 'Mitra Industri', 'Laporan CSR', 'Profil Saya'],
        color: 'indigo'
    }
];

export default function PenggunaAdmin() {
    const [users, setUsers] = useState([]);
    const [editItem, setEditItem] = useState(null);
    const [activeTab, setActiveTab] = useState('pengguna'); // 'pengguna' | 'peran'

    useEffect(() => {
        api.get('users').then(r => setUsers(r.data || []))
            .catch(e => console.error('Gagal load pengguna:', e));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const item = { name: fd.get('name'), email: fd.get('email'), role: fd.get('role') };
        try {
            if (editItem) {
                await api.put('users/' + editItem.id, item);
                setUsers(prev => prev.map(x => x.id === editItem.id ? { ...x, ...item } : x));
                setEditItem(null); e.target.reset();
                alert('Pengguna berhasil diperbarui!');
            }
        } catch (err) { alert('Gagal menyimpan.'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin hapus pengguna ini?')) return;
        try {
            await api.delete('users/' + id);
            setUsers(prev => prev.filter(x => x.id !== id));
        } catch (err) { alert('Gagal menghapus.'); }
    };

    return (
        <div className="animate-fade-in">
            {/* TABS */}
            <div className="flex items-center gap-6 mb-8 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('pengguna')}
                    className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all ${
                        activeTab === 'pengguna' 
                        ? 'border-indigo-600 text-indigo-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Users className="w-5 h-5" /> Daftar Pengguna
                </button>
                <button
                    onClick={() => setActiveTab('peran')}
                    className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all ${
                        activeTab === 'peran' 
                        ? 'border-indigo-600 text-indigo-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Shield className="w-5 h-5" /> Peran & Hak Akses
                </button>
            </div>

            {/* TAB CONTENT: PENGGUNA */}
            {activeTab === 'pengguna' && (
                <div>
                    {editItem && (
                        <form onSubmit={handleSubmit}
                            className="p-6 rounded-3xl mb-8 border-2 bg-indigo-50/50 border-indigo-200 shadow-sm">
                            <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                                <Edit className="w-4 h-4 text-indigo-600" /> Edit Pengguna
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input name="name" required placeholder="Nama" defaultValue={editItem.name}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                <input name="email" required type="email" placeholder="Email" defaultValue={editItem.email}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                <select name="role" required defaultValue={editItem.role}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 mt-5">
                                <button type="submit" className="px-8 py-3 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 rounded-2xl font-black text-xs uppercase tracking-wider">Simpan</button>
                                <button type="button" onClick={() => setEditItem(null)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-600">Batal</button>
                            </div>
                        </form>
                    )}

                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                        <th className="py-4 px-6">Nama Pengguna</th>
                                        <th className="py-4 px-6">Email</th>
                                        <th className="py-4 px-6">Peran</th>
                                        <th className="py-4 px-6">Login Terakhir</th>
                                        <th className="py-4 px-6 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map((u, idx) => (
                                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-6 font-bold text-sm text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600">
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {u.name}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-xs font-semibold text-slate-500">{u.email}</td>
                                            <td className="py-4 px-6">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 ${u.role === 'Admin' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-xs text-slate-400 font-medium">
                                                {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                                            </td>
                                            <td className="py-4 px-6 text-right space-x-3">
                                                <button onClick={() => setEditItem(u)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Edit">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(u.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100" title="Hapus">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: PERAN & HAK AKSES */}
            {activeTab === 'peran' && (
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-slate-200 flex items-center gap-3 bg-slate-50/50">
                        <Lock className="w-5 h-5 text-slate-400" />
                        <h3 className="font-bold text-slate-800 text-sm">Daftar Peran Sistem Terkonfigurasi</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50">
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                    <th className="py-4 px-6 w-1/5">Nama Peran</th>
                                    <th className="py-4 px-6 w-1/3">Deskripsi Otoritas</th>
                                    <th className="py-4 px-6">Hak Akses Menu</th>
                                    <th className="py-4 px-6 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ROLE_DEFINITIONS.map((role, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-5 px-6">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-${role.color}-50 text-${role.color}-600 border border-${role.color}-200`}>
                                                {role.name}
                                            </span>
                                        </td>
                                        <td className="py-5 px-6 text-xs text-slate-600 font-medium leading-relaxed">
                                            {role.description}
                                        </td>
                                        <td className="py-5 px-6">
                                            <div className="flex flex-wrap gap-2">
                                                {role.menus.map((menu, mIdx) => (
                                                    <span key={mIdx} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 bg-${role.color}-50 text-${role.color}-700 rounded-md border border-${role.color}-100`}>
                                                        {menu}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-5 px-6 text-right space-x-2">
                                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Edit (Disabled)">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
