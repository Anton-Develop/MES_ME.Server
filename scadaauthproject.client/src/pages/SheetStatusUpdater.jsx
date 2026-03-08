// src/pages/SheetStatusUpdater.jsx
import React, { useState } from 'react';
import {
  Container, Paper, Typography, TextField, FormControl, InputLabel,
  Select, MenuItem, Button, Box, Alert, CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
import api from '../api';

// Вынесено за пределы компонента — не пересоздаётся при каждом рендере
const POSSIBLE_STATUSES = [
  'Подготовлен к прокату', 'Прошел закалку', 'Добавлен в кассету',
  'Прошел отпуск', 'Недокат', 'Чистый выброс',
];

const SheetStatusUpdater = () => {
  const [matId, setMatId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdateStatus = async () => {
    if (!matId.trim() || !newStatus) {
      setError('Необходимо указать MatId и выбрать статус.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.put(`/import/update-sheet-status/${matId.trim()}`, { newStatus });
      setSuccess(`Статус листа ${matId} успешно изменён на «${newStatus}».`);
      // ИСПРАВЛЕНО: сбрасываем поля после успеха — иначе повторная отправка
      // той же формы без изменений выглядит как баг
      setMatId('');
      setNewStatus('');
    } catch (err) {
      console.error('Ошибка изменения статуса:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при изменении статуса.');
    } finally {
      setLoading(false);
    }
  };

  // ИСПРАВЛЕНО: Enter в поле matId теперь запускает обновление
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleUpdateStatus();
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
            onChange={e => { setMatId(e.target.value); setError(''); setSuccess(''); }}
            onKeyDown={handleKeyDown}
            size="small"
            fullWidth
            autoFocus
            InputProps={{
              endAdornment: matId ? (
                <InputAdornment position="end">
                  <IconButton onClick={() => { setMatId(''); setError(''); setSuccess(''); }} size="small">
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
              value={newStatus}
              label="Новый статус"
              onChange={e => { setNewStatus(e.target.value); setError(''); setSuccess(''); }}
            >
              {POSSIBLE_STATUSES.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={handleUpdateStatus}
            disabled={loading || !matId.trim() || !newStatus}
            fullWidth
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Обновить статус'}
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      </Paper>
    </Container>
  );
};

export default SheetStatusUpdater;
