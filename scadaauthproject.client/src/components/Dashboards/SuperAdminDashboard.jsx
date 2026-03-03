// src/components/Dashboards/SuperAdminDashboard.jsx
import React from 'react';
import { Container, Paper, Typography, Grid, Card, CardContent, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CalendarToday as CalendarTodayIcon, Inventory as InventoryIcon, People as PeopleIcon, Assignment as AssignmentIcon, UploadFile as UploadFileIcon } from '@mui/icons-material';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();

  const quickActions = [
    { text: 'План закалки', icon: <CalendarTodayIcon />, route: '/annealing-schedule', role: 'superadmin' },
    { text: 'Управление кассетами', icon: <InventoryIcon />, route: '/cassette-management', role: 'superadmin' },
    { text: 'Входные данные', icon: <CalendarTodayIcon />, route: '/input-data', role: 'superadmin' }, // Используем иконку для данных
    { text: 'Управление пользователями', icon: <PeopleIcon />, route: '/users', role: 'superadmin' },
    { text: 'Управление ролями', icon: <PeopleIcon />, route: '/roles', role: 'superadmin' },
    { text: 'Управление правами', icon: <AssignmentIcon />, route: '/permissions', role: 'superadmin' },
    { text: 'Импорт данных', icon: <UploadFileIcon />, route: '/import', role: 'superadmin' },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, Суперадмин!
      </Typography>
      <Typography variant="body1" paragraph>
        Это ваша главная панель управления. Отсюда вы можете получить доступ ко всем функциям системы.
      </Typography>

      <Grid container spacing={3}>
        {quickActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" component="div">
                  {action.icon} {action.text}
                </Typography>
              </CardContent>
              <Button
                size="small"
                onClick={() => navigate(action.route)}
                sx={{ margin: 1 }}
              >
                Открыть
              </Button>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default SuperAdminDashboard;