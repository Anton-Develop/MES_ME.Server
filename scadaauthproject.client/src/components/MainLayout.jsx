// src/components/MainLayout.jsx
import React, { useState } from 'react';
import { Box, CssBaseline, CircularProgress } from '@mui/material';
import Navbar from './Navbar';
import AdminSidebar from './AdminSidebar';
import { useLocation, useNavigate } from 'react-router-dom'; // Добавляем useNavigate
import { useAuth } from '../context/AuthContext';

// Компоненты дашбордов (предполагается, что они находятся в src/components/Dashboards/)
import SuperAdminDashboard from './Dashboards/SuperAdminDashboard';
import MasterDashboard from './Dashboards/MasterDashboard';
import OperatorDashboard from './Dashboards/OperatorDashboard';
import DeveloperDashboard from './Dashboards/DeveloperDashboard';

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate(); // Добавляем navigate
  const { user, loading: authLoading, logout } = useAuth(); // Получаем logout из AuthContext

  const toggleDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setSidebarOpen(open);
  };

  const isDashboardPath = location.pathname === '/';

  // Пока идет загрузка пользователя, показываем индикатор
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Если пользователь не залогинен (но ProtectedRoute должен был его перехватить),
  // или данные пользователя не полны.
  if (!user) {
     console.error("MainLayout: User data is missing after authentication check.");
     return <div>Ошибка аутентификации. Перезагрузите страницу или повторите вход.</div>;
  }

  // Функция для выхода, передаём её в Navbar
  const handleLogout = () => {
    logout(); // Вызываем logout из AuthContext
    navigate('/login'); // Перенаправляем на страницу входа
  };

  let contentToRender = children;
  if (isDashboardPath) {
    // Рендерим дашборд в зависимости от роли
    switch (user.role) {
      case 'superadmin':
        contentToRender = <SuperAdminDashboard />;
        break;
      case 'master':
        contentToRender = <MasterDashboard />;
        break;
      case 'operator':
        contentToRender = <OperatorDashboard />;
        break;
      case 'developer':
        contentToRender = <DeveloperDashboard />;
        break;
      default:
        contentToRender = <div>Роль "{user.role}" не распознана. Обратитесь к администратору.</div>;
    }
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      {/* Передаём функции в Navbar */}
      <Navbar
        toggleSidebar={toggleDrawer(true)}
        onLogout={handleLogout}
      />
      <AdminSidebar open={sidebarOpen} toggleDrawer={toggleDrawer} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          marginTop: '64px', // Компенсируем высоту AppBar (Navbar)
          marginLeft: sidebarOpen ? '240px' : '0px', // Компенсируем ширину Sidebar
          transition: (theme) =>
            theme.transitions.create(['margin-left'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          ...(sidebarOpen && {
            marginLeft: '240px',
            transition: (theme) =>
              theme.transitions.create(['margin-left'], {
                easing: theme.transitions.easing.easeOut,
                duration: theme.transitions.duration.enteringScreen,
              }),
          }),
        }}
      >
        {contentToRender}
      </Box>
    </Box>
  );
};

export default MainLayout;