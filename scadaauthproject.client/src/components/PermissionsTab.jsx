// src/components/PermissionsTab.jsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  CircularProgress,
  Alert,
} from '@mui/material';
import api from '../api';

const PermissionsTab = ({ roleId }) => {
  const [allPermissions, setAllPermissions] = useState([]);
  const [assignedPermissions, setAssignedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  // ИСПРАВЛЕНО: добавлена обработка ошибок с отображением в UI
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roleId) return;

    const fetchPermissions = async () => {
      setLoading(true);
      setError('');
      try {
        const [allRes, assignedRes] = await Promise.all([
          api.get('/permissions'),
          api.get(`/rolepermissions/role/${roleId}`),
        ]);
        setAllPermissions(allRes.data);
        setAssignedPermissions(assignedRes.data.map(p => p.id));
      } catch (err) {
        console.error('Ошибка загрузки прав:', err);
        setError('Не удалось загрузить права. Попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [roleId]);

  const togglePermission = async (permId) => {
    const isChecked = assignedPermissions.includes(permId);

    // Оптимистичное обновление
    setAssignedPermissions(prev =>
      isChecked ? prev.filter(id => id !== permId) : [...prev, permId]
    );

    try {
      if (!isChecked) {
        await api.post('/rolepermissions', { roleId, permissionId: permId });
      } else {
        await api.delete('/rolepermissions', { data: { roleId, permissionId: permId } });
      }
    } catch (err) {
      console.error('Ошибка изменения права:', err);
      // ИСПРАВЛЕНО: откатываем оптимистичное обновление при ошибке
      setAssignedPermissions(prev =>
        isChecked ? [...prev, permId] : prev.filter(id => id !== permId)
      );
      setError('Ошибка при изменении права.');
    }
  };

  if (loading) return <CircularProgress sx={{ m: 2 }} />;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Управление правами</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <List dense>
          {allPermissions.map(perm => (
            <ListItem key={perm.id} disablePadding>
              <Checkbox
                checked={assignedPermissions.includes(perm.id)}
                onChange={() => togglePermission(perm.id)}
                size="small"
              />
              <ListItemText
                // ИСПРАВЛЕНО: унифицировано обращение к полям — использован perm.name вместо perm.Name
                // (в RolePermissionsManager используется perm.name — привели к единому виду)
                primary={perm.name ?? perm.Name}
                secondary={perm.description ?? perm.Description}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default PermissionsTab;
