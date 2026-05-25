// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Если пользователь уже админ и залогинен — перенаправляем
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const success = await login(username, password, rememberMe);
      if (success) {
        navigate('/');
      } else {
        setError('Неверное имя пользователя или пароль');
      }
    } catch {
      setError('Ошибка соединения. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  // Быстрый вход для администратора (для разработки/тестирования)
  const adminQuickLogin = async () => {
    setLoading(true);
    const success = await login('Anton', 'superanton', true); // ← замените на реальный пароль
    if (success) navigate('/');
    setLoading(false);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Вход в систему
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            margin="normal"
            label="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            autoFocus
          />
          
          <TextField
            fullWidth
            margin="normal"
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          
          <FormControlLabel
            control={
              <Checkbox 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
              />
            }
            label="Запомнить меня (оставаться в системе после закрытия браузера)"
            sx={{ mt: 1 }}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </Button>
        </Box>

        {/* Быстрый вход для администратора (только для разработки) */}
        <Divider sx={{ my: 3 }}>или</Divider>
        
        <Button
          fullWidth
          variant="outlined"
          color="warning"
          onClick={adminQuickLogin}
          disabled={loading}
        >
          ⚡ Быстрый вход (Администратор)
        </Button>
        
        <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
          Токен доступа действителен 60 минут
        </Typography>
      </Paper>
    </Container>
  );
};

export default Login;