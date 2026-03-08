// src/components/Navbar.jsx
import React from 'react';
import { AppBar, Toolbar, Typography, Box, Button, IconButton } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

// ИСПРАВЛЕНО: удалён неиспользуемый импорт useNavigate
const Navbar = ({ toggleSidebar, onLogout }) => {
  const { user } = useAuth();

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="открыть меню"
          onClick={toggleSidebar}
          edge="start"
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          МеталлЭнерго
        </Typography>

        {user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="inherit" aria-label="профиль" size="large">
              <AccountCircleIcon />
            </IconButton>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {user.username} ({user.role})
            </Typography>
            <Button color="inherit" onClick={onLogout}>
              Выйти
            </Button>
          </Box>
        ) : (
          // ИСПРАВЛЕНО: удалён useNavigate — Navbar не должен управлять навигацией напрямую;
          // если пользователь не авторизован, ProtectedRoute уже перенаправит на /login
          null
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
