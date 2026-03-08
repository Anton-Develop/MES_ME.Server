// src/components/MainLayout.jsx
import React, { useState } from 'react';
import { Box, CssBaseline, CircularProgress } from '@mui/material';
import Navbar from './Navbar';
import AdminSidebar from './AdminSidebar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import SuperAdminDashboard from './Dashboards/SuperAdminDashboard';
import MasterDashboard from './Dashboards/MasterDashboard';
import OperatorDashboard from './Dashboards/OperatorDashboard';
import DeveloperDashboard from './Dashboards/DeveloperDashboard';

const drawerWidth = 240;

// Карта дашбордов по ролям — легко расширяется без изменения switch
const dashboardByRole = {
  superadmin: <SuperAdminDashboard />,
  master: <MasterDashboard />,
  operator: <OperatorDashboard />,
  developer: <DeveloperDashboard />,
};

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();

  const toggleDrawer = (open) => (event) => {
    if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setSidebarOpen(open);
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    console.error('MainLayout: User data is missing after authentication check.');
    return <div>Ошибка аутентификации. Перезагрузите страницу или повторите вход.</div>;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isDashboardPath = location.pathname === '/';

  // ИСПРАВЛЕНО: switch заменён на объект-карту, fallback для неизвестной роли
  const contentToRender = isDashboardPath
    ? dashboardByRole[user.role] ?? (
        <div>Роль «{user.role}» не распознана. Обратитесь к администратору.</div>
      )
    : children;

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Navbar toggleSidebar={toggleDrawer(true)} onLogout={handleLogout} />
      <AdminSidebar open={sidebarOpen} toggleDrawer={toggleDrawer} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          marginTop: '64px',
          // ИСПРАВЛЕНО: убрано дублирование marginLeft/transition через ...(sidebarOpen && {...})
          marginLeft: sidebarOpen ? `${drawerWidth}px` : '0px',
          transition: (theme) =>
            theme.transitions.create('margin-left', {
              easing: sidebarOpen
                ? theme.transitions.easing.easeOut
                : theme.transitions.easing.sharp,
              duration: sidebarOpen
                ? theme.transitions.duration.enteringScreen
                : theme.transitions.duration.leavingScreen,
            }),
        }}
      >
        {contentToRender}
      </Box>
    </Box>
  );
};

export default MainLayout;
