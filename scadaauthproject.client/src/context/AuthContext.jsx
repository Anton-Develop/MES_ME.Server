// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

// Вспомогательная функция для получения токена (сначала localStorage, потом sessionStorage)
const getTokenFromStorage = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

const clearTokenFromStorage = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserFromToken = () => {
      const token = getTokenFromStorage();
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length !== 3) throw new Error('Malformed JWT');

          const payload = JSON.parse(atob(parts[1]));

          // Проверка истечения срока (60 минут из appsettings.json)
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn('Token expired, clearing.');
            clearTokenFromStorage();
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
          clearTokenFromStorage();
        }
      }
      setLoading(false);
    };

    loadUserFromToken();
  }, []);

  const login = async (username, password, rememberMe = false) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, username: userName, role, userId, permissions } = response.data;

      if (!token) return false;

      // Если "Запомнить меня" — localStorage (переживает перезапуск браузера)
      // Если нет — sessionStorage (очищается при закрытии вкладки/браузера)
      if (rememberMe) {
        localStorage.setItem('token', token);
      } else {
        sessionStorage.setItem('token', token);
      }
      
      setUser({ username: userName, role, userId, permissions: permissions ?? [] });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    clearTokenFromStorage();
    setUser(null);
  };

  // Проверка, является ли пользователь администратором (superadmin или developer)
  const isAdmin = () => {
    return user && (user.role === 'superadmin' || user.role === 'developer');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};