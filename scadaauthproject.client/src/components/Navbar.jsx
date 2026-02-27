// src/components/Navbar.jsx (обновлённый пример)
import React from 'react';
import { AppBar, Toolbar, Typography, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Определяем, какие ссылки показывать всем, а какие только определённым ролям
  const isAdminOrDev = user && ['superadmin', 'developer'].includes(user.role);
  const canImport = user && ['superadmin', 'operator'].includes(user.role);

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}> {/* Увеличиваем z-index AppBar */}
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          МеталлЭнерго
        </Typography>
        {user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ mr: 2 }}>
              {user.username} ({user.role})
            </Typography>

            {/* Основные ссылки */}
            <Button color="inherit" onClick={() => navigate('/')}>
              Главная
            </Button>

            {/* Ссылка на импорт, если разрешена */}
            {canImport && (
              <Button color="inherit" onClick={() => navigate('/import')}>
                Импорт Excel
              </Button>
            )}

            {/* Кнопка открытия бокового меню для админов/разработчиков */}
            {isAdminOrDev && (
              <Button color="inherit" onClick={() => navigate('/')}>
                Админ-панель
              </Button>
              // ВАЖНО: На практике, переход по '/' откроет Dashboard, где уже есть кнопка меню.
              // Поэтому, возможно, эту кнопку стоит убрать или оставить просто иконку меню внутри Dashboard, как сделано выше.
              // Цель - показать, что доступна специальная панель.
              // Лучше оставить кнопку в Dashboard и убрать отсюда.
            )}

            <Button color="inherit" onClick={handleLogout}>
              Выйти
            </Button>
          </Box>
        ) : (
          <Button color="inherit" onClick={() => navigate('/login')}>
            Войти
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;