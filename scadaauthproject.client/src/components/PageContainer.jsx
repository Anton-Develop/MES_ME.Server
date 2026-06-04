// src/components/PageContainer.jsx
import React from 'react';
import { Box } from '@mui/material';

const PageContainer = ({ children }) => {
  return (
    <Box sx={{
      // На мобильных: 100% ширины экрана. На десктопе: 95% ширины экрана.
      width: { xs: '100%', md: '95vw' }, 
      maxWidth: '100%', // Гарантия, что никогда не вылезет за пределы
      mx: 'auto', // Центрирование по горизонтали
      px: { xs: 2, sm: 3, md: 4 }, // Адаптивные отступы внутри
      py: { xs: 2, md: 4 },
      boxSizing: 'border-box',
    }}>
      {children}
    </Box>
  );
};

export default PageContainer;