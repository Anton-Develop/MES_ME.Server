import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
import api from '../api';

const SheetStatusUpdater = () => {
  const [matId, setMatId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const possibleStatuses = [
    'Подготовлен к прокату',
    'Прошел закалку',
    'Добавлен в кассету',
    'Прошел отпуск',
    'Недокат',
    'Чистый выброс',
  ];

  const handleUpdateStatus = async () => {
    if (!matId || !newStatus) {
      setError('Необходимо указать MatId и выбрать статус.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.put(`/import/update-sheet-status/${matId}`, { newStatus });
      setSuccess(`Статус листа ${matId} успешно изменён на '${newStatus}'.`);
      // Опционально: очистить поля
      // setMatId('');
      // setNewStatus('');
    } catch (err) {
      console.error('Ошибка изменения статуса:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при изменении статуса.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom align="center">
          Изменение статуса листа
        </Typography>

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="MatId листа"
            value={matId}
            onChange={(e) => setMatId(e.target.value)}
            size="small"
            fullWidth
            InputProps={{
              endAdornment: matId ? (
                <InputAdornment position="end">
                  <IconButton onClick={() => setMatId('')} size="small">
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="status-select-label">Новый статус</InputLabel>
            <Select
              labelId="status-select-label"
              id="status-select"
              value={newStatus}
              label="Новый статус"
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {possibleStatuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={handleUpdateStatus}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Обновить статус'}
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      </Paper>
    </Container>
  );
};

export default SheetStatusUpdater;