import React, { useState } from 'react';
import { Box, Container, Typography, AppBar, Toolbar, IconButton, CssBaseline, CircularProgress } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from '../components/AdminSidebar';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setSidebarOpen(open);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const showSidebar = user && ['superadmin', 'developer'].includes(user.role);

  return (
  
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {showSidebar && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={toggleDrawer(!sidebarOpen)}
              sx={{ mr: 2, ...(sidebarOpen && { display: 'none' }) }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div">
            Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      {showSidebar && <AdminSidebar open={sidebarOpen} toggleDrawer={toggleDrawer} />}
		
		
		
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          marginLeft: showSidebar && sidebarOpen ? '240px' : 0,
          transition: (theme) =>
            theme.transitions.create('margin-left', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Toolbar />
        <Container maxWidth="lg">
          <Typography variant="h4" gutterBottom>
            Добро пожаловать, {user?.username} ({user?.role})!
          </Typography>
          <Typography variant="body1">
            Это главная панель управления. Здесь отображаются ключевые метрики и действия.
          </Typography>
        </Container>
      </Box>
    </Box>
	
  );
};

export default Dashboard;