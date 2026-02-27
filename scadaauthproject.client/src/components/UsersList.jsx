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
  DialogTitle
} from '@mui/material';
import api from '../api';

const UsersList = () => {
    const [users, setUsers] = useState([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    useEffect(() => {
        api.get('/users')
            .then(res => setUsers(res.data))
            .catch(err => console.error(err));
    }, []);

   const handleToggleActive = async (userId) => {
    // Обновляем локально
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u));

    try {
        const res = await api.put(`/users/${userId}/toggle-active`);
        // Обновляем сообщение
        alert(res.data.Message);
    } catch (err) {
        // Если ошибка — откатываем
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u));
        alert('Ошибка: ' + err.response?.data?.Message);
    }
};

    const handleChangePassword = async (userId) => {
        const newPassword = prompt('Введите новый пароль:');
        if (!newPassword) return;

        try {
            await api.put(`/users/${userId}/password`, { newPassword });
            alert('Пароль изменён.');
        } catch (err) {
            alert('Ошибка: ' + err.response?.data?.Message);
        }
    };

    const handleDeleteConfirm = (userId) => {
        setUserToDelete(userId);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirmed = async () => {
        try {
            await api.delete(`/users/${userToDelete}`);
            setUsers(prev => prev.filter(u => u.id !== userToDelete));
            alert('Пользователь деактивирован.');
        } catch (err) {
            alert('Ошибка: ' + err.response?.data?.Message);
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
                            {users.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.id}</TableCell>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{user.role}</TableCell>
                                    <TableCell>
                                        <Switch
                                          checked={user.isActive}
                                          onChange={() => handleToggleActive(user.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button size="small" onClick={() => handleChangePassword(user.id)}>Сбросить пароль</Button>
                                        <Button size="small" onClick={() => handleDeleteConfirm(user.id)}>Деактивировать</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Dialog для подтверждения деактивации */}
            <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
                <DialogTitle>Подтверждение деактивации</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Вы уверены, что хотите деактивировать этого пользователя?
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