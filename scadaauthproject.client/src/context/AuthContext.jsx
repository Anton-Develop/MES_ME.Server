// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

// ИСПРАВЛЕНО: добавлена проверка на наличие контекста — ранее useContext(AuthContext)
// молча возвращал undefined, если компонент использовался вне AuthProvider
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserFromToken = () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // ИСПРАВЛЕНО: проверка структуры токена (должно быть ровно 3 части)
          const parts = token.split('.');
          if (parts.length !== 3) throw new Error('Malformed JWT');

          const payload = JSON.parse(atob(parts[1]));

          // ИСПРАВЛЕНО: проверка истечения срока (exp — Unix timestamp в секундах)
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn('Token expired, clearing.');
            localStorage.removeItem('token');
            setLoading(false);
            return;
          }

          setUser({
            username: payload.unique_name,
            role: payload.role,
            userId: payload.UserId,
            permissions: payload.permission
              ? (Array.isArray(payload.permission) ? payload.permission : [payload.permission])
              : [],
          });
        } catch {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    loadUserFromToken();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, username: userName, role, userId, permissions } = response.data;

      if (!token) return false;

      localStorage.setItem('token', token);
      // ИСПРАВЛЕНО: permissions может прийти null с сервера — защищаем через ??
      setUser({ username: userName, role, userId, permissions: permissions ?? [] });
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
