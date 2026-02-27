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
  Button,
  Box,
  CircularProgress
} from '@mui/material';
import api from '../api';

const RolePermissionsManager = () => {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [assignedPermissions, setAssignedPermissions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Загружаем роли и права один раз
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [rolesRes, permsRes] = await Promise.all([
                    api.get('/roles'),
                    api.get('/permissions')
                ]);
                setRoles(rolesRes.data);
                setPermissions(permsRes.data);
            } catch (err) {
                console.error('Ошибка загрузки данных:', err);
            }
        };

        fetchData();
    }, []);

    // Загружаем права для выбранной роли
    useEffect(() => {
        if (!selectedRoleId) {
            setAssignedPermissions([]);
            return;
        }

        const fetchAssigned = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/rolepermissions/role/${selectedRoleId}`);
                setAssignedPermissions(res.data.map(p => p.id));
            } catch (err) {
                console.error('Ошибка загрузки прав роли:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAssigned();
    }, [selectedRoleId]);

    const togglePermission = async (permId) => {
        const isChecked = assignedPermissions.includes(permId);
        const action = isChecked ? 'remove' : 'assign';

        try {
            if (action === 'assign') {
                await api.post('/rolepermissions', { roleId: parseInt(selectedRoleId), permissionId: permId });
            } else {
                await api.delete('/rolepermissions', {
                    data: { roleId: parseInt(selectedRoleId), permissionId: permId }
                });
            }

            // Обновляем локальный список
            setAssignedPermissions(prev =>
                isChecked
                    ? prev.filter(id => id !== permId)
                    : [...prev, permId]
            );
        } catch (err) {
            console.error('Ошибка изменения права:', err);
            alert('Ошибка при изменении права.');
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>
                    Управление правами ролей
                </Typography>

                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Выберите роль</InputLabel>
                    <Select
                        value={selectedRoleId}
                        onChange={(e) => setSelectedRoleId(e.target.value)}
                        label="Выберите роль"
                    >
                        {roles.map(role => (
                            <MenuItem key={role.id} value={role.id}>
                                {role.name} — {role.description || "Без описания"}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {loading ? (
                    <CircularProgress />
                ) : (
                    selectedRoleId && (
                        <Box>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Права для роли: {roles.find(r => r.id === parseInt(selectedRoleId))?.name}
                            </Typography>
                            <List>
                                {permissions.map(perm => (
                                    <ListItem key={perm.id} dense>
                                        <Checkbox
                                            checked={assignedPermissions.includes(perm.id)}
                                            onChange={() => togglePermission(perm.id)}
                                        />
                                        <ListItemText
                                            primary={perm.name}
                                            secondary={perm.description || "Нет описания"}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )
                )}
            </Paper>
        </Container>
    );
};

export default RolePermissionsManager;