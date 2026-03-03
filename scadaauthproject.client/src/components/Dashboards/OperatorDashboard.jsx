// src/components/Dashboards/OperatorDashboard.jsx
import React from 'react';
import { Container, Paper, Typography, Grid, Card, CardContent, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CalendarToday as CalendarTodayIcon, UploadFile as UploadFileIcon, TableChart as TableChartIcon } from '@mui/icons-material';
import AssignmentIcon from '@mui/icons-material/Assignment'; 

const OperatorDashboard = () => {
  const navigate = useNavigate();

  const operatorActions = [
     { text: 'План закалки ', icon: <AssignmentIcon />, route: '/annealing-batch-plan', role: 'operator' },
   // { text: 'План закалки', icon: <CalendarTodayIcon />, route: '/annealing-schedule', role: 'operator' },
   // { text: 'Просмотр входных данных', icon: <TableChartIcon />, route: '/input-data', role: 'operator' },
    //{ text: 'Импорт данных', icon: <UploadFileIcon />, route: '/import', role: 'operator' },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, Оператор!
      </Typography>
      <Typography variant="body1" paragraph>
        Здесь вы можете просматривать план закалки, работать с входными данными и импортировать новые.
      </Typography>

      <Grid container spacing={3}>
        {operatorActions.map((action, index) => (
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

export default OperatorDashboard;