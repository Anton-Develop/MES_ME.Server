// src/components/Dashboards/DefaultDashboard.jsx
import React from 'react';
import { Container, Typography, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Dashboard as DashboardIcon, Assignment as AssignmentIcon, TableChart as TableChartIcon } from '@mui/icons-material';

// Определяем возможные действия, которые могут быть доступны пользователю
// на основе его прав. Это просто пример, можно адаптировать под реальные страницы.
const defaultActions = [
  { text: 'Журнал Учета Листов', icon: <AssignmentIcon />, route: '/sheet-accounting', permission: 'view_sheet_accounting' },
  { text: 'План проката', icon: <TableChartIcon />, route: '/rolling-plan-operator', permission: 'view_rolling_plan_operator' },
  { text: 'План прокатки', icon: <TableChartIcon />, route: '/rolling-plan-master', permission: 'view_rolling_plan_master' },
  { text: 'Управление кассетами', icon: <TableChartIcon />, route: '/cassette-management', permission: 'manage_cassettes' },
  { text: 'Просмотр пользователей', icon: <AssignmentIcon />, route: '/users', permission: 'view_users' },
  { text: 'Управление ролями', icon: <AssignmentIcon />, route: '/roles', permission: 'manage_roles' },
  { text: 'Управление правами ролей', icon: <AssignmentIcon />, route: '/permissions', permission: 'manage_role_permissions' },
  // ... добавьте другие действия, основываясь на возможных правах
];

const DefaultDashboard = () => {
  const navigate = useNavigate();

  // В этом дашборде мы не будем делать проверку прав внутри компонента,
  // так как само отображение этого дашборда в MainLayout зависит от права 'view_dashboard'.
  // Проверка прав для *конкретных действий* может быть выполнена в самих страницах или через ProtectedRoute.

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Добро пожаловать!
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Вы вошли в систему. Ниже представлены доступные вам разделы.
      </Typography>

      <Grid container spacing={3}>
        {defaultActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                {action.icon}
                {action.text}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => navigate(action.route)}
                  disabled={!action.permission} // Кнопка активна, если есть маршрут
                >
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

export default DefaultDashboard;