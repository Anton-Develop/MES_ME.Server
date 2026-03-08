// src/pages/Register.jsx
import React, { useState } from 'react';
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
} from '@mui/material';
import api from '../api';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  // ИСПРАВЛЕНО: добавлен флаг загрузки
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);
    try {
      await api.post('/auth/register', { username, email, password, role });
      setMessage('Пользователь успешно создан.');
      setIsError(false);
      // ИСПРАВЛЕНО: сбрасываем форму после успешной регистрации
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('operator');
    } catch (err) {
      setMessage('Ошибка: ' + (err.response?.data?.Message || err.response?.data?.message || 'Неизвестная ошибка'));
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
          >
            <MenuItem value="operator">Оператор</MenuItem>
            <MenuItem value="master">Мастер</MenuItem>
            <MenuItem value="developer">Разработчик</MenuItem>
            <MenuItem value="superadmin">Суперадмин</MenuItem>
          </Select>
        </FormControl>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
          disabled={loading}
        >
          {loading ? 'Регистрация...' : 'Зарегистрировать'}
        </Button>

        {/* ИСПРАВЛЕНО: заменён Typography на Alert для семантически правильного вывода статуса */}
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
