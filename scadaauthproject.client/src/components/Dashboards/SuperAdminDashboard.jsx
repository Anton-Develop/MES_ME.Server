// src/components/Dashboards/SuperAdminDashboard.jsx
import React from 'react';
import { Container, Typography, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  CalendarToday as CalendarTodayIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  UploadFile as UploadFileIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';

// ИСПРАВЛЕНО: убраны дублирующие иконки CalendarTodayIcon для «Входных данных»
const quickActions = [
  { text: 'План закалки', icon: <AssignmentIcon />, route: '/annealing-batch-plan' },
  { text: 'Расписание закалки', icon: <CalendarTodayIcon />, route: '/annealing-schedule' },
  { text: 'Управление кассетами', icon: <InventoryIcon />, route: '/cassette-management' },
  { text: 'Входные данные', icon: <TableChartIcon />, route: '/input-data' },
  { text: 'Импорт данных', icon: <UploadFileIcon />, route: '/import' },
  { text: 'Управление пользователями', icon: <PeopleIcon />, route: '/users' },
  { text: 'Управление ролями', icon: <PeopleIcon />, route: '/roles' },
  { text: 'Управление правами', icon: <AssignmentIcon />, route: '/permissions' },
];

const SuperAdminDashboard = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, Суперадмин!
      </Typography>
      <Typography variant="body1" paragraph color="text.secondary">
        Главная панель управления. Полный доступ ко всем функциям системы.
      </Typography>
      <Grid container spacing={3}>
        {quickActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                {action.icon}
                <Typography variant="h6">{action.text}</Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate(action.route)}>
                  Открыть
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default SuperAdminDashboard;
