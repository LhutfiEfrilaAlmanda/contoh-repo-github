import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
    const { isAuthenticated, user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const loc = useLocation();

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
                    {isAuthenticated ? (
                        <button onClick={handleLogout} className="text-sm font-black text-rose-600 px-4 py-2 hover:bg-rose-50 rounded-xl">Logout</button>
                    ) : (
                        <Link to="/login" className="hidden sm:block text-sm font-black text-slate-900 px-4 py-2 hover:bg-slate-50 rounded-xl">Login</Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
