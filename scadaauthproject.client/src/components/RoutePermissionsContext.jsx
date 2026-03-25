// src/context/RoutePermissionsContext.jsx
// Контекст подгружает разрешённые маршруты для текущей роли пользователя с сервера.
// Используется MainLayout (сайдбар) и ProtectedRoute (проверка доступа).

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';







import {
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Build as BuildIcon,
  CalendarToday as CalendarTodayIcon,
  Inventory as InventoryIcon,
  TableChart as TableChartIcon,
  UploadFile as UploadFileIcon,
  ManageSearch as ManageSearchIcon,
  Map as MapIcon,
} from '@mui/icons-material';
import api from '../api';
import { useAuth } from '../context/AuthContext';
const ICON_MAP = {
  Dashboard: <DashboardIcon />,
  Assignment: <AssignmentIcon />,
  People: <PeopleIcon />,
  Settings: <SettingsIcon />,
  Build: <BuildIcon />,
  CalendarToday: <CalendarTodayIcon />,
  Inventory: <InventoryIcon />,
  TableChart: <TableChartIcon />,
  UploadFile: <UploadFileIcon />,
  ManageSearch: <ManageSearchIcon />,
  Map: <MapIcon />,
};
const RoutePermissionsContext = createContext(null);
export const RoutePermissionsProvider = ({ children }) => {
  const { user } = useAuth();
  const [allowedRoutes, setAllowedRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRoutes = useCallback(async () => {
    if (!user?.role) {
      setAllowedRoutes([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/routepermissions/for-role/${user.role}`);
      console.log('Загруженные маршруты:', res.data);
      setAllowedRoutes(res.data);
    } catch (err) {
      console.error('Ошибка загрузки маршрутов:', err);
      setError('Не удалось загрузить доступные разделы.');
      setAllowedRoutes([]);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  // Перезагружаем маршруты при смене роли/логине
  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // Проверка доступа к конкретному пути
  const hasRoute = useCallback(
    (path) => allowedRoutes.some((r) => r.path === path),
    [allowedRoutes]
  );

  // Элементы сайдбара с иконками
  const menuItems = allowedRoutes.map((route) => ({
    text: route.label,
    link: route.path,
    icon: ICON_MAP[route.iconName ?? route.IconName] ?? <DashboardIcon />,
  }));

  return (
    <RoutePermissionsContext.Provider
      value={{ allowedRoutes, menuItems, hasRoute, loading, error, refetch: fetchRoutes }}
    >
      {children}
    </RoutePermissionsContext.Provider>
  );
};

export const useRoutePermissions = () => {
  const ctx = useContext(RoutePermissionsContext);
  if (!ctx) throw new Error('useRoutePermissions must be used within RoutePermissionsProvider');
  return ctx;
};