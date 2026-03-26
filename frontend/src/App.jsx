import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Admin from './pages/Admin';
import MitraPage from './pages/MitraPage';
import StatsPage from './pages/StatsPage';
import RegulationPage from './pages/RegulationPage';

// Private Route Wrapper
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useContext(AuthContext);

  if (loading) return <div className="p-10 text-center text-slate-500 font-bold">Memuat sesi...</div>;

  if (!isAuthenticated) return <Navigate to="/login" />;

  if (roles && !roles.map(r => r.toUpperCase()).includes(user.role?.toUpperCase())) {
    return <div className="p-10 text-center text-rose-500 font-bold">Akses Ditolak. Anda bukan {roles.join(' atau ')}.</div>;
  }

  return children;
};

function App() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/mitra" element={<MitraPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/regulasi" element={<RegulationPage />} />

            {/* Admin Routes */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute roles={['Admin', 'Super Admin', 'Perusahaan', 'Pemerintah', 'Operator', 'Verifikator']}>
                  <Admin />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <footer className="bg-white border-t border-slate-100 py-12 text-center">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            © 2024 Dinas Komunikasi & Informatika. Seluruh Hak Cipta Dilindungi.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
