// src/pages/Register.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import api from '../api';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [roles, setRoles] = useState([]);          // список ролей с бэкенда
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState('');

  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Загружаем роли один раз при открытии страницы
  useEffect(() => {
    let cancelled = false;
    setRolesLoading(true);
    setRolesError('');

    api.get('/roles')
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setRoles(list);

        // Выбираем роль по умолчанию: сначала ищем "operator", иначе — первую
        const defaultRole =
          list.find(r => r.name?.toLowerCase() === 'operator') || list[0];
        if (defaultRole) {
          setRole(defaultRole.name);
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Ошибка загрузки ролей:', err);
        setRolesError('Не удалось загрузить список ролей.');
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!role) {
      setIsError(true);
      setMessage('Выберите роль перед регистрацией.');
      return;
    }

    setLoading(true);
    setMessage('');
    setIsError(false);
    try {
      await api.post('/auth/register', { username, email, password, role });
      setMessage('Пользователь успешно создан.');
      setIsError(false);
      setUsername('');
      setEmail('');
      setPassword('');
      // роль оставляем — удобно, если регистрируют несколько операторов подряд
    } catch (err) {
      setMessage(
        'Ошибка: ' +
          (err.response?.data?.Message ||
            err.response?.data?.message ||
            'Неизвестная ошибка')
      );
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4">Регистрация пользователя</Typography>
      </Box>

      {rolesError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRolesError('')}>
          {rolesError}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          margin="normal"
          label="Логин"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          autoComplete="username"
        />
        <TextField
          fullWidth
          margin="normal"
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <TextField
          fullWidth
          margin="normal"
          label="Пароль"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <FormControl fullWidth margin="normal" required>
          <InputLabel>Роль</InputLabel>
          <Select
            value={role}
            onChange={e => setRole(e.target.value)}
            label="Роль"
            disabled={rolesLoading || !!rolesError || roles.length === 0}
            endAdornment={
              rolesLoading ? <CircularProgress size={18} sx={{ mr: 2 }} /> : null
            }
          >
            {roles.length === 0 && !rolesLoading && (
              <MenuItem value="" disabled>Нет доступных ролей</MenuItem>
            )}
            {roles.map(r => (
              <MenuItem key={r.id} value={r.name}>
                {r.name}
                {r.description ? ` — ${r.description}` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
          disabled={loading || rolesLoading || !role}
        >
          {loading ? 'Регистрация...' : 'Зарегистрировать'}
        </Button>

        {message && (
          <Alert severity={isError ? 'error' : 'success'} sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
      </Box>
    </Container>
  );
};

export default Register;