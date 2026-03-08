// src/components/MainLayout.jsx
import React, { useState } from 'react';
import { Box, CssBaseline, CircularProgress } from '@mui/material';
import Navbar from './Navbar';
import AdminSidebar from './AdminSidebar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Убедитесь, что путь к AuthContext правильный

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
    const { user, loading: authLoading, logout } = useAuth(); // Получаем logout из контекста

    const toggleDrawer = (open) => (event) => {
        if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        setSidebarOpen(open);
    };

    // --- ИСПРАВЛЕНО: Обработка состояния загрузки ---
    if (authLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    // --- ИСПРАВЛЕНО: Обработка отсутствия пользователя ---
    if (!user) {
        console.error('MainLayout: User data is missing after authentication check.');
        // console.log("Redirecting to /login due to missing user data.");
        // navigate('/login', { replace: true }); // Попытка программного перенаправления
        // window.location.href = '/login'; // Альтернативный способ перенаправления
        // return null; // Не рендерим ничего, если данные отсутствуют

        // --- ЛУЧШЕЙ АЛЬТЕРНАТИВОЙ ЯВЛЯЕТСЯ ПЕРЕНАПРАВЛЕНИЕ ЧЕРЕЗ ProtectedRoute ---
        // Но если вы хотите обработать это здесь, используйте один из способов:
        // ВАРИАНТ 1: Показать сообщение и не рендерить ничего (как сейчас)
       // return <div>Ошибка аутентификации. Перезагрузите страницу или повторите вход.</div>;

        // ВАРИАНТ 2: Автоматическое перенаправление (раскомментируйте нужный)
         navigate('/login', { replace: true }); // Требует, чтобы MainLayout был под Router
         window.location.href = '/login'; // Надежный способ, но перезагружает приложение
         return null; // После перенаправления не рендерим
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