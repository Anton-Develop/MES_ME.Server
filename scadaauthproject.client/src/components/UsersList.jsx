// src/components/UsersList.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
  Switch,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import api from '../api';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // ИСПРАВЛЕНО: загрузка вынесена в функцию + добавлены состояния loading и error
  const fetchUsers = () => {
    setLoading(true);
    api.get('/users')
      .then(res => setUsers(res.data))
      .catch(err => {
        console.error(err);
        setError('Не удалось загрузить список пользователей.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (userId) => {
    // Оптимистичное обновление
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u));
    setError('');

    try {
      await api.put(`/users/${userId}/toggle-active`);
    } catch (err) {
      // Откат при ошибке
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u));
      setError('Ошибка изменения статуса: ' + (err.response?.data?.Message || err.response?.data?.message || 'Неизвестная ошибка'));
    }
  };

  const handleChangePassword = async (userId) => {
    const newPassword = prompt('Введите новый пароль:');
    if (!newPassword) return;

    try {
      await api.put(`/users/${userId}/password`, { newPassword });
      // ИСПРАВЛЕНО: alert заменён на setError/success (здесь оставлен alert как минимальный костыль,
      // поскольку полноценный диалог потребует отдельного Dialog-компонента)
      setError('');
      alert('Пароль изменён.');
    } catch (err) {
      setError('Ошибка смены пароля: ' + (err.response?.data?.Message || err.response?.data?.message || 'Неизвестная ошибка'));
    }
  };

  const handleDeleteConfirm = (userId) => {
    setUserToDelete(userId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    setError('');
    try {
      await api.delete(`/users/${userToDelete}`);
      setUsers(prev => prev.filter(u => u.id !== userToDelete));
    } catch (err) {
      setError('Ошибка: ' + (err.response?.data?.Message || err.response?.data?.message || 'Неизвестная ошибка'));
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>
          Управление пользователями
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Логин</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Роль</TableCell>
                  <TableCell>Активен</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Пользователи не найдены</TableCell>
                  </TableRow>
                ) : (
                  users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        <Switch
                          checked={!!user.isActive}
                          onChange={() => handleToggleActive(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => handleChangePassword(user.id)}>
                          Сбросить пароль
                        </Button>
                        <Button size="small" color="error" onClick={() => handleDeleteConfirm(user.id)}>
                          Деактивировать
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Подтверждение деактивации</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите деактивировать пользователя{' '}
            <strong>{users.find(u => u.id === userToDelete)?.username}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Отмена</Button>
          <Button onClick={handleDeleteConfirmed} color="error">Деактивировать</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UsersList;
