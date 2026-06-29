// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

// ✅ ПРАВИЛЬНАЯ функция декодирования base64 с поддержкой UTF-8 (кириллицы)
const base64UrlDecode = (str) => {
  // Заменяем base64url на base64
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Добавляем padding, если нужно
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Invalid base64url string');
  }

  try {
    // Декодируем base64 в binary string
    const binaryString = atob(output);
    
    // ✅ Конвертируем binary string в UTF-8 строку
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Декодируем UTF-8 байты в строку
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    console.error('Base64 decode error:', err);
    throw err;
  }
};

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
      
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Malformed JWT');

        // ✅ Используем правильную функцию декодирования
        const payload = JSON.parse(base64UrlDecode(parts[1]));

        // Проверка истечения срока
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
      } catch (err) {
        console.error('Token parsing error:', err);
        clearTokenFromStorage();
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

  const isAdmin = () => {
    return user && (user.role === 'superadmin' || user.role === 'developer');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};