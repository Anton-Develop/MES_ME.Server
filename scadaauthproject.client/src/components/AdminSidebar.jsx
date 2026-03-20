// src/components/AdminSidebar.jsx
import React from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Box, useTheme, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

const drawerWidth = 240;

const AdminSidebar = ({ open, toggleDrawer, menuItems }) => { // Принимаем menuItems
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleItemClick = (link) => {
    navigate(link);
    if (isMobile) { // Закрываем sidebar на мобильных после клика
      toggleDrawer(false)();
    }
  };

  const drawerContent = (
    <div>
      <Divider />
      <List>
        {menuItems && menuItems.length > 0 ? (
          menuItems.map((item, index) => (
            <ListItem key={item.text || index} disablePadding> {/* Используем item.text или index как ключ */}
              <ListItemButton onClick={() => handleItemClick(item.link)}>
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))
        ) : (
          <ListItem>
            <ListItemText primary="Нет доступных разделов" />
          </ListItem>
        )}
      </List>
      <Divider />
      <List>
        {/* Элемент "Выйти" остаётся, но может быть оформлен как отдельный компонент или с иконкой */}
        <ListItem disablePadding>
          <ListItemButton onClick={() => {}}> {/* Логика выхода будет в Navbar или MainLayout */}
            <ListItemIcon>
              <ExitToAppIcon />
            </ListItemIcon>
            <ListItemText primary="Выйти" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <>
      {/* Temporary drawer for mobile */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={open}
        onClose={toggleDrawer(false)}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawerContent}
      </Drawer>
      {/* Permanent drawer for desktop */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default AdminSidebar;