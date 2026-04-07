import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { Users, Shield, Edit, Trash2, Lock, Search, CheckSquare, Square, X } from 'lucide-react';

const ROLES = ['Admin', 'Operator', 'Perusahaan', 'Pemerintah', 'Verifikator', 'User'];

const AVAILABLE_MENUS = [
    'Ringkasan', 'Data Induk', 'Tahun Fiskal', 'Program CSR', 
    'Mitra Industri', 'Regulasi', 'Laporan CSR', 'Pengguna', 'Profil Saya'
];

export default function PenggunaAdmin() {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';
    
    const [users, setUsers] = useState([]);
    const [rolesDb, setRolesDb] = useState([]);
    
    const [editItem, setEditItem] = useState(null);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [editRoleItem, setEditRoleItem] = useState(null);
    const [isAddingRole, setIsAddingRole] = useState(false);
    
    const [activeTab, setActiveTab] = useState('pengguna');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        api.get('users').then(r => setUsers(r.data || [])).catch(e => console.error('Gagal load pengguna:', e));
        fetchRoles();
    }, []);

    const fetchRoles = () => {
        api.get('roles').then(r => setRolesDb(r.data || [])).catch(e => console.error('Gagal load peran:', e));
    };

    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        // Kumpulkan semua menu yang diceklis
        const checkedMenus = [];
        AVAILABLE_MENUS.forEach(menu => {
            if (fd.get(`menu_${menu}`) === 'on') checkedMenus.push(menu);
        });

        const item = { 
            role_name: fd.get('role_name'), 
            description: fd.get('description'), 
            color: fd.get('color'),
            menus: checkedMenus
        };

        try {
            if (editRoleItem && !isAddingRole) {
                await api.put('roles/' + editRoleItem.id, item);
                alert('Konfigurasi Hak Akses berhasil diperbarui!');
            } else {
                await api.post('roles', item);
                alert('Peran baru berhasil ditambahkan!');
            }
            setEditRoleItem(null);
            setIsAddingRole(false);
            fetchRoles();
        } catch (err) { alert('Gagal menyimpan pengaturan hak akses.'); }
    };

    const handleDeleteRole = async (id, roleName) => {
        if (!isAdmin) return;
        if (roleName.toLowerCase() === 'administrator' || roleName.toLowerCase() === 'super admin') {
            alert('Akses Ditolak: Peran utama sistem tidak boleh dihapus.');
            return;
        }
        if (!window.confirm(`Yakin ingin menghapus peran "${roleName}"? Akses menu bagi pengguna dengan peran ini mungkin akan terganggu.`)) return;
        try {
            await api.delete('roles/' + id);
            fetchRoles();
        } catch (err) { alert('Gagal menghapus peran.'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const item = { name: fd.get('name'), email: fd.get('email'), role: fd.get('role') };
        try {
            if (isAddingUser) {
                const res = await api.post('users', item);
                setUsers(prev => [...prev, { ...item, id: res.data.id, lastLogin: res.data.lastLogin }]);
                setIsAddingUser(false); e.target.reset();
                alert('Pengguna baru berhasil ditambahkan!');
            } else if (editItem) {
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
                    {/* SEARCH & ADD BAR */}
                    <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
                        <div className="relative flex-1 w-full">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="w-5 h-5 text-slate-400" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Cari berdasarkan nama, email, peran, atau instansi..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                            />
                        </div>
                        {isAdmin && (
                            <button 
                                onClick={() => { setIsAddingUser(true); setEditItem(null); }}
                                className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                            >
                                <Users className="w-4 h-4" /> Tambah Pengguna
                            </button>
                        )}
                    </div>

                    {(editItem || isAddingUser) && (
                        <form onSubmit={handleSubmit}
                            className="p-6 rounded-3xl mb-8 border-2 bg-indigo-50/50 border-indigo-200 shadow-sm relative">
                            <button 
                                type="button"
                                onClick={() => { setEditItem(null); setIsAddingUser(false); }}
                                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                                <Edit className="w-4 h-4 text-indigo-600" /> {isAddingUser ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input name="name" required placeholder="Nama Lengkap" defaultValue={editItem?.name || ''}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                <input name="email" required type="text" placeholder="Username / Email" defaultValue={editItem?.email || ''}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                <select name="role" required defaultValue={editItem?.role || 'User'}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 mt-5">
                                <button type="submit" className="px-8 py-3 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 rounded-2xl font-black text-xs uppercase tracking-wider">
                                    {isAddingUser ? 'Simpan Pengguna' : 'Perbarui Pengguna'}
                                </button>
                                <button type="button" onClick={() => { setEditItem(null); setIsAddingUser(false); }} className="px-6 py-3 bg-slate-200 hover:bg-slate-300 transition-colors rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-600">Batal</button>
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
                                    {users.filter(u => 
                                        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        u.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        u.instansi?.toLowerCase().includes(searchQuery.toLowerCase())
                                    ).map((u, idx) => (
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
                                                <button onClick={() => { setEditItem(u); setIsAddingUser(false); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Edit">
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
                    <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <Lock className="w-5 h-5 text-slate-400" />
                            <h3 className="font-bold text-slate-800 text-sm">Daftar Peran Sistem Terkonfigurasi</h3>
                        </div>
                        {isAdmin && (
                            <button onClick={() => { setEditRoleItem({ role_name: '', description: '', menus: [], color: 'slate' }); setIsAddingRole(true); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm">
                                + Tambah Peran Baru
                            </button>
                        )}
                    </div>
                    
                    {editRoleItem && isAdmin && (
                        <div className="p-6 border-b-2 border-slate-100 bg-slate-50/50 relative">
                            <button onClick={() => { setEditRoleItem(null); setIsAddingRole(false); }} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                            <h4 className="text-sm font-black text-slate-800 mb-5 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-indigo-600" /> {isAddingRole ? 'Buat Peran Baru' : 'Konfigurasi Hak Akses'}
                            </h4>
                            <form onSubmit={handleRoleSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Nama Peran</label>
                                        <input name="role_name" required defaultValue={editRoleItem.role_name} readOnly={!isAddingRole && editRoleItem.role_name.toLowerCase() === 'administrator'} className={`w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${!isAddingRole && editRoleItem.role_name.toLowerCase() === 'administrator' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-800'}`} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Deskripsi</label>
                                        <input name="description" required defaultValue={editRoleItem.description} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Warna Identitas</label>
                                        <select name="color" defaultValue={editRoleItem.color || 'slate'} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                            <option value="rose">Rose (Merah)</option>
                                            <option value="indigo">Indigo (Ungu)</option>
                                            <option value="emerald">Emerald (Hijau)</option>
                                            <option value="amber">Amber (Kuning)</option>
                                            <option value="sky">Sky (Biru)</option>
                                            <option value="slate">Slate (Abu-abu)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mb-6">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Hak Akses Modul / Menu</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {AVAILABLE_MENUS.map(menu => {
                                            const isChecked = editRoleItem.menus?.includes(menu) || false;
                                            return (
                                                <label key={menu} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                                                    <input type="checkbox" name={`menu_${menu}`} defaultChecked={isChecked} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                                    <span className="text-sm font-semibold text-slate-700">{menu}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button type="submit" className="px-8 py-3 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 rounded-2xl font-black text-xs uppercase tracking-wider">Simpan Hak Akses</button>
                                </div>
                            </form>
                        </div>
                    )}

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
                                {rolesDb.map((role, idx) => (
                                    <tr key={role.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-5 px-6">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-${role.color}-50 text-${role.color}-600 border border-${role.color}-200`}>
                                                {role.role_name}
                                            </span>
                                        </td>
                                        <td className="py-5 px-6 text-xs text-slate-600 font-medium leading-relaxed">
                                            {role.description}
                                        </td>
                                        <td className="py-5 px-6">
                                            <div className="flex flex-wrap gap-2">
                                                {(role.menus || []).map((menu, mIdx) => (
                                                    <span key={mIdx} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 bg-${role.color}-50 text-${role.color}-700 rounded-md border border-${role.color}-100`}>
                                                        {menu}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-5 px-6 text-right space-x-2">
                                            {isAdmin ? (
                                                <>
                                                    <button onClick={() => { setEditRoleItem(role); setIsAddingRole(false); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Konfigurasi Akses">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    {role.role_name.toLowerCase() !== 'administrator' && role.role_name.toLowerCase() !== 'super admin' && (
                                                        <button onClick={() => handleDeleteRole(role.id, role.role_name)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100" title="Hapus Peran">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Khusus Admin</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {rolesDb.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="py-10 text-center text-slate-400 font-bold">Memuat konfigurasi peran...</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
