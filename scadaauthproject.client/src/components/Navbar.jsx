// src/components/Navbar.jsx
import React from 'react';
import { AppBar, Toolbar, Typography, Box, Button, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Нужен для получения user
import MenuIcon from '@mui/icons-material/Menu'; // Импортируем иконку меню
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

// Принимаем toggleSidebar и onLogout как пропсы
const Navbar = ({ toggleSidebar, onLogout }) => {
  const { user } = useAuth(); // Получаем user из контекста
  const navigate = useNavigate(); // useNavigate нужен для других действий, если потребуется

  // Проверяем, какие действия доступны пользователю (например, профиль)
  // const canAccessProfile = user; // Пока просто если залогинен

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        {/* Кнопка для открытия Sidebar */}
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={toggleSidebar} // Вызываем переданную функцию
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
            <IconButton
              color="inherit"
              aria-label="profile"
              // onClick={() => navigate('/profile')} // Если будет страница профиля
              edge="end"
              size="large"
            >
              <AccountCircleIcon />
            </IconButton>
            <Typography variant="body2" sx={{ mr: 2 }}>
              {user.username} ({user.role})
            </Typography>
            {/* Используем переданную функцию выхода */}
            <Button color="inherit" onClick={onLogout}>
              Выйти
            </Button>
          </Box>
        ) : (
          // Этот случай вряд ли произойдёт на MainLayout, так как он защищён ProtectedRoute
          // Но если вдруг, показываем кнопку входа
          <Button color="inherit" onClick={() => navigate('/login')}>
            Войти
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;