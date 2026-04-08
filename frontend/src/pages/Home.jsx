import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

function ProgramCard({ program, onSelect }) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-xl transition-all group cursor-pointer" onClick={() => onSelect(program)}>
            <div className="relative h-48 overflow-hidden">
                <img src={program.image || `https://picsum.photos/seed/${program.id}/600/400`} alt={program.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-4 left-4 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest">{program.category}</span>
            </div>
            <div className="p-6">
                <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">{program.title}</h3>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{program.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {program.location}
                </div>
                <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-600 text-sm">Rp {(program.budget || 0).toLocaleString('id-ID')}</span>
                    <span className="text-xs text-slate-400">{program.year}</span>
                </div>
            </div>
            <div className="px-6 pb-6">
                <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">Lihat Detail & Dukung</button>
            </div>
        </div>
    );
}

function ProgramModal({ program, onClose }) {
    const [amount, setAmount] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const submission = {
            companyName: fd.get('companyName'),
            contactPerson: fd.get('contactPerson'),
            email: fd.get('email'),
            phone: fd.get('phone'), // Tambahkan nomor HP
            programId: program.id,
            status: 'Pending',
            commitmentAmount: Number(amount) || 0,
            submittedAt: new Date().toISOString().split('T')[0]
        };
        try {
            await api.post('submissions', submission);
        } catch (err) { console.error('Gagal kirim:', err); }
        setSubmitted(true);
        setTimeout(() => { setSubmitted(false); setShowForm(false); onClose(); }, 4000);
    };

    const budget = Number(program.budget) || 0;
    const allocated = Number(program.allocatedAmount) || 0;
    const remaining = budget - allocated;
    const isClosed = remaining <= 0;
    const isOverBudget = Number(amount) > remaining;

    if (!program) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-6 bg-slate-900/70 backdrop-blur-md">
            <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl overflow-y-auto shadow-2xl flex flex-col relative border border-slate-200">
                <button onClick={() => { onClose(); setShowForm(false); }} className="absolute top-6 right-6 z-30 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-colors hidden md:block backdrop-blur-md border border-white/30">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {showForm ? (
                    <div className="p-6 md:p-12">
                        {submitted ? (
                            <div className="bg-emerald-50 border-2 border-emerald-100 p-10 rounded-3xl text-center">
                                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl text-3xl">✓</div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">Pendaftaran Terkirim!</h3>
                                <p className="text-slate-600 mb-8">Terima kasih. Tim kami akan menghubungi Anda dalam 1x24 jam.</p>
                                <button onClick={() => { onClose(); setShowForm(false); setSubmitted(false); }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold">Selesai</button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="mb-10">
                                    <button type="button" onClick={() => setShowForm(false)} className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-4">← Kembali ke Detail</button>
                                    
                                    {/* Budget Summary Box as requested */}
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 text-center">
                                        <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-1">Status Anggaran Program</div>
                                        <div className="text-lg font-black text-emerald-700 mb-1">Tahun {program.year}</div>
                                        <div className="text-[11px] text-emerald-600 font-medium">
                                            Anggaran: <span className="font-bold">Rp {budget.toLocaleString('id-ID')}</span> | 
                                            Dialokasikan: <span className="font-bold text-indigo-600">Rp {allocated.toLocaleString('id-ID')}</span> | 
                                            Sisa: <span className="font-bold text-rose-600">Rp {remaining.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="mt-2">
                                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-[11px] font-bold">
                                                👥 {Number(program.participantCount) || 0} Mitra telah bergabung
                                            </span>
                                        </div>
                                    </div>

                                    <h2 className="text-3xl font-black text-slate-900 mb-2">Formulir Kemitraan CSR</h2>
                                    <p className="text-slate-500">Program: <span className="font-bold text-slate-900">{program.title}</span></p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <input required type="text" name="companyName" placeholder="Nama Perusahaan" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
                                    <select name="sector" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-medium">
                                        {['Manufaktur', 'Perbankan', 'Teknologi', 'Consumer Goods', 'Energi'].map(s => <option key={s}>{s}</option>)}
                                    </select>
                                    <input required type="text" name="contactPerson" placeholder="Nama Kontak Person" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-medium" />
                                    <input required type="email" name="email" placeholder="Email Bisnis" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-medium" />
                                    <input required type="text" name="phone" placeholder="Nomor WhatsApp (Contoh: 08123456789)" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-medium md:col-span-2" />
                                    <div className="md:col-span-2 relative">
                                        <span className={`absolute left-5 top-4 font-black transition-colors ${isOverBudget ? 'text-rose-500' : 'text-slate-400'}`}>Rp</span>
                                        <input 
                                            required 
                                            type="number" 
                                            name="commitmentAmount" 
                                            min="0" 
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="Nominal Pendanaan (misal: 150000000)" 
                                            className={`w-full bg-slate-50 border rounded-2xl pl-14 pr-5 py-4 outline-none font-medium transition-all ${isOverBudget ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-100' : 'border-slate-200 focus:ring-2 focus:ring-indigo-500'}`} 
                                        />
                                        {isOverBudget && (
                                            <p className="text-rose-500 text-[11px] font-bold mt-2 ml-2 flex items-center gap-1 animate-fade-in">
                                                <span>⚠️</span> Maaf, nominal melebihi sisa anggaran (Sisa: Rp {remaining.toLocaleString('id-ID')})
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={isClosed || isOverBudget || !amount}
                                    className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all ${isClosed || isOverBudget || !amount ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
                                >
                                    {isClosed ? 'Pendaftaran Ditutup (Anggaran Penuh)' : isOverBudget ? 'Dana Melebihi Anggaran' : 'Kirim Formulir Kemitraan →'}
                                </button>
                            </form>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="relative h-64 md:h-[400px] w-full flex-shrink-0">
                            <img src={program.image || `https://picsum.photos/seed/${program.id}/800/500`} alt={program.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        </div>
                        <div className="p-6 md:p-12 flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest">{program.category}</span>
                                <span className="text-sm text-slate-400">📍 {program.location}</span>
                            </div>
                            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 mb-6 leading-tight">{program.title}</h2>
                            <p className="text-slate-600 mb-10 text-base md:text-lg leading-relaxed">{program.description}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
                                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                                    <div className="text-[10px] text-indigo-400 uppercase font-black mb-1 tracking-widest">Target Pendanaan ({program.year})</div>
                                    <div className="text-2xl font-black text-indigo-600">Rp {(program.budget || 0).toLocaleString('id-ID')}</div>
                                </div>
                                <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                                    <div className="text-[10px] text-emerald-400 uppercase font-black mb-1 tracking-widest">Penerima Manfaat</div>
                                    <div className="text-2xl font-black text-emerald-600">{program.beneficiaries}</div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button onClick={() => setShowForm(true)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all text-center">⚡ Daftar Jadi Mitra CSR</button>
                                <button onClick={() => alert('Mengunduh proposal PDF...')} className="px-8 py-4 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 text-center">📄 Proposal PDF</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const Home = () => {
    const [programs, setPrograms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeFilter, setActiveFilter] = useState('All');
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState(() => {
        const saved = sessionStorage.getItem('csr_chat_history');
        return saved ? JSON.parse(saved) : [{ role: 'bot', content: 'Selamat datang. Saya adalah Konsultan CSR Senior Anda. Saya siap membantu merumuskan strategi kontribusi sosial perusahaan Anda melalui program-program prioritas yang tepat sasaran. Silakan deskripsikan pilar atau sektor (Pendidikan, Kesehatan, Ekonomi, Lingkungan) yang ingin Anda dukung hari ini.' }];
    });
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [lastProgramId, setLastProgramId] = useState(() => sessionStorage.getItem('csr_last_program_id'));

    useEffect(() => {
        sessionStorage.setItem('csr_chat_history', JSON.stringify(chatMessages));
    }, [chatMessages]);

    useEffect(() => {
        if (lastProgramId) sessionStorage.setItem('csr_last_program_id', lastProgramId);
    }, [lastProgramId]);

    // Auto-scroll to bottom of chat
    const chatEndRef = React.useRef(null);
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, isTyping]);

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!userInput.trim()) return;

        const newMsg = { role: 'user', content: userInput };
        setChatMessages(prev => [...prev, newMsg]);
        setUserInput('');
        setIsTyping(true);

        try {
            const res = await api.post('chat', {
                message: userInput,
                contextProgramId: lastProgramId
            });
            setChatMessages(prev => [...prev, { role: 'bot', content: res.data.reply }]);
            if (res.data.programId) {
                setLastProgramId(res.data.programId);
            }
        } catch (err) {
            console.error('Chat Error:', err);
            setChatMessages(prev => [...prev, { role: 'bot', content: 'Terjadi kesalahan saat menghubungi asisten AI. Silakan coba lagi nanti.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const [progRes, catRes] = await Promise.all([
                    api.get('programs'),
                    api.get('categories')
                ]);

                if (catRes.data && Array.isArray(catRes.data)) {
                    setCategories(catRes.data.map(c => typeof c === 'object' ? c.name : c));
                }

                const data = progRes.data?.data || progRes.data;
                if (Array.isArray(data)) {
                    const parsed = data.map(p => ({
                        ...p,
                        category: typeof p.category === 'object' ? p.category.name : p.category,
                        location: typeof p.location === 'object' ? p.location.name : p.location,
                        tags: typeof p.tags === 'string' ? p.tags.split(',') : (p.tags || [])
                    }));
                    setPrograms(parsed);
                }
            } catch (err) {
                console.error('Gagal load data:', err);
                setPrograms([]);
            }
        };
        loadData();
    }, []);

    const filtered = useMemo(() =>
        activeFilter === 'All' ? programs : programs.filter(p => p.category === activeFilter),
        [activeFilter, programs]
    );

    const totalAllocated = programs.reduce((s, p) => s + (Number(p.allocatedAmount) || 0), 0);

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Hero - identik dengan website asli */}
            <section className="mb-12 bg-indigo-900 rounded-3xl p-8 md:p-16 text-white relative overflow-hidden">
                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">Membangun Bersama untuk Masa Depan Berkelanjutan</h1>
                    <p className="text-lg text-indigo-100 mb-8">Wujudkan kontribusi sosial perusahaan Anda melalui program-program prioritas pemerintah daerah yang transparan dan berdampak luas.</p>
                    <div className="flex flex-wrap gap-4">
                        <button onClick={() => { const el = document.getElementById('katalog'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg">Jelajahi Program</button>
                        <Link to="/stats" className="bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-800 transition-colors border border-indigo-500 shadow-lg">Lihat Capaian Impact</Link>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block">
                    <img src="https://picsum.photos/seed/gov/800/600" alt="Gov" className="object-cover w-full h-full opacity-40 mix-blend-overlay" />
                </div>
            </section>

            {/* Stats Cards - identik 4 kolom */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                {[
                    { label: 'PROGRAM BERJALAN', val: programs.length.toString() },
                    { label: 'TOTAL DANA TERHIMPUN', val: 'Rp ' + (totalAllocated / 1e9).toFixed(1) + ' M' },
                    { label: 'SEKTOR PRIORITAS', val: categories.length.toString() },
                    { label: 'TARGET PENERIMA', val: '15.400+' }
                ].map((s, i) => (
                    <div key={i} className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <div className="text-xl md:text-2xl font-bold text-indigo-600 mb-1">{s.val}</div>
                        <div className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Katalog Program Prioritas */}
            <div className="mb-8" id="katalog">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-slate-900">Katalog Program Prioritas</h2>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto">
                        {['All', ...categories].map(cat => (
                            <button key={cat} onClick={() => setActiveFilter(cat)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeFilter === cat ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{cat}</button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.map(p => <ProgramCard key={p.id} program={p} onSelect={setSelectedProgram} />)}
                    {filtered.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-slate-100 rounded-3xl border-2 border-dashed border-slate-200">
                            <p className="text-slate-400 font-bold">Belum ada program untuk kategori ini.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Konsultasi Button */}
            <div className="fixed bottom-8 right-8 z-40">
                {!isChatOpen ? (
                    <button
                        onClick={() => setIsChatOpen(true)}
                        className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 animate-bounce-subtle"
                    >
                        <span className="text-xl">💬</span> Konsultasi Program
                    </button>
                ) : (
                    <div className="bg-white w-[350px] md:w-[400px] h-[500px] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-zoom-in">
                        {/* Chat Header */}
                        <div className="bg-indigo-600 p-5 text-white flex justify-between items-center shadow-lg relative z-10 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="font-bold text-sm">Konsultan CSR Senior</div>
                                    <div className="text-[10px] opacity-70">Sistem Rekomendasi Pintar</div>
                                </div>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Chat Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100'
                                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-sm'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 flex gap-1 shadow-sm">
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Chat Footer */}
                        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Tanyakan rekomendasi program..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!userInput.trim() || isTyping}
                                className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Modal */}
            {selectedProgram && <ProgramModal program={selectedProgram} onClose={() => setSelectedProgram(null)} />}
        </div>
    );
};

export default Home;
