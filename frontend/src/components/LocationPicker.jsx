import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * LocationPicker - Komponen dropdown wilayah Indonesia dinamis (Emsifa API)
 * Hierarki: Provinsi -> Kabupaten/Kota -> Kecamatan -> Desa
 * 
 * @param {string} defaultValue - Nilai awal (format string dipisahkan koma)
 * @param {function} onChange - Callback saat lokasi berubah: (locationString) => void
 */
export default function LocationPicker({ defaultValue = '', onChange }) {
    const [provinces, setProvinces] = useState([]);
    const [regencies, setRegencies] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [villages, setVillages] = useState([]);

    const [selectedProv, setSelectedProv] = useState('');
    const [selectedReg, setSelectedReg] = useState('');
    const [selectedDist, setSelectedDist] = useState('');
    const [selectedVill, setSelectedVill] = useState('');

    const [loading, setLoading] = useState(false);

    // Fetch Provinces on Mount
    useEffect(() => {
        setLoading(true);
        axios.get('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
            .then(res => setProvinces(res.data))
            .catch(err => console.error('Gagal load provinsi:', err))
            .finally(() => setLoading(false));
    }, []);

    // Handlers
    const handleProvChange = (e) => {
        const id = e.target.value;
        const name = provinces.find(p => p.id === id)?.name || '';
        setSelectedProv(id);
        
        // Reset children
        setSelectedReg('');
        setSelectedDist('');
        setSelectedVill('');
        setRegencies([]);
        setDistricts([]);
        setVillages([]);

        if (id) {
            setLoading(true);
            axios.get(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${id}.json`)
                .then(res => setRegencies(res.data))
                .finally(() => setLoading(false));
        }
        
        updateParent(name);
    };

    const handleRegChange = (e) => {
        const id = e.target.value;
        const name = regencies.find(r => r.id === id)?.name || '';
        setSelectedReg(id);

        setSelectedDist('');
        setSelectedVill('');
        setDistricts([]);
        setVillages([]);

        if (id) {
            setLoading(true);
            axios.get(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${id}.json`)
                .then(res => setDistricts(res.data))
                .finally(() => setLoading(false));
        }

        const provName = provinces.find(p => p.id === selectedProv)?.name || '';
        updateParent(`${provName}, ${name}`);
    };

    const handleDistChange = (e) => {
        const id = e.target.value;
        const name = districts.find(d => d.id === id)?.name || '';
        setSelectedDist(id);

        setSelectedVill('');
        setVillages([]);

        if (id) {
            setLoading(true);
            axios.get(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${id}.json`)
                .then(res => setVillages(res.data))
                .finally(() => setLoading(false));
        }

        const provName = provinces.find(p => p.id === selectedProv)?.name || '';
        const regName = regencies.find(r => r.id === selectedReg)?.name || '';
        updateParent(`${provName}, ${regName}, ${name}`);
    };

    const handleVillChange = (e) => {
        const id = e.target.value;
        const name = villages.find(v => v.id === id)?.name || '';
        setSelectedVill(id);

        const provName = provinces.find(p => p.id === selectedProv)?.name || '';
        const regName = regencies.find(r => r.id === selectedReg)?.name || '';
        const distName = districts.find(d => d.id === selectedDist)?.name || '';
        updateParent(`${provName}, ${regName}, ${distName}, ${name}`);
    };

    const [locationString, setLocationString] = useState(defaultValue);

    const updateParent = (fullString) => {
        setLocationString(fullString);
        if (onChange) onChange(fullString);
    };

    const selectStyle = "bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-full appearance-none transition-all hover:border-indigo-300";

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provinsi */}
                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Provinsi</label>
                    <select 
                        value={selectedProv} 
                        onChange={handleProvChange}
                        className={selectStyle}
                    >
                        <option value="">Pilih Provinsi</option>
                        {provinces.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* Kabupaten */}
                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Kabupaten / Kota</label>
                    <select 
                        value={selectedReg} 
                        onChange={handleRegChange}
                        disabled={!selectedProv || loading}
                        className={`${selectStyle} ${(!selectedProv || loading) ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                    >
                        <option value="">Pilih Kabupaten</option>
                        {regencies.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                {/* Kecamatan */}
                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Kecamatan</label>
                    <select 
                        value={selectedDist} 
                        onChange={handleDistChange}
                        disabled={!selectedReg || loading}
                        className={`${selectStyle} ${(!selectedReg || loading) ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                    >
                        <option value="">Pilih Kecamatan</option>
                        {districts.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                {/* Desa */}
                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Kelurahan / Desa</label>
                    <select 
                        value={selectedVill} 
                        onChange={handleVillChange}
                        disabled={!selectedDist || loading}
                        className={`${selectStyle} ${(!selectedDist || loading) ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                    >
                        <option value="">Pilih Desa</option>
                        {villages.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            {/* Hidden Input for Form Submission Compatibility */}
            <input type="hidden" name="location" value={defaultValue || ''} />

            {loading && <div className="text-[10px] text-indigo-500 font-bold animate-pulse ml-1">📍 Sedang memuat data wilayah...</div>}
        </div>
    );
}
