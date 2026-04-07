import axios from 'axios';

// Gunakan env variable untuk production, fallback ke localhost untuk development
const API_URL = import.meta.env.VITE_API_URL || '/api';
export const BASE_URL = API_URL.replace(/\/api$/, '');

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Menambahkan token JWT otomatis ke setiap request (jika ada)
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor untuk menangani token expired (Opsional untuk UX)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Jangan redirect jika ini adalah request login itu sendiri
            const url = error.config?.url || '';
            const isLoginRequest = url.includes('verify-access') || url.includes('auth/login');
            if (!isLoginRequest) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
