// src/components/AdminSidebar.jsx
import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Collapse,
  Box,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ExpandLess,
  ExpandMore,
  CalendarToday as CalendarTodayIcon,
  Inventory as InventoryIcon,
  TableChart as TableChartIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

const menuItems = [
  {
    text: 'План закалки',
    icon: <CalendarTodayIcon />,
    link: '/annealing-batch-plan',
    roles: ['master', 'operator', 'developer', 'superadmin'],
  },
  {
    // ИСПРАВЛЕНО: была дублирующая иконка CalendarTodayIcon — заменена на AssignmentIcon
    text: 'Отчет закалки',
    icon: <AssignmentIcon />,
    link: '/reports/annealing',
    roles: ['master', 'operator', 'developer', 'superadmin'],
  },
  {
    text: 'Управление кассетами',
    icon: <InventoryIcon />,
    link: '/cassette-management',
    roles: ['master', 'operator', 'developer', 'superadmin'],
  },
  {
    text: 'Изменение статуса входных данных',
    icon: <TableChartIcon />,
    link: '/sheet-status-updater',
    roles: ['master', 'developer', 'superadmin'],
  },
  {
    text: 'Входные данные',
    icon: <TableChartIcon />,
    link: '/input-data',
    roles: ['master', 'operator', 'developer', 'superadmin'],
  },
  {
    text: 'Импорт данных',
    icon: <UploadFileIcon />,
    link: '/import',
    roles: ['superadmin'],
  },
  {
    text: 'Настройки',
    icon: <SettingsIcon />,
    roles: ['superadmin', 'developer'],
    subItems: [
      {
        text: 'Пользователи',
        icon: <PeopleIcon />,
        link: '/users',
        roles: ['superadmin', 'developer'],
      },
      {
        text: 'Роли',
        icon: <PeopleIcon />,
        link: '/roles',
        roles: ['superadmin', 'developer'],
      },
      {
        text: 'Права ролей',
        icon: <AssignmentIcon />,
        link: '/permissions',
        roles: ['superadmin', 'developer'],
      },
    ],
  },
];

const AdminSidebar = ({ open, toggleDrawer }) => {
  const { user } = useAuth();
  const location = useLocation();

  // ИСПРАВЛЕНО: добавлено управляемое состояние для подменю вместо вычисляемого из pathname
  const [openSubMenus, setOpenSubMenus] = useState({});

  const isActive = (link) => location.pathname === link;

  const handleToggleSubMenu = (key) => {
    setOpenSubMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderItems = (items, depth = 0, parentKey = '') => {
    return items.map((item, index) => {
      const itemKey = `${parentKey}-${index}`;

      // Проверяем доступность для текущей роли (включая родительские пункты с subItems)
      if (item.roles && !item.roles.includes(user?.role || '')) return null;

      if (item.subItems) {
        // Начальное состояние — раскрыт, если текущий путь входит в подменю
        const defaultOpen = item.subItems.some(sub => location.pathname.startsWith(sub.link));
        const isSubOpen = openSubMenus[itemKey] !== undefined ? openSubMenus[itemKey] : defaultOpen;

        return (
          <React.Fragment key={itemKey}>
            <ListItem disablePadding>
              <ListItemButton
                // ИСПРАВЛЕНО: onClick теперь вызывает реальный обработчик, а не пустую стрелку
                onClick={() => handleToggleSubMenu(itemKey)}
                sx={{ pl: 2 + depth * 2 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
                {isSubOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>
            <Collapse in={isSubOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderItems(item.subItems, depth + 1, itemKey)}
              </List>
            </Collapse>
          </React.Fragment>
        );
      }

      return (
        <ListItem key={itemKey} disablePadding>
          <ListItemButton
            component={Link}
            to={item.link}
            selected={isActive(item.link)}
            onClick={toggleDrawer(false)}
            sx={{ pl: 2 + depth * 2 }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItemButton>
        </ListItem>
      );
    });
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          top: '64px',
          height: 'calc(100% - 64px)',
          // ИСПРАВЛЕНО: zIndex 1200 перекрывал AppBar (zIndex 1100 у drawer по умолчанию корректен)
          zIndex: 1099,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 8px' }}>
        <IconButton onClick={toggleDrawer(false)}>
          <ChevronLeftIcon />
        </IconButton>
      </Box>
      <Divider />
      <List>{renderItems(menuItems)}</List>
    </Drawer>
  );
};

export default AdminSidebar;
