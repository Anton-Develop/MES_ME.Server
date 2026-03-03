// src/components/Dashboards/DeveloperDashboard.jsx
import React from 'react';
import { Container, Paper, Typography, Grid, Card, CardContent, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { People as PeopleIcon, Assignment as AssignmentIcon, CalendarToday as CalendarTodayIcon, Inventory as InventoryIcon, UploadFile as UploadFileIcon, TableChart as TableChartIcon } from '@mui/icons-material';

const DeveloperDashboard = () => {
  const navigate = useNavigate();

  const devActions = [
    { text: 'План закалки 2', icon: <AssignmentIcon />, route: '/annealing-batch-plan', role: 'developer' },
    { text: 'План закалки', icon: <CalendarTodayIcon />, route: '/annealing-schedule', role: 'developer' },
    { text: 'Управление кассетами', icon: <InventoryIcon />, route: '/cassette-management', role: 'developer' },
    { text: 'Входные данные', icon: <TableChartIcon />, route: '/input-data', role: 'developer' },
    { text: 'Импорт данных', icon: <UploadFileIcon />, route: '/import', role: 'developer' },
    { text: 'Управление пользователями', icon: <PeopleIcon />, route: '/users', role: 'developer' },
    { text: 'Управление ролями', icon: <PeopleIcon />, route: '/roles', role: 'developer' },
    { text: 'Управление правами', icon: <AssignmentIcon />, route: '/permissions', role: 'developer' },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, Разработчик!
      </Typography>
      <Typography variant="body1" paragraph>
        Здесь вы получаете доступ к полному функционалу системы для администрирования и тестирования.
      </Typography>

      <Grid container spacing={3}>
        {devActions.map((action, index) => (
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

export default DeveloperDashboard;