import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { User, Mail, Building2, Shield, Clock, Camera, Lock, Eye, EyeOff, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ProfilSaya() {
    const { user, login } = useContext(AuthContext);
    
    // Profile state
    const [profileData, setProfileData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        instansi: '',
    });
    const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
    const [savingProfile, setSavingProfile] = useState(false);

    // Password state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
    const [savingPassword, setSavingPassword] = useState(false);

    // Active tab
    const [activeTab, setActiveTab] = useState('info');

    // Load profile on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get(`profile?email=${encodeURIComponent(user?.email)}`);
                if (res.data) {
                    setProfileData({
                        name: res.data.name || user?.name || '',
                        email: res.data.email || user?.email || '',
                        instansi: res.data.instansi || '',
                    });
                }
            } catch (err) {
                // Use local user data as fallback
                setProfileData({
                    name: user?.name || '',
                    email: user?.email || '',
                    instansi: '',
                });
            }
        };
        if (user?.email) fetchProfile();
    }, [user]);

    // Save profile
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileMsg({ type: '', text: '' });
        try {
            await api.put('profile', {
                email: user?.email,
                name: profileData.name,
                instansi: profileData.instansi,
            });
            // Update local storage user data
            const updatedUser = { ...user, name: profileData.name };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setProfileMsg({ type: 'success', text: 'Profil berhasil diperbarui!' });
        } catch (err) {
            setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan profil.' });
        }
        setSavingProfile(false);
        setTimeout(() => setProfileMsg({ type: '', text: '' }), 4000);
    };

    // Change password
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setSavingPassword(true);
        setPasswordMsg({ type: '', text: '' });

        if (passwordData.newPassword.length < 6) {
            setPasswordMsg({ type: 'error', text: 'Kata sandi baru minimal 6 karakter.' });
            setSavingPassword(false);
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordMsg({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
            setSavingPassword(false);
            return;
        }

        try {
            await api.put('profile/password', {
                email: user?.email,
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });
            setPasswordMsg({ type: 'success', text: 'Kata sandi berhasil diubah!' });
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setPasswordMsg({ type: 'error', text: err.response?.data?.error || 'Gagal mengubah kata sandi.' });
        }
        setSavingPassword(false);
        setTimeout(() => setPasswordMsg({ type: '', text: '' }), 4000);
    };

    const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : 'A');
    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' pukul ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="animate-fade-in space-y-6">
            {/* Profile Card + Form Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT: Profile Card */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4">
                        {/* Avatar */}
                        <div className="relative inline-block">
                            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-5xl font-black shadow-xl shadow-indigo-200 mx-auto">
                                {getInitial(profileData.name)}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">{profileData.name || 'User'}</h3>
                            <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-green-100 text-green-700 border border-green-200">
                                <Shield className="w-3 h-3" /> {user?.role || 'User'}
                            </span>
                        </div>

                        <div className="border-t border-slate-100 pt-4 space-y-3 text-left">
                            {profileData.instansi && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">Instansi</p>
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        {profileData.instansi}
                                    </div>
                                </div>
                            )}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">Email</p>
                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    {profileData.email}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">Terakhir Diperbarui</p>
                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    {formattedDate}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Tabs + Forms */}
                <div className="lg:col-span-2">
                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === 'info'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                            }`}
                        >
                            <User className="w-4 h-4" /> Informasi Pengguna
                        </button>
                        <button
                            onClick={() => setActiveTab('password')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === 'password'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                            }`}
                        >
                            <Lock className="w-4 h-4" /> Ubah Kata Sandi
                        </button>
                    </div>

                    {/* INFO TAB */}
                    {activeTab === 'info' && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 animate-fade-in">
                            <div>
                                <h4 className="text-lg font-black text-slate-900">Informasi Pengguna</h4>
                                <p className="text-sm text-slate-400">Kelola data pribadi dan informasi kontak kedinasan Anda.</p>
                            </div>

                            {profileMsg.text && (
                                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-bold ${profileMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                    {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    {profileMsg.text}
                                </div>
                            )}

                            <form onSubmit={handleSaveProfile} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Nama Lengkap</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        <input
                                            type="text"
                                            value={profileData.name}
                                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all outline-none"
                                            placeholder="Nama Anda"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Email Dinas</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                            <input
                                                type="email"
                                                value={profileData.email}
                                                disabled
                                                className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-400 bg-slate-50 cursor-not-allowed outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Instansi / Unit Kerja</label>
                                        <div className="relative">
                                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                            <input
                                                type="text"
                                                value={profileData.instansi}
                                                onChange={(e) => setProfileData({ ...profileData, instansi: e.target.value })}
                                                className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all outline-none"
                                                placeholder="Diskominfo Persandian & Statistik"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" /> {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* PASSWORD TAB */}
                    {activeTab === 'password' && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 animate-fade-in">
                            <div>
                                <h4 className="text-lg font-black text-slate-900">Ubah Kata Sandi</h4>
                                <p className="text-sm text-slate-400">Pastikan menggunakan kata sandi yang kuat dan mudah diingat.</p>
                            </div>

                            {passwordMsg.text && (
                                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-bold ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                    {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    {passwordMsg.text}
                                </div>
                            )}

                            <form onSubmit={handleChangePassword} className="space-y-4">
                                {/* Current Password */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Kata Sandi Saat Ini</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        <input
                                            type={showPasswords.current ? 'text' : 'password'}
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            className="w-full pl-12 pr-12 py-3.5 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all outline-none"
                                            placeholder="Masukkan kata sandi lama"
                                            required
                                        />
                                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Kata Sandi Baru</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        <input
                                            type={showPasswords.new ? 'text' : 'password'}
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="w-full pl-12 pr-12 py-3.5 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all outline-none"
                                            placeholder="Minimal 6 karakter"
                                            required
                                        />
                                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Konfirmasi Kata Sandi Baru</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        <input
                                            type={showPasswords.confirm ? 'text' : 'password'}
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className={`w-full pl-12 pr-12 py-3.5 border rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 transition-all outline-none ${
                                                passwordData.confirmPassword && passwordData.confirmPassword !== passwordData.newPassword
                                                    ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-200'
                                                    : 'border-slate-200 focus:border-indigo-400'
                                            }`}
                                            placeholder="Ulangi kata sandi baru"
                                            required
                                        />
                                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {passwordData.confirmPassword && passwordData.confirmPassword !== passwordData.newPassword && (
                                        <p className="text-xs text-rose-500 mt-1 font-semibold">Kata sandi tidak cocok</p>
                                    )}
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Lock className="w-4 h-4" /> {savingPassword ? 'Menyimpan...' : 'Ubah Kata Sandi'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
