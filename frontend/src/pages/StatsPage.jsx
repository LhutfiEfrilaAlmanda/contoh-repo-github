import React, { useMemo, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const StatsPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Diambil dari backend API gateway port 5000 -> 5005 (Stats)
                const response = await api.get('stats/dashboard');
                setStats(response.data);
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return <div className="p-20 text-center font-bold text-slate-500">Memuat statistik...</div>;
    }

    if (!stats) {
        return <div className="p-20 text-center font-bold text-slate-500">Gagal memuat statistik.</div>;
    }

    const formatRp = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 min-h-screen">
            <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4 tracking-tight">Capaian & Dampak CSR</h2>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto">Transparansi data realisasi kontribusi mitra untuk pembangunan daerah yang terukur.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Total Realisasi Dana</p>
                    <p className="text-2xl lg:text-3xl font-bold text-indigo-600">{formatRp(stats.totalFund)}</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Mitra Berkontribusi</p>
                    <p className="text-2xl lg:text-3xl font-bold text-slate-800">{stats.partnerCount} Perusahaan</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Total Program Berjalan</p>
                    <p className="text-2xl lg:text-3xl font-bold text-slate-800">{stats.programCount} Program</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 text-lg mb-8 flex items-center gap-3">
                        <span className="w-2 h-6 bg-indigo-600 rounded-full"></span> Alokasi Anggaran per Sektor
                    </h4>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.categories || []} layout="vertical" margin={{ left: 30, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide={true} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                                <Tooltip formatter={(v) => formatRp(v)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="budget" radius={[0, 10, 10, 0]}>
                                    {(stats.categories || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 text-lg mb-8 flex items-center gap-3">
                        <span className="w-2 h-6 bg-indigo-600 rounded-full"></span> Distribusi Program Prioritas
                    </h4>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.categories || []}
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="count"
                                    nameKey="name"
                                    label
                                >
                                    {(stats.categories || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPage;
