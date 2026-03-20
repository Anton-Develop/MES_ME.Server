// src/components/MainLayout.jsx
import React, { useState } from 'react';
import { Box, CssBaseline, CircularProgress, useTheme, useMediaQuery } from '@mui/material';
import Navbar from './Navbar';
import AdminSidebar from './AdminSidebar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Убедитесь, что путь к AuthContext правильный

// Импортируем все дашборды
import SuperAdminDashboard from './Dashboards/SuperAdminDashboard';
import MasterDashboard from './Dashboards/MasterDashboard';
import OperatorDashboard from './Dashboards/OperatorDashboard';
import DeveloperDashboard from './Dashboards/DeveloperDashboard';
import DefaultDashboard from './Dashboards/DefaultDashboard'; // Импортируем новый общий дашборд

// Импорты иконок для меню
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import BuildIcon from '@mui/icons-material/Build';

const drawerWidth = 240;

// Карта дашбордов к правам, которые их разрешают
const dashboardConfig = {
  superadmin: { component: SuperAdminDashboard, permission: 'view_superadmin_dashboard' },
  master: { component: MasterDashboard, permission: 'view_master_dashboard' },
  operator: { component: OperatorDashboard, permission: 'view_operator_dashboard' },
  developer: { component: DeveloperDashboard, permission: 'view_developer_dashboard' },
  // default: { component: DefaultDashboard, permission: 'view_default_dashboard' }, // Можно добавить отдельное право для дефолтного
};

// Конфигурация элементов меню с привязкой к правам
// Используем имена прав, соответствующие тем, что в базе данных
const menuItemsConfig = [
  { text: 'Dashboard', link: '/', icon: <DashboardIcon />, permission: 'view_dashboard' }, // Главная
  { text: 'Журнал Учета Листов', link: '/sheet-accounting', icon: <AssignmentIcon />, permission: 'view_sheet_accounting' },
  { text: 'План проката', link: '/rolling-plan-operator', icon: <AssignmentIcon />, permission: 'view_rolling_plan_operator' },
  { text: 'План прокатки', link: '/rolling-plan-master', icon: <AssignmentIcon />, permission: 'view_rolling_plan_master' },
  { text: 'Управление кассетами', link: '/cassette-management', icon: <AssignmentIcon />, permission: 'manage_cassettes' },
  { text: 'Просмотр пользователей', link: '/users', icon: <PeopleIcon />, permission: 'view_users' }, // Изменил текст
  { text: 'Управление ролями', link: '/roles', icon: <BuildIcon />, permission: 'manage_roles' },
  { text: 'Управление правами ролей', link: '/permissions', icon: <SettingsIcon />, permission: 'manage_role_permissions' }, // Убедитесь, что это право есть в БД
  // ... другие элементы меню с соответствующими правами из БД
];

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth(); // Получаем logout из контекста
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const toggleDrawer = (open) => (event) => {
    if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setSidebarOpen(open);
  };

  // --- Вспомогательная функция проверки прав ---
  const hasPermission = (perm) => {
    if (!user?.permissions || !Array.isArray(user.permissions)) {
      console.warn('Permissions list is missing or not an array.');
      return false;
    }
    return user.permissions.includes(perm);
  };

  // --- Обработка состояния загрузки ---
  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // --- Обработка отсутствия пользователя ---
  if (!user) {
    console.error('MainLayout: User data is missing after authentication check.');
    // Лучший способ - использовать ProtectedRoute на уровне App.jsx, но если нужно здесь:
    // navigate('/login', { replace: true });
    // window.location.href = '/login'; // Надёжный способ, если navigate не работает
    // return null;
    // Пока просто покажем сообщение, если пользователь не аутентифицирован
    return <div>Ошибка аутентификации. Пожалуйста, войдите снова.</div>;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // --- Определение содержимого для отображения ---
  const isDashboardPath = location.pathname === '/';

  let contentToRender = children; // По умолчанию отображаем дочерние компоненты

  if (isDashboardPath) {
    // Логика отображения дашборда
    let dashboardComponent = DefaultDashboard; // Fallback: общий дашборд
    const userRole = user.role;

    // Проверяем, есть ли у пользователя право на дашборд своей роли
    const roleDashboardInfo = dashboardConfig[userRole];
    if (roleDashboardInfo && hasPermission(roleDashboardInfo.permission)) {
      dashboardComponent = roleDashboardInfo.component;
    } else {
       // Если нет права на дашборд своей роли, проверяем универсальное право view_dashboard
       if (hasPermission('view_dashboard')) {
           // Используем общий дашборд, если есть право view_dashboard
           dashboardComponent = DefaultDashboard;
       } else {
           // Или просто не отображаем дашборд, если нет права view_dashboard
           dashboardComponent = () => <div>Доступ к главной странице ограничен.</div>;
       }
    }
    contentToRender = React.createElement(dashboardComponent); // Рендерим выбранный компонент дашборда
  }
  // Если не главная страница, contentToRender остаётся как children

  // --- Формирование элементов меню на основе прав ---
  const filteredMenuItems = menuItemsConfig.filter(item => hasPermission(item.permission));

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Navbar toggleSidebar={toggleDrawer(true)} onLogout={handleLogout} />
       <AdminSidebar open={sidebarOpen} toggleDrawer={toggleDrawer} menuItems={filteredMenuItems} /> {/* Передаём фильтрованные элементы */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          marginTop: '64px', // Высота navbar
          marginLeft: sidebarOpen && !isMobile ? `${drawerWidth}px` : '0px', // Сдвигаем контент при открытии sidebar на desktop
          transition: (theme) =>
            theme.transitions.create(['margin-left'], { // Используем только margin-left
              easing: theme.transitions.easing.easeOut,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }}
      >
        {contentToRender}
      </Box>
    </Box>
  );
};

export default MainLayout;