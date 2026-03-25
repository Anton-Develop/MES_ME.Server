// src/components/RoutePermissionsManager.jsx
// UI для управления маршрутами: создание, редактирование, удаление, переключение активности.
// Доступен только пользователям с правом manage_route_permissions (superadmin, developer).

import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
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
  Switch,
  FormControlLabel,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Chip,
  Tooltip,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon } from '@mui/icons-material';
import api from '../api';
import { useRoutePermissions } from './RoutePermissionsContext';

const ICON_OPTIONS = [
  'Dashboard', 'Assignment', 'People', 'Settings', 'Build',
  'CalendarToday', 'Inventory', 'TableChart', 'UploadFile', 'ManageSearch', 'Map',
];

const EMPTY_FORM = {
  path: '',
  label: '',
  iconName: 'Dashboard',
  requiredPermission: '',
  sortOrder: 0,
};

const RoutePermissionsManager = () => {
  const [routes, setRoutes] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  // После сохранения обновляем и сайдбар через контекст
  const { refetch: refetchSidebar } = useRoutePermissions();

  const fetchRoutes = async () => {
    try {
      const res = await api.get('/routepermissions');
      setRoutes(res.data);
    } catch {
      setError('Не удалось загрузить маршруты.');
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await api.get('/permissions');
      setPermissions(res.data);
    } catch {
      setError('Не удалось загрузить список прав.');
    }
  };

  useEffect(() => {
    fetchRoutes();
    fetchPermissions();
  }, []);

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    if (!form.path.trim() || !form.label.trim() || !form.requiredPermission) {
      setError('Заполните обязательные поля: путь, название, право доступа.');
      return;
    }
    if (!form.path.startsWith('/')) {
      setError('Путь должен начинаться с "/".');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/routepermissions/${editingId}`, form);
        setSuccess('Маршрут обновлён.');
      } else {
        await api.post('/routepermissions', form);
        setSuccess('Маршрут создан.');
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setFormOpen(false);
      await fetchRoutes();
      await refetchSidebar(); // обновляем сайдбар сразу
    } catch (err) {
      setError(err.response?.data || 'Ошибка сохранения маршрута.');
    }
  };

  const handleEdit = (route) => {
    setForm({
      path: route.path,
      label: route.label,
      iconName: route.iconName,
      requiredPermission: route.requiredPermission,
      sortOrder: route.sortOrder,
    });
    setEditingId(route.id);
    setFormOpen(true);
    setError('');
    setSuccess('');
  };

  const handleToggleActive = async (route) => {
    try {
      await api.put(`/routepermissions/${route.id}`, { isActive: !route.isActive });
      await fetchRoutes();
      await refetchSidebar();
      setSuccess(`Маршрут "${route.label}" ${!route.isActive ? 'включён' : 'выключен'}.`);
    } catch {
      setError('Ошибка при изменении статуса маршрута.');
    }
  };

  const handleDeleteConfirm = (route) => {
    setDeleteTarget(route);
    setDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    try {
      await api.delete(`/routepermissions/${deleteTarget.id}`);
      setSuccess(`Маршрут "${deleteTarget.label}" удалён.`);
      await fetchRoutes();
      await refetchSidebar();
    } catch {
      setError('Ошибка при удалении маршрута.');
    } finally {
      setDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
    setError('');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Управление маршрутами</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setFormOpen(true); setEditingId(null); setForm(EMPTY_FORM); }}
          >
            Добавить маршрут
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Здесь вы определяете, какие страницы существуют в системе и какое право необходимо для доступа к ним.
          После изменений сайдбар обновляется автоматически для всех пользователей при следующем входе.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {/* Форма создания / редактирования */}
        {formOpen && (
          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {editingId ? 'Редактировать маршрут' : 'Новый маршрут'}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Путь (например: /sheet-accounting)"
                  value={form.path}
                  onChange={handleFormChange('path')}
                  required
                  disabled={!!editingId} // путь не меняем при редактировании — это ID маршрута
                  helperText={editingId ? 'Путь нельзя изменить — удалите и создайте заново' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Название в меню"
                  value={form.label}
                  onChange={handleFormChange('label')}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Право доступа</InputLabel>
                  <Select
                    value={form.requiredPermission}
                    onChange={handleFormChange('requiredPermission')}
                    label="Право доступа"
                  >
                    {permissions.map((p) => (
                      <MenuItem key={p.id} value={p.name}>
                        {p.name}
                        {p.description ? ` — ${p.description}` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Иконка</InputLabel>
                  <Select
                    value={form.iconName}
                    onChange={handleFormChange('iconName')}
                    label="Иконка"
                  >
                    {ICON_OPTIONS.map((name) => (
                      <MenuItem key={name} value={name}>{name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Порядок в меню"
                  type="number"
                  value={form.sortOrder}
                  onChange={handleFormChange('sortOrder')}
                  inputProps={{ min: 0, step: 10 }}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={handleSubmit}>
                {editingId ? 'Сохранить' : 'Создать'}
              </Button>
              <Button variant="outlined" onClick={handleCancelForm}>Отмена</Button>
            </Box>
          </Paper>
        )}

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>Существующие маршруты</Typography>

        <List>
          {routes.length === 0 && (
            <ListItem><ListItemText primary="Маршруты не найдены" /></ListItem>
          )}
          {routes.map((route) => (
            <ListItem
              key={route.id}
              sx={{ opacity: route.isActive ? 1 : 0.5, alignItems: 'flex-start', py: 1.5 }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body1" fontWeight={500}>{route.label}</Typography>
                    <Chip label={route.path} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                    {!route.isActive && <Chip label="Отключён" size="small" color="warning" />}
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={`Право: ${route.requiredPermission}`} size="small" color="primary" variant="outlined" />
                    <Chip label={`Иконка: ${route.iconName}`} size="small" variant="outlined" />
                    <Chip label={`Порядок: ${route.sortOrder}`} size="small" variant="outlined" />
                  </Box>
                }
              />
              <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title={route.isActive ? 'Отключить' : 'Включить'}>
                  <Switch
                    checked={route.isActive}
                    onChange={() => handleToggleActive(route)}
                    size="small"
                  />
                </Tooltip>
                <Tooltip title="Редактировать">
                  <IconButton onClick={() => handleEdit(route)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Удалить">
                  <IconButton onClick={() => handleDeleteConfirm(route)} size="small" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Удалить маршрут <strong>{deleteTarget?.label}</strong> ({deleteTarget?.path})?
            Пользователи больше не смогут его видеть в меню. Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleDeleteConfirmed} color="error">Удалить</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default RoutePermissionsManager;
