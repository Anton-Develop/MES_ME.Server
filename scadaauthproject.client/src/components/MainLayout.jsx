// src/components/MainLayout.jsx
import React, { useState } from 'react';
import { Box, CssBaseline, CircularProgress, useTheme, useMediaQuery } from '@mui/material';
import Navbar from './Navbar';
import AdminSidebar, { DRAWER_WIDTH } from './AdminSidebar';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRoutePermissions } from './RoutePermissionsContext';

import SuperAdminDashboard from './Dashboards/SuperAdminDashboard';
import MasterDashboard from './Dashboards/MasterDashboard';
import OperatorDashboard from './Dashboards/OperatorDashboard';
import DeveloperDashboard from './Dashboards/DeveloperDashboard';
import DefaultDashboard from './Dashboards/DefaultDashboard';

const DASHBOARD_BY_ROLE = {
  superadmin: SuperAdminDashboard,
  master: MasterDashboard,
  operator: OperatorDashboard,
  developer: DeveloperDashboard,
};

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const { menuItems, loading: routesLoading } = useRoutePermissions();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const toggleDrawer = (open) => (event) => {
    if (event?.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) return;
    setSidebarOpen(open);
  };

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);

  if (authLoading || routesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <div>Ошибка аутентификации. Пожалуйста, войдите снова.</div>;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isDashboard = location.pathname === '/';
  const DashboardComponent = DASHBOARD_BY_ROLE[user.role] ?? DefaultDashboard;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'grey.50' }}>
      <CssBaseline />

      <Navbar toggleSidebar={handleToggleSidebar} onLogout={handleLogout} />

      <AdminSidebar
        open={sidebarOpen}
        toggleDrawer={toggleDrawer}
        menuItems={menuItems}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: '64px', // высота AppBar
          minHeight: '100vh',
          // На десктопе сдвигаем контент при открытом сайдбаре
          ml: {
            xs: 0,
            sm: sidebarOpen ? `${DRAWER_WIDTH}px` : 0,
          },
          transition: theme.transitions.create('margin-left', {
            easing: sidebarOpen
              ? theme.transitions.easing.easeOut
              : theme.transitions.easing.sharp,
            duration: sidebarOpen
              ? theme.transitions.duration.enteringScreen
              : theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {isDashboard ? <DashboardComponent /> : <Outlet />}
      </Box>
    </Box>
  );
};

export default MainLayout;
