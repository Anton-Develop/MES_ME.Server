// src/components/RolePermissionsManager.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import api from '../api';

const RolePermissionsManager = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [assignedPermissions, setAssignedPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  // ИСПРАВЛЕНО: добавлена обработка ошибок
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesRes, permsRes] = await Promise.all([
          api.get('/roles'),
          api.get('/permissions'),
        ]);
        setRoles(rolesRes.data);
        setPermissions(permsRes.data);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        setError('Не удалось загрузить роли и права.');
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      setAssignedPermissions([]);
      return;
    }

    const fetchAssigned = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/rolepermissions/role/${selectedRoleId}`);
        setAssignedPermissions(res.data.map(p => p.id));
      } catch (err) {
        console.error('Ошибка загрузки прав роли:', err);
        setError('Не удалось загрузить права для выбранной роли.');
      } finally {
        setLoading(false);
      }
    };

    fetchAssigned();
  }, [selectedRoleId]);

  const togglePermission = async (permId) => {
    const isChecked = assignedPermissions.includes(permId);

    // Оптимистичное обновление
    setAssignedPermissions(prev =>
      isChecked ? prev.filter(id => id !== permId) : [...prev, permId]
    );

    try {
      if (!isChecked) {
        await api.post('/rolepermissions', {
          roleId: parseInt(selectedRoleId, 10),
          permissionId: permId,
        });
      } else {
        await api.delete('/rolepermissions', {
          data: { roleId: parseInt(selectedRoleId, 10), permissionId: permId },
        });
      }
    } catch (err) {
      console.error('Ошибка изменения права:', err);
      // Откат при ошибке
      setAssignedPermissions(prev =>
        isChecked ? [...prev, permId] : prev.filter(id => id !== permId)
      );
      setError('Ошибка при изменении права.');
    }
  };

  const selectedRoleName = roles.find(r => r.id === parseInt(selectedRoleId, 10))?.name;

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Управление правами ролей
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Выберите роль</InputLabel>
          <Select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            label="Выберите роль"
          >
            {roles.map(role => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}{role.description ? ` — ${role.description}` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {loading ? (
          <CircularProgress />
        ) : selectedRoleId ? (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Права для роли: {selectedRoleName}
            </Typography>
            <List dense>
              {permissions.map(perm => (
                <ListItem key={perm.id} disablePadding>
                  <Checkbox
                    checked={assignedPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    size="small"
                  />
                  <ListItemText
                    primary={perm.name}
                    secondary={perm.description || 'Нет описания'}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        ) : (
          <Typography color="text.secondary">Выберите роль для управления правами.</Typography>
        )}
      </Paper>
    </Container>
  );
};

export default RolePermissionsManager;
