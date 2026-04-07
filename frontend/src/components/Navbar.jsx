import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Bell } from 'lucide-react';
import api from '../services/api';

const Navbar = () => {
    const { isAuthenticated, user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const loc = useLocation();
    const [notifCount, setNotifCount] = useState(0);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'Admin') {
            const fetchNotifs = async () => {
                try {
                    const res = await api.get('submissions');
                    const pending = res.data.filter(s => s.status === 'Pending' || s.status === 'Menunggu Verifikasi').length;
                    setNotifCount(pending);
                } catch (e) { console.error('Notif fetch error:', e); }
            };
            fetchNotifs();
            const interval = setInterval(fetchNotifs, 30000); // Polling every 30s
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, user]);

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
                    {isAuthenticated && user?.role === 'Admin' && (
                        <Link to="/mitra" className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors group">
                            <Bell className={`w-6 h-6 ${notifCount > 0 ? 'animate-[pulse_2s_infinite]' : ''}`} />
                            {notifCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                                    {notifCount > 9 ? '9+' : notifCount}
                                </span>
                            )}
                            
                            {/* Hover Tooltip */}
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white shadow-xl rounded-xl border border-slate-100 p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-2 group-hover:translate-y-0 z-[60]">
                                <p className="text-[11px] font-bold text-slate-800">
                                    {notifCount > 0 
                                        ? `Ada ${notifCount} pengajuan kontribusi baru yang perlu diverifikasi.` 
                                        : 'Tidak ada notifikasi baru.'}
                                </p>
                            </div>
                        </Link>
                    )}

                    {isAuthenticated ? (
                        !loc.pathname.startsWith('/admin') && (
                            <button onClick={handleLogout} className="text-sm font-black text-rose-600 px-4 py-2 hover:bg-rose-50 rounded-xl transition-all">
                                Logout
                            </button>
                        )
                    ) : (
                        <Link to="/login" className="hidden sm:block text-sm font-black text-slate-900 px-4 py-2 hover:bg-slate-50 rounded-xl">Login</Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
