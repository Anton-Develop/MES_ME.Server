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
  ChevronRight as ChevronRightIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  UploadFile as UploadFileIcon,
  ExpandLess,
  ExpandMore,
  CalendarToday as CalendarTodayIcon,
  Inventory as InventoryIcon,
  TableChart as TableChartIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

// Определяем структуру меню здесь
const menuItems = [
  {
    text: 'План закалки 2',
    icon: <CalendarTodayIcon />,
    link: '/annealing-batch-plan',
    roles: ['master', 'operator', 'developer', 'superadmin'],
  },
  {
    text: 'План закалки',
    icon: <CalendarTodayIcon />,
    link: '/annealing-schedule',
    roles: ['master', 'operator', 'developer', 'superadmin'],
  },
  {
    text: 'Управление кассетами',
    icon: <InventoryIcon />,
    link: '/cassette-management',
    roles: ['master', 'operator', 'developer', 'superadmin'],
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
    roles: ['superadmin', 'operator'],
  },
  {
    text: 'Настройки',
    icon: <SettingsIcon />,
    subItems: [
      {
        text: 'Пользователи',
        icon: <PeopleIcon />,
        link: '/users',
        roles: ['superadmin', 'developer'],
      },
      {
        text: 'Роли',
        icon: <PeopleIcon />, // Можно выбрать другую иконку
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
    roles: ['superadmin', 'developer'], // Родительский пункт доступен только админам/разрабам
  },
  // Добавьте другие разделы по необходимости
];

const AdminSidebar = ({ open, toggleDrawer }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (link) => location.pathname === link;

  const renderItems = (items, depth = 0) => {
    return items.map((item, index) => {
      if (item.subItems) {
        const isOpen = item.subItems.some(subItem => location.pathname.startsWith(subItem.link));
        return (
          <React.Fragment key={index}>
            <ListItem disablePadding sx={{ pl: depth * 2 }}>
              <ListItemButton
                onClick={() => {}}
                sx={{ pl: 2 + depth * 2 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
                {isOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderItems(item.subItems, depth + 1)}
              </List>
            </Collapse>
          </React.Fragment>
        );
      } else {
        // Проверяем, имеет ли текущий пользователь право видеть этот пункт
        if (!item.roles.includes(user?.role || '')) return null; // Если роль не установлена, не показываем
        return (
          <ListItem key={index} disablePadding sx={{ pl: depth * 2 }}>
            <ListItemButton
              component={Link}
              to={item.link}
              selected={isActive(item.link)}
              onClick={toggleDrawer(false)} // Закрывает меню при клике
              sx={{ pl: 2 + depth * 2 }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        );
      }
    });
  };

  return (
    <Drawer
      variant="persistent" // persistent, чтобы можно было открывать/закрывать
      anchor="left"
      open={open} // Теперь зависит от состояния в App или Layout
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          top: '64px', // Высота AppBar
          height: 'calc(100% - 64px)',
          zIndex: 1200, // Выше AppBar
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 8px',
        }}
      >
        <IconButton onClick={toggleDrawer(false)}>
          <ChevronLeftIcon />
        </IconButton>
      </Box>
      <Divider />
      <List>
        {renderItems(menuItems)}
      </List>
    </Drawer>
  );
};

export default AdminSidebar;