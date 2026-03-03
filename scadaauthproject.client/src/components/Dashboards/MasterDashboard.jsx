// src/components/Dashboards/MasterDashboard.jsx
import React from 'react';
import { Container, Paper, Typography, Grid, Card, CardContent, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CalendarToday as CalendarTodayIcon, Inventory as InventoryIcon, TableChart as TableChartIcon } from '@mui/icons-material';

const MasterDashboard = () => {
  const navigate = useNavigate();

  const masterActions = [
    { text: 'План закалки', icon: <CalendarTodayIcon />, route: '/annealing-schedule', role: 'master' },
    { text: 'Управление кассетами', icon: <InventoryIcon />, route: '/cassette-management', role: 'master' },
    { text: 'Просмотр входных данных', icon: <TableChartIcon />, route: '/input-data', role: 'master' },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, Мастер!
      </Typography>
      <Typography variant="body1" paragraph>
        Здесь вы можете управлять производственным процессом: планировать закалку, контролировать кассеты и просматривать данные.
      </Typography>

      <Grid container spacing={3}>
        {masterActions.map((action, index) => (
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

export default MasterDashboard;