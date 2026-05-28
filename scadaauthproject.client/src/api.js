import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// ✅ Читаем из обоих хранилищ
const getToken = () =>
  localStorage.getItem('token') || sessionStorage.getItem('token');

const clearToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

api.interceptors.request.use(
  (config) => {
    const token = getToken(); // ← было только localStorage
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      // ✅ НЕ делаем window.location.href — это убивало sessionStorage
      // и вызывало полную перезагрузку страницы.
      // AuthContext увидит что токена нет, ProtectedRoute сам 
      // перенаправит на /login через React Router.
    }
    return Promise.reject(error);
  }
);

export default api;