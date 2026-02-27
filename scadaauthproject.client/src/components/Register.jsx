import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Container, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import api from '../api';

const Register = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('operator'); // по умолчанию
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/register', { username, email, password, role });
            setMessage('Пользователь успешно создан. Теперь войдите.');
        } catch (err) {
            setMessage('Ошибка: ' + (err.response?.data?.Message || 'Неизвестная ошибка'));
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
                />
                <TextField
                    fullWidth
                    margin="normal"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                <TextField
                    fullWidth
                    margin="normal"
                    label="Пароль"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
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
                <Button type="submit" fullWidth variant="contained" sx={{ mt: 2 }}>
                    Зарегистрировать
                </Button>
                {message && (
                    <Typography
                        sx={{
                            mt: 2,
                            color: message.includes('Ошибка') ? 'error.main' : 'success.main',
                        }}
                    >
                        {message}
                    </Typography>
                )}
            </Box>
        </Container>
    );
};

export default Register;