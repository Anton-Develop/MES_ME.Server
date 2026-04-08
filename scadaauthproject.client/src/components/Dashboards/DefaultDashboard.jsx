// src/components/Dashboards/DefaultDashboard.jsx
import React from 'react';
import { Container, Typography, Grid, Box } from '@mui/material';
import { Assignment as AssignmentIcon, TableChart as TableChartIcon } from '@mui/icons-material';
import DashboardCard from './DashboardCard';
import { useAuth } from '../../context/AuthContext';

const defaultActions = [
  { text: 'Журнал учёта листов',  icon: <AssignmentIcon />,  route: '/sheet-accounting' },
  { text: 'Входные данные',       icon: <TableChartIcon />,  route: '/input-data' },
];

const DefaultDashboard = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #37474F 0%, #546E7A 60%, #90A4AE 100%)',
          color: '#fff',
          px: { xs: 3, md: 5 },
          py: { xs: 3, md: 4 },
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight={700} component="h1" gutterBottom>
          Добро пожаловать
        </Typography>
        <Typography sx={{ opacity: 0.85, fontSize: '0.95rem' }}>
          {user?.username} · Доступные вам разделы системы
        </Typography>
      </Box>

      <Container maxWidth="lg" sx={{ mb: 5 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={600} letterSpacing={1.5}>
          Быстрый доступ
        </Typography>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {defaultActions.map((action, index) => (
            <Grid item xs={12} sm={6} md={4} key={action.route}>
              <DashboardCard {...action} colorIndex={index} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default DefaultDashboard;
