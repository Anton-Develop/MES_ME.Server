import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, Checkbox, Button, Box } from '@mui/material';
import api from '../api';

const PermissionsTab = ({ roleId }) => {
    const [allPermissions, setAllPermissions] = useState([]);
    const [assignedPermissions, setAssignedPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const [allRes, assignedRes] = await Promise.all([
                    api.get('/permissions'), // GET /api/permissions (новый эндпоинт)
                    api.get(`/rolepermissions/role/${roleId}`)
                ]);
                setAllPermissions(allRes.data);
                setAssignedPermissions(assignedRes.data.map(p => p.id));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (roleId) {
            fetchPermissions();
        }
    }, [roleId]);

    const togglePermission = async (permId) => {
        const isChecked = assignedPermissions.includes(permId);
        const action = isChecked ? 'remove' : 'add';

        try {
            if (action === 'add') {
                await api.post('/rolepermissions', { roleId, permissionId: permId });
            } else {
                await api.delete('/rolepermissions', { data: { roleId, permissionId: permId } });
            }

            setAssignedPermissions(prev =>
                isChecked ? prev.filter(id => id !== permId) : [...prev, permId]
            );
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <Typography>Загрузка...</Typography>;

    return (
        <Card>
            <CardContent>
                <Typography variant="h6">Управление правами</Typography>
                <List>
                    {allPermissions.map(perm => (
                        <ListItem key={perm.id} dense>
                            <Checkbox
                                checked={assignedPermissions.includes(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                            />
                            <ListItemText
                                primary={perm.Name}
                                secondary={perm.Description}
                            />
                        </ListItem>
                    ))}
                </List>
            </CardContent>
        </Card>
    );
};

export default PermissionsTab;