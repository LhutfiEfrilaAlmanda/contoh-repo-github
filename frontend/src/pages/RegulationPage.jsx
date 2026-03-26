import React, { useEffect, useState } from 'react';
import api, { BASE_URL } from '../services/api';

const RegulationPage = () => {
    const [regulations, setRegulations] = useState([]);

    useEffect(() => {
        const fetchRegulations = async () => {
            try {
                const res = await api.get('regulations');
                if (res.data && res.data.length > 0) {
                    setRegulations(res.data);
                }
            } catch (err) {
                console.error("Gagal load regulasi:", err);
            }
        };
        fetchRegulations();
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 min-h-screen">
            <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4 tracking-tight">Pusat Regulasi CSR</h2>
                <p className="text-slate-500 text-base md:text-lg max-w-2xl mx-auto">Landasan hukum dan pedoman teknis pelaksanaan tanggung jawab sosial perusahaan di daerah.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {regulations.map(r => (
                    <div key={r.id} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-start gap-6 group hover:border-indigo-100 transition-all">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600 flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-lg text-slate-800 mb-1 leading-tight group-hover:text-indigo-600 transition-colors">{r.title}</h4>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{r.number}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">{r.type}</span>
                            </div>
                            <p className="text-slate-600 text-sm mb-6 leading-relaxed line-clamp-3">{r.description}</p>
                            {r.fileUrl ? (
                                <a href={`${BASE_URL}${r.fileUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider hover:gap-4 transition-all">
                                    Unduh Berkas →
                                </a>
                            ) : (
                                <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Berkas Belum Tersedia
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RegulationPage;
