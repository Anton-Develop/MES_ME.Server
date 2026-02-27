import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserFromToken = () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
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
      setUser({ username: userName, role, userId, permissions });
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = { user, login, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};