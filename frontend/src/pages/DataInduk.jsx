import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function DataInduk() {
    const [masterTab, setMasterTab] = useState('profile');
    const [orgProfile, setOrgProfile] = useState({ name: '', vision: '', mission: '', address: '', email: '', phone: '', website: '', licenseKey: '', logo: '' });
    const [sectors, setSectors] = useState([]);
    const [locations, setLocations] = useState([]);
    const [editItem, setEditItem] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const fileRef = useRef(null);

    useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const [profRes, secRes, locRes] = await Promise.all([
                    api.get('org-profile'),
                    api.get('sectors'),
                    api.get('locations')
                ]);
                setOrgProfile(profRes.data || {});
                setLogoPreview(profRes.data?.logo || null);
                setSectors(secRes.data || []);
                setLocations(locRes.data || []);
            } catch (error) {
                console.error('Gagal fetch master data:', error);
            }
        };
        fetchMasterData();
    }, []);

    const handleDelete = async (type, id) => {
        if (!window.confirm(`Yakin menghapus ${id}?`)) return;
        try {
            if (type === 'sector') {
                await api.delete('sectors/' + encodeURIComponent(id));
            } else if (type === 'location') {
                await api.delete('locations/' + encodeURIComponent(id));
            }
            // Re-fetch to get neat ordering and IDs
            const [secRes, locRes] = await Promise.all([api.get('sectors'), api.get('locations')]);
            setSectors(secRes.data);
            setLocations(locRes.data);
            alert('Data berhasil dihapus.');
        } catch (error) {
            console.error(error);
            alert('Gagal menghapus data.');
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        try {
            const res = await api.post('upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data && res.data.url) {
                setLogoPreview(res.data.url);
            }
        } catch (err) {
            console.error('Upload Error:', err);
            alert('Terjadi error saat mengunggah, coba manual input link sementara jika gagal.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);

        if (masterTab === 'profile') {
            const updatedProfile = {
                name: fd.get('orgName'),
                vision: fd.get('vision'),
                mission: fd.get('mission'),
                address: fd.get('address'),
                email: fd.get('email'),
                phone: fd.get('phone'),
                website: fd.get('website'),
                licenseKey: fd.get('licenseKey'),
                logo: logoPreview
            };
            try {
                await api.post('org-profile', updatedProfile);
                setOrgProfile(updatedProfile);
                alert('Profil Organisasi berhasil disimpan ke Database!');
            } catch (error) {
                console.error(error);
                alert('Gagal menyimpan profil.');
            }
        } else {
            const isSector = masterTab === 'sector';
            const val = isSector ? fd.get('sectorName') : fd.get('locationName');
            if (!val || !val.trim()) { alert('Nama tidak boleh kosong.'); return; }

            const apiEndpoint = isSector ? 'sectors' : 'locations';

            try {
                if (editItem) {
                    await api.delete(`${apiEndpoint}/${encodeURIComponent(editItem.oldValue)}`);
                }
                await api.post(apiEndpoint, { name: val.trim() });

                // Re-fetch to get neat ordering and IDs
                const [secRes, locRes] = await Promise.all([api.get('sectors'), api.get('locations')]);
                setSectors(secRes.data);
                setLocations(locRes.data);

                setEditItem(null);
                e.target.reset();
                alert('Data berhasil disimpan!');
            } catch (err) {
                console.error(err);
                alert('Gagal menyimpan ke database.');
            }
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-8 w-fit border border-slate-200">
                {['profile', 'sector', 'location'].map(t => (
                    <button
                        key={t}
                        onClick={() => { setMasterTab(t); setEditItem(null); }}
                        className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${masterTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        {t === 'profile' ? 'Profil Organisasi' : t === 'sector' ? 'Sektor Industri' : 'Wilayah Kerja'}
                    </button>
                ))}
            </div>

            {masterTab === 'profile' ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Kiri: Logo Box */}
                        <div className="w-full md:w-[280px] flex flex-col items-center gap-4 shrink-0">
                            <div className="w-48 h-48 bg-white border border-slate-200 rounded-[40px] flex items-center justify-center shadow-sm overflow-hidden">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <svg className="w-16 h-16 text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z" />
                                    </svg>
                                )}
                            </div>
                            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleLogoUpload} />
                            <button type="button" onClick={() => fileRef.current?.click()} className="px-6 py-2.5 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-colors w-48 shadow-sm cursor-pointer">
                                GANTI LOGO
                            </button>
                        </div>

                        {/* Kanan: Lisensi & Info */}
                        <div className="flex-1 w-full space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Kunci Lisensi Sistem</label>
                                <div className="flex items-center gap-3 bg-indigo-50/50 border border-indigo-100 text-indigo-600 px-5 py-4 rounded-2xl w-full text-sm font-bold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    {orgProfile.licenseKey || 'LISENSI-BELUM-TERDAFTAR'}
                                </div>
                                <input type="hidden" name="licenseKey" defaultValue={orgProfile.licenseKey || 'TRIAL-123'} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Nama Organisasi</label>
                                    <input name="orgName" required type="text" placeholder="PT Tomo Teknologi Sinergi" defaultValue={orgProfile.name} className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Email Resmi</label>
                                    <input name="email" required type="email" placeholder="csr@pemda.go.id" defaultValue={orgProfile.email} className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">No. Telepon</label>
                                    <input name="phone" required type="text" placeholder="022-1234567" defaultValue={orgProfile.phone} className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Website</label>
                                    <input name="website" required type="text" placeholder="www.csr-pemda.go.id" defaultValue={orgProfile.website} className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 pt-4 mt-2 border-t border-slate-100">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Alamat Kantor</label>
                            <textarea name="address" required defaultValue={orgProfile.address} rows="2" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-800"></textarea>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Visi</label>
                            <textarea name="vision" required defaultValue={orgProfile.vision} rows="2" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-800"></textarea>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Misi</label>
                            <textarea name="mission" required defaultValue={orgProfile.mission} rows="3" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-800"></textarea>
                        </div>
                        <button type="submit" className="mt-2 w-fit bg-slate-900 text-white px-10 py-4 rounded-[16px] font-black text-sm hover:bg-slate-800 transition-colors">
                            Simpan Data
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <form key={editItem?.oldValue || 'new'} onSubmit={handleSubmit} className={`p-8 rounded-3xl mb-8 border-2 flex gap-4 ${editItem ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                        {masterTab === 'sector' ? (
                            <input name="sectorName" required type="text" placeholder="Nama Sektor Industri" defaultValue={editItem?.type === 'sector' ? editItem.value : ''} className="flex-1 bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm" />
                        ) : (
                            <input name="locationName" required type="text" placeholder="Nama Lokasi Wilayah" defaultValue={editItem?.type === 'location' ? editItem.value : ''} className="flex-1 bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm" />
                        )}
                        <button type="submit" className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-sm whitespace-nowrap">
                            {editItem ? 'Simpan' : 'Tambah'}
                        </button>
                    </form>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(masterTab === 'sector' ? sectors : locations).map(item => (
                            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">{item.id}</span>
                                    <span className="font-bold text-slate-700">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button type="button" onClick={() => setEditItem({ type: masterTab, oldValue: item.name, value: item.name })} className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50">✏️</button>
                                    <button type="button" onClick={() => handleDelete(masterTab, item.name)} className="p-2 text-rose-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
