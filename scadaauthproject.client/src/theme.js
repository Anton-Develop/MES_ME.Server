// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Стандартный синий
    },
    secondary: {
      main: '#dc004e', // Стандартный розовый
    },
    background: {
      default: '#f5f5f7', // Светлый фон страницы
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a237e', // Темно-синий AppBar
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#c6d0d4', // Темно-серый боковой бар
          color: '#ffffff',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: '#42a5f5', // Более светлый синий для контейнера
          '&:hover': {
            backgroundColor: '#1e88e5',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16, // Скругленные углы карточек
        },
      },
    },
  },
});

export default theme;