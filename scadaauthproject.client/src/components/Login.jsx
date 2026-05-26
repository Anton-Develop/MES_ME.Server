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

  // Используем useRef для предотвращения множественных редиректов
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    // Редиректим только если пользователь есть и еще не редиректили
    if (user && !redirected) {
      setRedirected(true);
      navigate('/', { replace: true });
    }
  }, [user, navigate, redirected]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const success = await login(username, password, rememberMe);
      if (success) {
        // Не делаем navigate здесь, дождемся useEffect
        // navigate('/', { replace: true });
      } else {
        setError('Неверное имя пользователя или пароль');
        setLoading(false);
      }
    } catch (err) {
      setError('Ошибка соединения. Попробуйте позже.');
      setLoading(false);
    }
    // Убираем setLoading(false) из finally, т.к. при успехе не сбрасываем
  };

  // Быстрый вход
  const adminQuickLogin = async () => {
    setLoading(true);
    setError('');
    const success = await login('Oper_2', '12341234', true);
    if (!success) {
      setError('Ошибка входа');
      setLoading(false);
    }
    // При успехе loading останется true до редиректа
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
            disabled={loading}
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
            disabled={loading}
          />
          
          <FormControlLabel
            control={
              <Checkbox 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
                disabled={loading}
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

        <Divider sx={{ my: 3 }}>или</Divider>
        
        <Button
          fullWidth
          variant="outlined"
          color="warning"
          onClick={adminQuickLogin}
          disabled={loading}
        >
          ⚡ Быстрый вход (Оператор)
        </Button>
        
        <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
          Токен доступа действителен 60 минут
        </Typography>
      </Paper>
    </Container>
  );
};

export default Login;