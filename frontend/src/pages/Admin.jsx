import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import ReportUpload from './ReportUpload';
import DataInduk from './DataInduk';
import TahunFiskal from './TahunFiskal';
import ProgramCSR from './ProgramCSR';
import MitraIndustri from './MitraIndustri';
import RegulasiAdmin from './RegulasiAdmin';
import PenggunaAdmin from './PenggunaAdmin';
import {
    LayoutDashboard, Database, Calendar, Layers,
    Building2, FileText, Users, LogOut, ChevronRight, Upload
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const SIDEBAR_ITEMS = [
    { id: 'dashboard', label: 'Ringkasan', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['Super Admin', 'Admin', 'Operator'] },
    { id: 'master', label: 'Data Induk', icon: <Database className="w-5 h-5" />, roles: ['Super Admin', 'Admin'] },
    { id: 'fiscal', label: 'Tahun Fiskal', icon: <Calendar className="w-5 h-5" />, roles: ['Super Admin', 'Admin'] },
    { id: 'programs', label: 'Program CSR', icon: <Layers className="w-5 h-5" />, roles: ['Super Admin', 'Admin', 'Operator'] },
    { id: 'partners', label: 'Mitra Industri', icon: <Building2 className="w-5 h-5" />, roles: ['Super Admin', 'Admin', 'Operator'] },
    { id: 'regulations', label: 'Regulasi', icon: <FileText className="w-5 h-5" />, roles: ['Super Admin', 'Admin'] },
    { id: 'reports', label: 'Laporan CSR', icon: <Upload className="w-5 h-5" />, roles: ['Super Admin', 'Admin', 'Operator'] },
    { id: 'users', label: 'Pengguna', icon: <Users className="w-5 h-5" />, roles: ['Super Admin'] }
];

export default function Admin() {
    const { user } = useContext(AuthContext);
    const userRole = user?.role || '';

    // Filter allowed items based on user role
    const allowedItems = SIDEBAR_ITEMS.filter(item => {
        if (!item.roles) return true;
        return item.roles.includes(userRole);
    });

    const [activeSection, setActiveSection] = useState(allowedItems.length > 0 ? allowedItems[0].id : 'dashboard');
    const [stats, setStats] = useState({ programCount: 0, partnerCount: 0, totalFund: 0, categories: [] });
    // ... rest of state
    const [masterTab, setMasterTab] = useState('profile');
    const [programTab, setProgramTab] = useState('manage');
    const [partnerTab, setPartnerTab] = useState('directory');

    // Fetch dashboard stats dari Stats Service (:5005)
    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await api.get('/stats/dashboard');
                setStats({
                    programCount: res.data.programCount || 0,
                    partnerCount: res.data.partnerCount || 0,
                    reportCount: res.data.reportCount || 0,
                    totalFund: res.data.totalFund || 0,
                    categories: res.data.categories || [],
                    regions: res.data.regions || [],
                    sectors: res.data.sectors || []
                });
            } catch (error) {
                console.error("Gagal load stats dari API, pakai fallback", error);
                setStats({
                    programCount: 0, partnerCount: 0, totalFund: 0,
                    categories: []
                });
            }
        };
        fetchDashboard();
    }, []);

    const sectionTitle = {
        dashboard: 'Dashboard Eksekutif',
        master: 'Manajemen Data Induk',
        fiscal: 'Tahun Fiskal',
        programs: 'Manajemen Program CSR',
        partners: 'Direktori & Kontribusi Mitra',
        regulations: 'Regulasi Daerah',
        reports: 'Upload Laporan CSR',
        users: 'Hak Akses Pengguna'
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden min-h-[750px] flex flex-col md:flex-row">
                {/* SIDEBAR ADMINISTRATOR */}
                <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 p-6 flex-shrink-0 flex flex-col">
                    <h2 className="text-xl font-black text-slate-900 mb-8 px-2 tracking-tight">Admin<span className="text-indigo-600">Panel</span></h2>
                    <nav className="space-y-2 flex-1">
                        {allowedItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold text-sm transition-all group
                                    ${activeSection === item.id
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                        : 'text-slate-500 w hover:bg-slate-100 hover:text-slate-900'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`${activeSection === item.id ? 'text-indigo-100' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                                        {item.icon}
                                    </div>
                                    {item.label}
                                </div>
                                {activeSection === item.id && <ChevronRight className="w-4 h-4 opacity-50" />}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 p-8 md:p-12 overflow-y-auto bg-white relative">
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{sectionTitle[activeSection]}</h3>
                    </div>

                    {/* Dashboard Tab */}
                    {activeSection === 'dashboard' && (
                        <div className="animate-fade-in space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-2">Total Dana Tersalurkan</div>
                                    <div className="text-2xl xl:text-3xl font-bold">Rp {(stats.totalFund).toLocaleString('id-ID')}</div>
                                </div>
                                <div className="bg-slate-50 hover:bg-slate-100 transition-colors cursor-default p-8 rounded-[2rem] border border-slate-200">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Mitra Bergabung</div>
                                    <div className="text-2xl xl:text-3xl font-bold text-slate-800">{stats.partnerCount} <span className="text-base font-semibold text-slate-400">Entitas</span></div>
                                </div>
                                <div className="bg-slate-50 hover:bg-slate-100 transition-colors cursor-default p-8 rounded-[2rem] border border-slate-200">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Program Aktif</div>
                                    <div className="text-2xl xl:text-3xl font-bold text-slate-800">{stats.programCount} <span className="text-base font-semibold text-slate-400">Proyek</span></div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-3">
                                    <span className="w-2 h-6 bg-indigo-600 rounded-full"></span> Proporsi Dana Bidang Fokus
                                </h4>
                                <div className="h-[300px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.categories}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="budget" radius={[10, 10, 0, 0]}>
                                                {stats.categories.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b'][index % 4]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modul Upload Laporan CSR */}
                    {activeSection === 'reports' && (
                        <ReportUpload />
                    )}

                    {/* Modul Data Induk */}
                    {activeSection === 'master' && (
                        <DataInduk />
                    )}

                    {/* Modul Tahun Fiskal */}
                    {activeSection === 'fiscal' && (
                        <TahunFiskal />
                    )}

                    {/* Modul Program CSR */}
                    {activeSection === 'programs' && (
                        <ProgramCSR />
                    )}

                    {/* Modul Mitra Industri */}
                    {activeSection === 'partners' && (
                        <MitraIndustri />
                    )}

                    {/* Modul Regulasi */}
                    {activeSection === 'regulations' && (
                        <RegulasiAdmin />
                    )}

                    {/* Modul Pengguna */}
                    {activeSection === 'users' && (
                        <PenggunaAdmin />
                    )}
                </div>
            </div>
        </div>
    );
}
