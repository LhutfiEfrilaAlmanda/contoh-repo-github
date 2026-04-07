import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Bell, Trash2, User, ChevronDown, LogOut, Settings } from 'lucide-react';
import api from '../services/api';

const Navbar = () => {
    const { isAuthenticated, user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const loc = useLocation();
    const [notifs, setNotifs] = useState([]);
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const fetchNotifs = async () => {
        if (isAuthenticated && user?.role === 'Admin') {
            try {
                const res = await api.get('notifications');
                setNotifs(res.data || []);
            } catch (e) { console.error('Notif fetch error:', e); }
        }
    };

    useEffect(() => {
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, user]);

    const unreadCount = notifs.filter(n => !n.is_read).length;

    const handleMarkAllRead = async () => {
        try {
            await api.put('notifications/read-all');
            setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch (e) { console.error(e); }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('Yakin ingin menghapus seluruh riwayat notifikasi?')) return;
        try {
            await api.delete('notifications');
            setNotifs([]);
        } catch (e) { console.error(e); }
    };

    const handleDeleteOne = async (e, id) => {
        e.stopPropagation(); // Prevent dropdown from closing
        try {
            await api.delete(`notifications/${id}`);
            setNotifs(prev => prev.filter(n => n.id !== id));
        } catch (e) { console.error(e); }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const links = [
        { label: 'Program', path: '/' },
        { label: 'Mitra CSR', path: '/mitra' },
        { label: 'Statistik', path: '/stats' },
        { label: 'Regulasi', path: '/regulasi' }
    ];

    return (
        <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl">P</div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 leading-tight">Portal CSR</h1>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Pemerintah Daerah</p>
                    </div>
                </Link>

                <div className="hidden lg:flex items-center gap-6 text-sm font-bold text-slate-500">
                    {links.map(l => (
                        <Link key={l.label} to={l.path} className={`transition-all ${loc.pathname === l.path ? 'text-indigo-600' : 'hover:text-indigo-600'}`}>{l.label}</Link>
                    ))}
                    {isAuthenticated && (
                        <Link to="/admin" className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${loc.pathname === '/admin' ? 'bg-slate-900 text-white' : 'text-slate-400 border border-slate-200 hover:text-slate-900 hover:border-slate-900'}`}>Panel Admin</Link>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* Notification Bell */}
                    {isAuthenticated && user?.role === 'Admin' && (
                        <div className="relative">
                            <button 
                                onClick={() => setShowNotifMenu(!showNotifMenu)}
                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors relative"
                            >
                                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-[pulse_2s_infinite]' : ''}`} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown Menu */}
                            {showNotifMenu && (
                                <>
                                    <div className="fixed inset-0 z-[55]" onClick={() => setShowNotifMenu(false)}></div>
                                    <div className="absolute top-full right-0 mt-3 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                            <div>
                                                <h3 className="font-black text-xs uppercase tracking-widest text-slate-800">Notifikasi Pesan</h3>
                                                {notifs.length > 0 && (
                                                    <button 
                                                        onClick={handleDeleteAll}
                                                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 mt-1 uppercase tracking-tighter"
                                                    >
                                                        Bersihkan Semua
                                                    </button>
                                                )}
                                            </div>
                                            {unreadCount > 0 && (
                                                <button 
                                                    onClick={handleMarkAllRead}
                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                                                >
                                                    Tandai Dibaca
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-[350px] overflow-y-auto">
                                            {notifs.length > 0 ? (
                                                notifs.map(n => (
                                                    <div 
                                                        key={n.id} 
                                                        className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group relative ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                                                    >
                                                        <div className="flex gap-3 pr-6">
                                                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                                                n.type === 'success' ? 'bg-emerald-500' : 
                                                                n.type === 'warning' ? 'bg-rose-500' : 'bg-indigo-500'
                                                            } ${!n.is_read ? 'opacity-100' : 'opacity-0'}`}></div>
                                                            <div>
                                                                <p className="text-[12px] text-slate-700 leading-relaxed font-medium">{n.message}</p>
                                                                <p className="text-[10px] text-slate-400 mt-1 font-bold italic">
                                                                    {new Date(n.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        <button 
                                                            onClick={(e) => handleDeleteOne(e, n.id)}
                                                            className="absolute top-4 right-3 p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                                            title="Hapus"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-8 text-center">
                                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                        <Bell className="w-6 h-6 text-slate-200" />
                                                    </div>
                                                    <p className="text-slate-400 text-xs font-bold italic">Tidak ada notifikasi aktivitas.</p>
                                                </div>
                                            )}
                                        </div>
                                        <Link 
                                            to="/admin" 
                                            onClick={() => setShowNotifMenu(false)}
                                            className="block p-3 text-center bg-slate-50 text-[11px] font-black text-slate-500 hover:text-indigo-600 transition-colors border-t border-slate-100"
                                        >
                                            LIHAT SEMUA AKTIVITAS
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* User Profile */}
                    {isAuthenticated ? (
                        <div className="relative flex items-center gap-3 pl-4 border-l border-slate-100">
                            <div className="hidden sm:flex flex-col items-end">
                                <span className="text-sm font-black text-slate-900 leading-none lowercase">
                                    {user?.name || 'admin'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 mt-1 capitalize">
                                    {user?.role === 'Admin' ? 'Administrator' : user?.role || 'Guest'}
                                </span>
                            </div>
                            
                            <button 
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 group p-1 rounded-xl hover:bg-slate-50 transition-all"
                            >
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 group-hover:border-indigo-300 transition-all">
                                    <User className="w-5 h-5" />
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {/* User Profile Dropdown Menu */}
                            {showUserMenu && (
                                <>
                                    <div className="fixed inset-0 z-[55]" onClick={() => setShowUserMenu(false)}></div>
                                    <div className="absolute top-full right-0 mt-3 w-56 bg-white shadow-2xl rounded-2xl border border-slate-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Akun Saya</p>
                                            <p className="text-xs font-bold text-slate-700 truncate">{user?.email}</p>
                                        </div>
                                        <div className="p-2">
                                            <Link 
                                                to="/admin" 
                                                onClick={() => setShowUserMenu(false)}
                                                className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                                            >
                                                <Settings className="w-4 h-4" />
                                                Pengaturan Dashboard
                                            </Link>
                                            <button 
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Keluar Aplikasi
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <Link to="/login" className="hidden sm:block text-sm font-black text-slate-900 px-4 py-2 hover:bg-slate-50 rounded-xl">Login</Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
