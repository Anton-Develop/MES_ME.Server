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
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

const AdminSidebar = ({ open, toggleDrawer }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [openSubMenus, setOpenSubMenus] = useState({});

  const isAdminOrDeveloper = user && ['superadmin', 'developer'].includes(user.role);

  if (!isAdminOrDeveloper) {
    return null;
  }

  const isActive = (path) => location.pathname === path;

  const handleSubMenuToggle = (menuKey) => {
    setOpenSubMenus(prev => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const menuItems = [
    {
      text: 'Импорт данных',
      icon: <UploadFileIcon />,
      link: '/import',
      roles: ['superadmin', 'developer'],
      show: true,
    },
	{
      text: 'Воходные данные',
      icon: <UploadFileIcon />,
      link: '/input-data-view',
      roles: ['superadmin', 'developer'],
      show: true,
    },
    {
      text: 'Управление пользователями',
      icon: <PeopleIcon />,
      link: '/users',
      roles: ['superadmin', 'developer'],
      show: true,
    },
    {
      text: 'Настройки',
      icon: <SettingsIcon />,
      subItems: [
        { text: 'Управление ролями', link: '/roles', roles: ['superadmin', 'developer'] },
        { text: 'Права ролей', link: '/role-permissions', roles: ['superadmin', 'developer'] },
      ],
      roles: ['superadmin', 'developer'],
      show: true,
    },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role) && item.show);

  const renderItems = (items, depth = 0) => {
    return items.map((item, index) => {
      if (item.subItems) {
        const hasVisibleSubItem = item.subItems.some(sub => sub.roles.includes(user.role));
        if (!hasVisibleSubItem) return null;

        const menuKey = `subMenu_${index}`;
        const isOpen = openSubMenus[menuKey];

        return (
          <React.Fragment key={index}>
            <ListItem disablePadding sx={{ pl: depth * 2 }}>
              <ListItemButton onClick={() => handleSubMenuToggle(menuKey)} sx={{ pl: 2 }}>
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
        if (!item.roles.includes(user.role)) return null;

        return (
          <ListItem key={index} disablePadding sx={{ pl: depth * 2 }}>
            <ListItemButton
              component={Link}
              to={item.link}
              selected={isActive(item.link)}
              onClick={toggleDrawer(false)} // теперь это корректно: возвращает обработчик
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
          zIndex: 1100,
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
          <ChevronRightIcon />
        </IconButton>
      </Box>
      <Divider />
      <List>
        {renderItems(filteredItems)}
      </List>
    </Drawer>
  );
};

export default AdminSidebar;