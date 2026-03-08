// src/components/RolesManager.jsx
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
  DialogTitle,
  Alert,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import api from '../api';

const RolesManager = () => {
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  // ИСПРАВЛЕНО: добавлена обработка ошибок через Alert вместо alert()
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ИСПРАВЛЕНО: fetchRoles вынесена в отдельную функцию для повторного использования
  const fetchRoles = () => {
    api.get('/roles')
      .then(res => setRoles(res.data))
      .catch(err => {
        console.error('Ошибка загрузки ролей:', err);
        setError('Не удалось загрузить список ролей.');
      });
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setError('');
    setSuccessMessage('');

    try {
      await api.post('/roles', { name: newRoleName.trim(), description: newRoleDescription.trim() });
      setSuccessMessage(`Роль «${newRoleName}» создана.`);
      setNewRoleName('');
      setNewRoleDescription('');
      fetchRoles();
    } catch (err) {
      console.error('Ошибка создания роли:', err.response?.data);
      setError('Ошибка: ' + (err.response?.data?.Message || err.response?.data?.message || 'Неизвестная ошибка'));
    }
  };

  const handleDeleteConfirm = (roleId) => {
    setRoleToDelete(roleId);
    setDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    setError('');
    try {
      await api.delete(`/roles/${roleToDelete}`);
      setRoles(prev => prev.filter(r => r.id !== roleToDelete));
      setSuccessMessage('Роль удалена.');
    } catch (err) {
      setError('Ошибка: ' + (err.response?.data?.Message || err.response?.data?.message || 'Неизвестная ошибка'));
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

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {successMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>{successMessage}</Alert>}

        <Box
          component="form"
          onSubmit={(e) => { e.preventDefault(); handleCreateRole(); }}
          sx={{ mb: 3 }}
        >
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
          <Button variant="contained" type="submit" disabled={!newRoleName.trim()}>
            Создать роль
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>Существующие роли:</Typography>
        <List>
          {roles.length > 0 ? (
            roles.map((role) => (
              <ListItem
                key={role.id}
                secondaryAction={
                  <IconButton edge="end" onClick={() => handleDeleteConfirm(role.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={role.name}
                  secondary={role.description || 'Нет описания'}
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

      <Dialog open={dialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить роль «{roles.find(r => r.id === roleToDelete)?.name}»?
            Это действие нельзя отменить.
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
