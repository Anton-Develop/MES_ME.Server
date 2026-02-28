import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  History as HistoryIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../api'; // Используем наш настроенный axios instance

const CassetteManagementPage = () => {
  const [cassettes, setCassettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newCassetteNotes, setNewCassetteNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Состояния для изменения статуса
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [selectedCassetteForStatus, setSelectedCassetteForStatus] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Состояния для истории статусов
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [selectedCassetteForHistory, setSelectedCassetteForHistory] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Возможные статусы (в реальном приложении можно загружать с сервера)
  const possibleStatuses = [
    'Создана',
    'Формируется',
    'Готова к отправке',
    'Отправлена в печь',
    'Извлечена аварийно',
    'Отпуск завершён',
    'Завершена',
    'Отменена',
  ];

  // Загрузка списка кассет
  const fetchCassettes = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/cassette'); // Предполагаем, что у нас будет эндпоинт GET /api/cassette
      // Если эндпоинта нет, используем /api/cassette/status-history для получения списка кассет через лог
      // или добавим его в контроллер. Пока используем /cassette, если он есть.
      // Если эндпоинт возвращает только историю, нужно будет модифицировать логику.
      // Для простоты, предположим, что есть эндпоинт GET /api/cassette, возвращающий список кассет.
      setCassettes(response.data);
    } catch (err) {
      console.error('Ошибка загрузки кассет:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке кассет.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCassettes();
  }, []);

  // Обработчик создания новой кассеты
  const handleCreateCassette = async () => {
    setIsCreating(true);
    setError('');
    try {
      await api.post('/cassette', {
        notes: newCassetteNotes,
      });
      setNewCassetteNotes(''); // Очистить поле после создания
      fetchCassettes(); // Обновить список
      alert('Кассета создана успешно.');
    } catch (err) {
      console.error('Ошибка создания кассеты:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при создании кассеты.');
    } finally {
      setIsCreating(false);
    }
  };

  // Обработчик открытия диалога изменения статуса
  const handleOpenStatusDialog = (cassette) => {
    setSelectedCassetteForStatus(cassette);
    setNewStatus(cassette.status); // Установить текущий статус по умолчанию
    setStatusComment(''); // Очистить комментарий
    setOpenStatusDialog(true);
  };

  // Обработчик закрытия диалога изменения статуса
  const handleCloseStatusDialog = () => {
    setOpenStatusDialog(false);
    setSelectedCassetteForStatus(null);
    setNewStatus('');
    setStatusComment('');
    setIsUpdatingStatus(false);
  };

  // Обработчик сохранения нового статуса
  const handleSaveStatus = async () => {
    if (!selectedCassetteForStatus || !newStatus) return;

    setIsUpdatingStatus(true);
    setError('');
    try {
      await api.put(`/cassette/${selectedCassetteForStatus.cassetteId}/status`, {
        newStatus: newStatus,
        comment: statusComment,
        // notes: notes // Если нужно обновлять заметки одновременно
      });
      handleCloseStatusDialog();
      fetchCassettes(); // Обновить список кассет
      alert(`Статус кассеты ${selectedCassetteForStatus.cassetteId} изменён на "${newStatus}".`);
    } catch (err) {
      console.error('Ошибка изменения статуса:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при изменении статуса.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Обработчик открытия диалога истории статусов
  const handleOpenHistoryDialog = async (cassetteId) => {
    setSelectedCassetteForHistory(cassetteId);
    setHistoryLoading(true);
    setOpenHistoryDialog(true);

    try {
      const response = await api.get(`/cassette/${cassetteId}/status-history`);
      setHistory(response.data);
    } catch (err) {
      console.error('Ошибка загрузки истории статусов:', err);
      setHistory([]); // Очистить историю в случае ошибки
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке истории статусов.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Обработчик закрытия диалога истории статусов
  const handleCloseHistoryDialog = () => {
    setOpenHistoryDialog(false);
    setSelectedCassetteForHistory(null);
    setHistory([]);
  };

  // Функция для получения цвета чипа статуса
  const getStatusColor = (status) => {
    switch (status) {
      case 'Создана':
        return 'default';
      case 'Формируется':
        return 'info';
      case 'Готова к отправке':
        return 'warning';
      case 'Отправлена в печь':
        return 'secondary';
      case 'Извлечена аварийно':
        return 'error';
      case 'Отпуск завершён':
        return 'success';
      case 'Завершена':
        return 'success';
      case 'Отменена':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" gutterBottom>
            Управление кассетами
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateCassette}
            disabled={isCreating}
          >
            {isCreating ? 'Создание...' : 'Создать кассету'}
          </Button>
        </Box>

        {/* Форма создания новой кассеты (опционально, можно в диалог) */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Создать новую кассету
          </Typography>
          <Box display="flex" alignItems="flex-end" gap={2}>
            <TextField
              fullWidth
              label="Заметки (необязательно)"
              value={newCassetteNotes}
              onChange={(e) => setNewCassetteNotes(e.target.value)}
              size="small"
              multiline
              rows={2}
            />
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreateCassette}
              disabled={isCreating}
              sx={{ alignSelf: 'flex-end', mb: 1 }}
            >
              {isCreating ? <CircularProgress size={20} /> : 'Создать'}
            </Button>
          </Box>
        </Box>

        {/* Таблица кассет */}
        {error && <Alert severity="error">{error}</Alert>}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>ID Кассеты</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Дата создания</TableCell>
                  <TableCell>Создал</TableCell>
                  <TableCell>Заметки</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cassettes.map((cassette) => (
                  <TableRow key={cassette.cassetteId}>
                    <TableCell component="th" scope="row">
                      {cassette.cassetteId}
                    </TableCell>
                    <TableCell>
                      <Chip label={cassette.status} color={getStatusColor(cassette.status)} size="small" />
                    </TableCell>
                    <TableCell>
                      {cassette.createdAt ? new Date(cassette.createdAt).toLocaleString('ru-RU') : 'N/A'}
                    </TableCell>
                    <TableCell>{cassette.createdBy || 'N/A'}</TableCell>
                    <TableCell>{cassette.notes || 'Нет'}</TableCell>
                    <TableCell>
                      <Tooltip title="Изменить статус">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenStatusDialog(cassette)}
                          color="primary"
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="История статусов">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenHistoryDialog(cassette.cassetteId)}
                          color="secondary"
                        >
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Диалог изменения статуса */}
      <Dialog open={openStatusDialog} onClose={handleCloseStatusDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Изменить статус кассеты {selectedCassetteForHistory?.cassetteId}
        </DialogTitle>
        <DialogContent dividers>
          {selectedCassetteForStatus && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Текущий статус: <strong>{selectedCassetteForStatus.status}</strong>
              </Typography>
              <FormControl fullWidth margin="dense">
                <InputLabel id="status-select-label">Новый статус</InputLabel>
                <Select
                  labelId="status-select-label"
                  id="status-select"
                  value={newStatus}
                  label="Новый статус"
                  onChange={(e) => setNewStatus(e.target.value)}
                  size="small"
                >
                  {possibleStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Комментарий (необязательно)"
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
                margin="dense"
                multiline
                rows={2}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStatusDialog} startIcon={<CloseIcon />}>
            Отмена
          </Button>
          <Button
            onClick={handleSaveStatus}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isUpdatingStatus || !newStatus}
            autoFocus
          >
            {isUpdatingStatus ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог истории статусов */}
      <Dialog open={openHistoryDialog} onClose={handleCloseHistoryDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          История статусов кассеты {selectedCassetteForHistory}
        </DialogTitle>
        <DialogContent dividers>
          {historyLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100px">
              <CircularProgress size={24} />
            </Box>
          ) : history.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Время изменения</TableCell>
                  <TableCell>Старый статус</TableCell>
                  <TableCell>Новый статус</TableCell>
                  <TableCell>Изменил</TableCell>
                  <TableCell>Комментарий</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((logEntry, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {logEntry.changeTimestamp ? new Date(logEntry.changeTimestamp).toLocaleString('ru-RU') : 'N/A'}
                    </TableCell>
                    <TableCell>{logEntry.oldStatus || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={logEntry.newStatus} color={getStatusColor(logEntry.newStatus)} size="small" />
                    </TableCell>
                    <TableCell>{logEntry.changedBy}</TableCell>
                    <TableCell>{logEntry.comment || 'Нет'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center">
              История статусов отсутствует.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHistoryDialog} startIcon={<CloseIcon />}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CassetteManagementPage;