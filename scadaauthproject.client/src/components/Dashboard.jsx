// src/pages/Dashboard.jsx
import React, { useState } from 'react';
import { Box, CssBaseline } from '@mui/material';
import Navbar from '../components/Navbar';
import AdminSidebar from '../components/AdminSidebar';
import { Outlet } from 'react-router-dom';

// ПРИМЕЧАНИЕ: этот компонент дублирует логику MainLayout.jsx.
// Рекомендуется использовать только один из них (предпочтительно MainLayout).
// Оставлен для совместимости, если используется отдельным маршрутом.

const drawerWidth = 240;

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleDrawer = (open) => (event) => {
    if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setSidebarOpen(open);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Navbar toggleSidebar={toggleDrawer(true)} />
      <AdminSidebar open={sidebarOpen} toggleDrawer={toggleDrawer} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          marginTop: '64px',
          // ИСПРАВЛЕНО: переход теперь всегда корректно анимируется через единый sx-блок
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
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;
