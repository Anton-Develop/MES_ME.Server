// src/components/Dashboards/DeveloperDashboard.jsx
import React from 'react';
import { Container, Typography, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarTodayIcon,
  Inventory as InventoryIcon,
  UploadFile as UploadFileIcon,
  TableChart as TableChartIcon,
  ManageSearch as ManageSearchIcon,
} from '@mui/icons-material';

const devActions = [
  { text: 'План закалки', icon: <AssignmentIcon />, route: '/annealing-batch-plan' },
  { text: 'План отпуска', icon: <AssignmentIcon />, route: '/AnnealingPlan-cassete' },
  { text: 'Расписание закалки', icon: <CalendarTodayIcon />, route: '/annealing-schedule' },
  { text: 'Управление кассетами', icon: <InventoryIcon />, route: '/cassette-management' },
  { text: 'Входные данные', icon: <TableChartIcon />, route: '/input-data' },
  { text: 'Изменение статусов', icon: <ManageSearchIcon />, route: '/sheet-status-updater' },
  { text: 'Импорт данных', icon: <UploadFileIcon />, route: '/import' },
  { text: 'Управление пользователями', icon: <PeopleIcon />, route: '/users' },
  { text: 'Управление ролями', icon: <PeopleIcon />, route: '/roles' },
  { text: 'Управление правами', icon: <AssignmentIcon />, route: '/permissions' },
];

const DeveloperDashboard = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, Разработчик!
      </Typography>
      <Typography variant="body1" paragraph color="text.secondary">
        Полный доступ ко всем функциям системы для администрирования и тестирования.
      </Typography>
      <Grid container spacing={3}>
        {devActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            {/* ИСПРАВЛЕНО: CardActions вынесен внутрь Card, иконка в CardContent рядом с текстом */}
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

export default DeveloperDashboard;
