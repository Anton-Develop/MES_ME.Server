// src/components/Dashboards/DashboardCard.jsx
import React from 'react';
import { Card, CardActionArea, Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Цвета для иконок по категориям
const ACCENT_COLORS = [
  '#1976D2', '#388E3C', '#F57C00', '#7B1FA2',
  '#C62828', '#00838F', '#558B2F', '#4527A0',
  '#AD1457', '#E65100',
];

const DashboardCard = ({ text, icon, route, colorIndex = 0 }) => {
  const navigate = useNavigate();
  const color = ACCENT_COLORS[colorIndex % ACCENT_COLORS.length];

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: color,
          boxShadow: `0 4px 20px ${color}22`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardActionArea
        onClick={() => navigate(route)}
        sx={{ height: '100%', p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
      >
        {/* Иконка */}
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: `${color}18`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            '& svg': { fontSize: 24 },
          }}
        >
          {icon}
        </Box>

        <Typography
          variant="body1"
          fontWeight={600}
          color="text.primary"
          fontSize="0.9rem"
          lineHeight={1.3}
        >
          {text}
        </Typography>

        <Typography variant="caption" color={color} sx={{ mt: 1, fontWeight: 500 }}>
          Открыть →
        </Typography>
      </CardActionArea>
    </Card>
  );
};

export default DashboardCard;
