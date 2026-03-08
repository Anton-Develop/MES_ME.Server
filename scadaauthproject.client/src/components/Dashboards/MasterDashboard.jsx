// src/components/Dashboards/MasterDashboard.jsx
import React from 'react';
import { Container, Typography, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  CalendarToday as CalendarTodayIcon,
  Inventory as InventoryIcon,
  TableChart as TableChartIcon,
  Assignment as AssignmentIcon,
  ManageSearch as ManageSearchIcon,
} from '@mui/icons-material';

const masterActions = [
  { text: 'План закалки', icon: <AssignmentIcon />, route: '/annealing-batch-plan' },
  { text: 'Расписание закалки', icon: <CalendarTodayIcon />, route: '/annealing-schedule' },
  { text: 'Управление кассетами', icon: <InventoryIcon />, route: '/cassette-management' },
  { text: 'Просмотр входных данных', icon: <TableChartIcon />, route: '/input-data' },
  { text: 'Изменение статусов', icon: <ManageSearchIcon />, route: '/sheet-status-updater' },
];

const MasterDashboard = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, Мастер!
      </Typography>
      <Typography variant="body1" paragraph color="text.secondary">
        Управляйте производственным процессом: планируйте закалку, контролируйте кассеты и просматривайте данные.
      </Typography>
      <Grid container spacing={3}>
        {masterActions.map((action, index) => (
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

export default MasterDashboard;
