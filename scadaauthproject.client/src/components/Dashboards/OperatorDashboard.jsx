// src/components/Dashboards/OperatorDashboard.jsx
import React from 'react';
import { Container, Typography, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Assignment as AssignmentIcon, TableChart as TableChartIcon } from '@mui/icons-material';

// ИСПРАВЛЕНО: убраны закомментированные строки — лишний мусор в коде
const operatorActions = [
  { text: 'План закалки', icon: <AssignmentIcon />, route: '/annealing-batch-plan' },
  { text: 'Просмотр входных данных', icon: <TableChartIcon />, route: '/input-data' },
];

const OperatorDashboard = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, Оператор!
      </Typography>
      <Typography variant="body1" paragraph color="text.secondary">
        Здесь вы можете просматривать план закалки и входные данные.
      </Typography>
      <Grid container spacing={3}>
        {operatorActions.map((action, index) => (
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

export default OperatorDashboard;
