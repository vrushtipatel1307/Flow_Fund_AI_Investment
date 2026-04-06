import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL;
const api = axios.create({
  baseURL: `${apiUrl || ''}/api/market`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const marketSearch = (q) => api.get('/search', { params: { q } });
export const marketSeries = (symbol, params) => api.get(`/series/${encodeURIComponent(symbol)}`, { params });
export const marketCompare = (symbols, days) =>
  api.get('/compare', { params: { symbols: symbols.join(','), days } });

export default api;
