// src/components/Dashboards/MasterDashboard.jsx
import React from 'react';
import { Container, Typography, Grid, Box, Chip } from '@mui/material';
import {
  CalendarToday as CalendarTodayIcon,
  Inventory as InventoryIcon,
  TableChart as TableChartIcon,
  Assignment as AssignmentIcon,
  ManageSearch as ManageSearchIcon,
} from '@mui/icons-material';
import DashboardCard from './DashboardCard';
import { useAuth } from '../../context/AuthContext';

const masterActions = [
  { text: 'План закалки',          icon: <AssignmentIcon />,    route: '/annealing-batch-plan' },
  { text: 'Расписание закалки',    icon: <CalendarTodayIcon />, route: '/annealing-schedule' },
  { text: 'Управление кассетами',  icon: <InventoryIcon />,     route: '/cassette-management' },
  { text: 'Входные данные',        icon: <TableChartIcon />,    route: '/input-data' },
  { text: 'Изменение статусов',    icon: <ManageSearchIcon />,  route: '/sheet-status-updater' },
];

const MasterDashboard = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1B5E20 0%, #388E3C 60%, #66BB6A 100%)',
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
            label="Мастер"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, borderRadius: 1 }}
          />
        </Box>
        <Typography sx={{ opacity: 0.85, fontSize: '0.95rem' }}>
          {user?.username} · Управление производственным процессом
        </Typography>
      </Box>

      <Container maxWidth="lg" sx={{ mb: 5 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={600} letterSpacing={1.5}>
          Быстрый доступ
        </Typography>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {masterActions.map((action, index) => (
            <Grid item xs={12} sm={6} md={4} key={action.route}>
              <DashboardCard {...action} colorIndex={index} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default MasterDashboard;
