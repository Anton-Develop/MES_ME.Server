// src/components/AdminSidebar.jsx
import React from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider, Toolbar, Box, Typography, useTheme, useMediaQuery,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

export const DRAWER_WIDTH = 260;

const AdminSidebar = ({ open, toggleDrawer, menuItems }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleItemClick = (link) => {
    navigate(link);
    if (isMobile) toggleDrawer(false)();
  };

  const isActive = (link) => location.pathname === link;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Spacer под AppBar */}
      <Toolbar />

      <Box
        sx={{
          px: 2,
          py: 1.5,
          background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)',
          color: '#fff',
        }}
      >
        <Typography variant="caption" sx={{ opacity: 0.8, letterSpacing: 1.5, fontWeight: 600, fontSize: '0.65rem' }}>
          НАВИГАЦИЯ
        </Typography>
      </Box>

      <List sx={{ flexGrow: 1, py: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {menuItems && menuItems.length > 0 ? (
          menuItems.map((item, index) => {
            const active = isActive(item.link);
            return (
              <ListItem key={item.text || index} disablePadding sx={{ mb: 0.25 }}>
                <ListItemButton
                  onClick={() => handleItemClick(item.link)}
                  sx={{
                    mx: 1,
                    borderRadius: 1.5,
                    position: 'relative',
                    transition: 'all 0.18s ease',
                    bgcolor: active ? 'primary.main' : 'transparent',
                    color: active ? '#fff' : 'text.primary',
                    '&::before': active
                      ? {
                          content: '""',
                          position: 'absolute',
                          left: -8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 4,
                          height: '60%',
                          borderRadius: '0 3px 3px 0',
                          bgcolor: 'primary.dark',
                        }
                      : {},
                    '&:hover': {
                      bgcolor: active ? 'primary.dark' : 'action.hover',
                      transform: 'translateX(2px)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: active ? '#fff' : 'text.secondary',
                      minWidth: 38,
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '0.85rem',
                      fontWeight: active ? 600 : 400,
                      noWrap: true,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })
        ) : (
          <Box sx={{ px: 3, py: 2 }}>
            <Typography variant="body2" color="text.disabled" fontSize="0.8rem">
              Нет доступных разделов
            </Typography>
          </Box>
        )}
      </List>

      <Divider />
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.disabled" fontSize="0.7rem">
          МеталлЭнерго v1.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Мобильный: temporary */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={open}
        onClose={toggleDrawer(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Десктоп: persistent — скрывается/открывается по кнопке */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            borderRight: '1px solid',
            borderColor: 'divider',
            boxShadow: '2px 0 12px rgba(0,0,0,0.06)',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default AdminSidebar;
