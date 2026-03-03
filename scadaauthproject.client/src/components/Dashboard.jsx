// src/pages/Dashboard.jsx (Опционально, если нужна обертка)
import React, { useState } from 'react';
import { Box, CssBaseline } from '@mui/material';
import Navbar from '../components/Navbar';
import AdminSidebar from '../components/AdminSidebar';
import { Outlet } from 'react-router-dom'; // Используем Outlet для рендеринга дочерних маршрутов

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setSidebarOpen(open);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Navbar />
      <AdminSidebar open={sidebarOpen} toggleDrawer={toggleDrawer} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          marginTop: '64px', // Компенсируем высоту AppBar
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
        {/* Outlet рендерит соответствующий дашборд или другую страницу */}
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;