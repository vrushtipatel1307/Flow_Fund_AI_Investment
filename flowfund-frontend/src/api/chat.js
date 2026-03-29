import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL;
const API_BASE = `${apiUrl || ''}/api/chat`;

const chatApi = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

chatApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

chatApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const sendMessage = (message) => chatApi.post('/message', { message });

export default chatApi;
