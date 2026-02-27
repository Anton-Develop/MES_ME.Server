import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  TextField,
  Box,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import api from '../api';

const RolesManager = () => {
    const [roles, setRoles] = useState([]);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDescription, setNewRoleDescription] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState(null);

    useEffect(() => {
        api.get('/roles')
            .then(res => {
                setRoles(res.data);
            })
            .catch(err => {
                console.error('Error fetching roles:', err);
            });
    }, []);

    const handleCreateRole = async () => {
        if (!newRoleName.trim()) return;

        try {
            await api.post('/roles', {
                name: newRoleName,
                description: newRoleDescription
            });
            alert(`Роль "${newRoleName}" создана.`);
            setNewRoleName('');
            setNewRoleDescription('');

            api.get('/roles')
                .then(res => setRoles(res.data))
                .catch(err => console.error(err));
        } catch (err) {
            console.error('Ошибка:', err.response?.data);
            alert('Ошибка: ' + (err.response?.data?.Message || 'Неизвестная ошибка'));
        }
    };

    const handleDeleteConfirm = (roleId) => {
        setRoleToDelete(roleId);
        setDialogOpen(true);
    };

    const handleDeleteConfirmed = async () => {
        try {
            await api.delete(`/roles/${roleToDelete}`);
            setRoles(prev => prev.filter(r => r.id !== roleToDelete));
            alert('Роль удалена.');
        } catch (err) {
            alert('Ошибка: ' + err.response?.data?.Message);
        } finally {
            setDialogOpen(false);
            setRoleToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDialogOpen(false);
        setRoleToDelete(null);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>
                    Управление ролями
                </Typography>

                <Box component="form" onSubmit={(e) => { e.preventDefault(); handleCreateRole(); }} sx={{ mb: 3 }}>
                    <TextField
                        fullWidth
                        label="Название новой роли"
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        sx={{ mb: 2 }}
                        required
                    />
                    <TextField
                        fullWidth
                        label="Описание (необязательно)"
                        value={newRoleDescription}
                        onChange={e => setNewRoleDescription(e.target.value)}
                        multiline
                        rows={2}
                        sx={{ mb: 2 }}
                    />
                    <Button variant="contained" type="submit">
                        Создать роль
                    </Button>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6">Существующие роли:</Typography>
                <List>
                    {roles.length > 0 ? (
                        roles.map((role) => (
                            <ListItem key={role.id} secondaryAction={
                              <IconButton edge="end" onClick={() => handleDeleteConfirm(role.id)}>
                                <DeleteIcon />
                              </IconButton>
                            }>
                                <ListItemText
                                    primary={role.name}
                                    secondary={role.description || "Нет описания"}
                                />
                            </ListItem>
                        ))
                    ) : (
                        <ListItem>
                            <ListItemText primary="Нет ролей" />
                        </ListItem>
                    )}
                </List>
            </Paper>

            {/* Dialog для подтверждения удаления */}
            <Dialog open={dialogOpen} onClose={handleDeleteCancel}>
                <DialogTitle>Подтверждение удаления</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Вы уверены, что хотите удалить эту роль?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel}>Отмена</Button>
                    <Button onClick={handleDeleteConfirmed} color="error">Удалить</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default RolesManager;