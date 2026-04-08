// src/components/Dashboards/DeveloperDashboard.jsx
import React from 'react';
import { Container, Typography, Grid, Box, Chip } from '@mui/material';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarTodayIcon,
  Inventory as InventoryIcon,
  UploadFile as UploadFileIcon,
  TableChart as TableChartIcon,
  ManageSearch as ManageSearchIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import DashboardCard from './DashboardCard';
import { useAuth } from '../../context/AuthContext';

const devActions = [
  { text: 'План закалки',          icon: <AssignmentIcon />,    route: '/annealing-batch-plan' },
  { text: 'План отпуска',          icon: <AssignmentIcon />,    route: '/AnnealingPlan-cassete' },
  { text: 'Расписание закалки',    icon: <CalendarTodayIcon />, route: '/annealing-schedule' },
  { text: 'Управление кассетами',  icon: <InventoryIcon />,     route: '/cassette-management' },
  { text: 'Входные данные',        icon: <TableChartIcon />,    route: '/input-data' },
  { text: 'Изменение статусов',    icon: <ManageSearchIcon />,  route: '/sheet-status-updater' },
  { text: 'Импорт данных',         icon: <UploadFileIcon />,    route: '/import' },
  { text: 'Пользователи',          icon: <PeopleIcon />,        route: '/users' },
  { text: 'Роли',                  icon: <PeopleIcon />,        route: '/roles' },
  { text: 'Права доступа',         icon: <SecurityIcon />,      route: '/permissions' },
];

const DeveloperDashboard = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #4A148C 0%, #7B1FA2 60%, #BA68C8 100%)',
          color: '#fff',
          px: { xs: 3, md: 5 },
          py: { xs: 3, md: 4 },
          mb: 3,
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5} mb={1}>
          <Typography variant="h4" fontWeight={700} component="h1">
            Добро пожаловать
          </Typography>
          <Chip
            label="Разработчик"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, borderRadius: 1 }}
          />
        </Box>
        <Typography sx={{ opacity: 0.85, fontSize: '0.95rem' }}>
          {user?.username} · Полный доступ для администрирования и тестирования
        </Typography>
      </Box>

      <Container maxWidth="lg" sx={{ mb: 5 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={600} letterSpacing={1.5}>
          Быстрый доступ
        </Typography>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {devActions.map((action, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={action.route + index}>
              <DashboardCard {...action} colorIndex={index} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default DeveloperDashboard;
