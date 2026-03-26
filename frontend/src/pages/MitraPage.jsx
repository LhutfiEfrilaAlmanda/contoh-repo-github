import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Building2, MapPin, Phone, Calendar } from 'lucide-react';

const MitraPage = () => {
    const [activeTab, setActiveTab] = useState('direktori'); // 'direktori' | 'kontribusi'
    const [partners, setPartners] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Partners
                const pRes = await api.get('/partners');
                setPartners(pRes.data);

                // Fetch Submissions (Kontribusi)
                const sRes = await api.get('/submissions');
                setSubmissions(sRes.data);

                // Fetch Programs for resolving Program Titles
                const progRes = await api.get('/programs');
                // Handle different API response structures just in case
                const progData = Array.isArray(progRes.data) ? progRes.data : (progRes.data.data || []);
                setPrograms(progData);
            } catch (error) {
                console.error("Error fetching data:", error);
                // Fallbacks on error
                setPartners([
                    { id: "m-1", companyName: "PT Telkom Indonesia", logo: "", sector: "Telekomunikasi", address: "Jl. Jenderal Gatot Subroto No.52, Jakarta", phone: "021-5215111", contributionCount: 12, joinedYear: 2020 },
                    { id: "m-2", companyName: "Bank Mandiri", logo: "", sector: "Perbankan", address: "Jl. Jenderal Gatot Subroto Kav. 36-38, Jakarta", phone: "021-5265045", contributionCount: 8, joinedYear: 2021 },
                    { id: "m-4", companyName: "Pertamina", logo: "", sector: "Energi", address: "Jl. Medan Merdeka Timur No.1A, Jakarta", phone: "021-3815111", contributionCount: 15, joinedYear: 2019 }
                ]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const getProgramTitle = (programId) => {
        const prog = programs.find(p => p.id === programId);
        return prog ? prog.title : 'Program ' + programId;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    };

    return (
        <div className="bg-slate-50 min-h-[calc(100vh-80px)] font-sans">
            {/* Header Section */}
            <section className="bg-slate-50 pt-20 pb-12 text-center">
                <div className="container mx-auto px-6">
                    <h1 className="text-3xl md:text-5xl font-bold text-slate-800 mb-6 drop-shadow-sm tracking-tight">Kemitraan Strategis</h1>
                    <p className="text-slate-500 font-medium text-base md:text-lg max-w-3xl mx-auto leading-relaxed mb-12">
                        Sinergi antara pemerintah daerah and mitra industri untuk menciptakan<br className="hidden md:block" /> dampak sosial yang berkelanjutan.
                    </p>

                    {/* Tab Switcher */}
                    <div className="flex bg-white rounded-2xl shadow-sm border border-slate-200 p-1.5 w-fit mx-auto transition-all">
                        <button
                            onClick={() => setActiveTab('direktori')}
                            className={`px-8 py-3.5 rounded-[12px] font-bold text-sm transition-all ${activeTab === 'direktori' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Direktori Mitra CSR
                        </button>
                        <button
                            onClick={() => setActiveTab('kontribusi')}
                            className={`px-8 py-3.5 rounded-[12px] font-bold text-sm transition-all ${activeTab === 'kontribusi' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Kontribusi Mitra CSR
                        </button>
                    </div>
                </div>
            </section>

            {/* Content Section */}
            <section className="container mx-auto px-6 pb-24">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    activeTab === 'direktori' ? (
                        /* TAB: DIREKTORI MITRA */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {partners.map((p, index) => (
                                <div key={p.id} className="bg-white rounded-[32px] p-8 pb-0 border border-slate-200 shadow-xl shadow-slate-200/40 relative overflow-hidden flex flex-col hover:-translate-y-1 transition-transform animate-fade-in group" style={{ animationDelay: `${index * 50}ms` }}>

                                    {/* Decorative Top Right Shape */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[100px] -z-10 group-hover:bg-indigo-100/50 transition-colors"></div>

                                    <div className="flex items-center gap-5 mb-8 z-10">
                                        <div className="w-20 h-20 bg-slate-100 rounded-[20px] overflow-hidden flex-shrink-0 border border-slate-100">
                                            {p.logo ? (
                                                <img src={p.logo} alt={p.companyName || p.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={`https://picsum.photos/seed/${p.id}/150/150`} alt={p.companyName || p.name} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800 leading-tight mb-2">{p.companyName || p.name}</h3>
                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                {p.sector || 'Sektor Utama'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-8 flex-1">
                                        <div className="flex items-start gap-3 text-sm text-slate-500">
                                            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                            <span className="line-clamp-2 md:line-clamp-3 leading-relaxed">{p.address || '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                                            <span>{p.phone || '-'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-6 border-t border-slate-100">
                                        <div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bergabung</div>
                                            <div className="text-lg font-bold text-slate-800">{p.joinedYear || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">Total Impact</div>
                                            <div className="text-lg font-bold text-slate-800">{p.contributionCount || 0} Program</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {partners.length === 0 && (
                                <div className="col-span-full py-20 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-3xl">
                                    Belum ada data mitra industri.
                                </div>
                            )}
                        </div>
                    ) : (
                        /* TAB: KONTRIBUSI MITRA */
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/40 p-1 md:p-8 animate-fade-in overflow-hidden">
                            <div className="overflow-x-auto p-4 md:p-0">
                                <table className="w-full text-left min-w-[700px]">
                                    <thead>
                                        <tr className="border-b-2 border-slate-100">
                                            <th className="pb-5 px-4 text-[11px] text-slate-400 font-black uppercase tracking-widest w-2/5">Mitra & Program</th>
                                            <th className="pb-5 px-4 text-[11px] text-slate-400 font-black uppercase tracking-widest">Nilai Komitmen</th>
                                            <th className="pb-5 px-4 text-[11px] text-slate-400 font-black uppercase tracking-widest">Status Realisasi</th>
                                            <th className="pb-5 px-4 text-[11px] text-slate-400 font-black uppercase tracking-widest text-right">Tanggal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {submissions.length > 0 ? submissions.map((sub, i) => (
                                            <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="py-6 px-4">
                                                    <div className="text-base font-bold text-slate-800 mb-0.5 leading-tight group-hover:text-indigo-600 transition-colors">{sub.companyName}</div>
                                                    <div className="text-xs font-medium text-slate-500 line-clamp-1">{getProgramTitle(sub.programId)}</div>
                                                </td>
                                                <td className="py-6 px-4">
                                                    <div className="text-sm font-bold text-slate-800">
                                                        Rp {(Number(sub.commitmentAmount) || 0).toLocaleString('id-ID')}
                                                    </div>
                                                </td>
                                                <td className="py-6 px-4">
                                                    {sub.status === 'Approved' || sub.status?.toLowerCase() === 'terealisasi' ? (
                                                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                            TEREALISASI
                                                        </span>
                                                    ) : sub.status === 'Pending' ? (
                                                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                            MENUNGGU VERIFIKASI
                                                        </span>
                                                    ) : (
                                                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                            {sub.status || 'PENDING'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-6 px-4 text-right">
                                                    <div className="text-xs font-semibold text-slate-500 flex items-center justify-end gap-2">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        {formatDate(sub.submittedAt)}
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" className="py-20 text-center text-slate-400 font-bold border-dashed border-2 border-slate-100 rounded-3xl mt-4">
                                                    Belum ada data kontribusi mitra.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                )}
            </section>
        </div>
    );
};

export default MitraPage;
