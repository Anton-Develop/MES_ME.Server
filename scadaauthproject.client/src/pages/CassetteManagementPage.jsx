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
  Tabs,
  Tab,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Grid, // Добавим Grid для фильтров
  Pagination, // Добавим компонент пагинации
  InputAdornment, // Для кнопки очистки
  IconButton as MuiIconButton, // Переименуем, чтобы не путать с нашим IconButton
} from '@mui/material';
import {
  Add as AddIcon,
  History as HistoryIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon, // Иконка для очистки
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api';

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

  // Состояния для управления листами
  const [availableSheets, setAvailableSheets] = useState({ data: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectedCassetteForSheets, setSelectedCassetteForSheets] = useState(null);
  const [linkedSheets, setLinkedSheets] = useState([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [openSheetsDialog, setOpenSheetsDialog] = useState(false);

  // Состояния для фильтров доступных листов
  const [availableSheetsFilters, setAvailableSheetsFilters] = useState({
    matIdFilter: '',
    meltNumberFilter: '',
    batchNumberFilter: '',
    packNumberFilter: '',
    steelGradeFilter: '',
    sheetDimensionsFilter: '',
    sheetNumberFilter: '',
  });

  // Возможные статусы
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
      const response = await api.get('/cassette');
      setCassettes(response.data);
    } catch (err) {
      console.error('Ошибка загрузки кассет:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке кассет.');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка доступных листов с фильтрацией и пагинацией
  const fetchAvailableSheets = async (page = 1) => {
    setLoadingAvailable(true);
    setError('');
    try {
      const params = {
        page,
        pageSize: availableSheets.pageSize,
        ...availableSheetsFilters, // Передаём фильтры
      };
      // Убираем пустые фильтры из параметров
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);

      const response = await api.get('/cassette/available-sheets', { params });
      setAvailableSheets(response.data);
    } catch (err) {
      console.error('Ошибка загрузки доступных листов:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке доступных листов.');
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Загрузка листов для конкретной кассеты
  const fetchLinkedSheets = async (cassetteId) => {
    if (!cassetteId) return;
    setLoadingLinked(true);
    setError('');
    try {
      const response = await api.get(`/cassette/${cassetteId}/sheets`);
      setLinkedSheets(response.data);
    } catch (err) {
      console.error('Ошибка загрузки листов кассеты:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке листов кассеты.');
      setLinkedSheets([]);
    } finally {
      setLoadingLinked(false);
    }
  };

  // Обработчик изменения фильтра
  const handleFilterChange = (field, value) => {
    setAvailableSheetsFilters(prev => ({ ...prev, [field]: value }));
  };

  // Обработчик сброса фильтров
  const handleClearFilters = () => {
    setAvailableSheetsFilters({
      matIdFilter: '',
      meltNumberFilter: '',
      batchNumberFilter: '',
      packNumberFilter: '',
      steelGradeFilter: '',
      sheetDimensionsFilter: '',
      sheetNumberFilter: '',
    });
    // После сброса фильтров, сбрасываем страницу и загружаем данные
    setAvailableSheets(prev => ({ ...prev, page: 1 }));
    fetchAvailableSheets(1);
  };

  // Обработчик изменения страницы
  const handlePageChange = (event, newPage) => {
    fetchAvailableSheets(newPage);
  };

  // Обработчик создания новой кассеты
  const handleCreateCassette = async () => {
    setIsCreating(true);
    setError('');
    try {
      await api.post('/cassette', {
        notes: newCassetteNotes,
      });
      setNewCassetteNotes('');
      fetchCassettes();
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
    setNewStatus(cassette.status);
    setStatusComment('');
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
      });
      handleCloseStatusDialog();
      fetchCassettes();
      if (selectedCassetteForSheets && selectedCassetteForSheets.cassetteId === selectedCassetteForStatus.cassetteId) {
          fetchLinkedSheets(selectedCassetteForSheets.cassetteId);
      }
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
      setHistory([]);
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

  // Обработчик открытия диалога листов кассеты
  const handleOpenSheetsDialog = async (cassette) => {
    setSelectedCassetteForSheets(cassette);
    setOpenSheetsDialog(true);
    await fetchLinkedSheets(cassette.cassetteId);
    await fetchAvailableSheets(availableSheets.page); // Загрузим доступные листы для текущей страницы и фильтров
  };

  // Обработчик закрытия диалога листов кассеты
  const handleCloseSheetsDialog = () => {
    setOpenSheetsDialog(false);
    setSelectedCassetteForSheets(null);
    setLinkedSheets([]);
    setAvailableSheets({ data: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 1 });
    // Сбросим фильтры при закрытии диалога, если нужно
    // handleClearFilters(); // Раскомментируйте, если хотите сбрасывать при закрытии
  };

  // Обработчик Drag-and-Drop
  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId) {
        return;
    }

    const destDroppableId = destination.droppableId;
    const sourceDroppableId = source.droppableId;
    const matId = draggableId;

    if (destDroppableId === 'linked-sheets-list' && sourceDroppableId === 'available-sheets-list') {
        await handleAddSheetToCassette(matId);
    } else if (destDroppableId === 'available-sheets-list' && sourceDroppableId === 'linked-sheets-list') {
        await handleRemoveSheetFromCassette(matId);
    }
  };

  // Обработчик добавления листа в кассету через DnD
  const handleAddSheetToCassette = async (matId) => {
    if (!selectedCassetteForSheets) return;

    setError('');
    try {
      await api.post(`/cassette/${selectedCassetteForSheets.cassetteId}/add-sheet`, { matId });
      await fetchLinkedSheets(selectedCassetteForSheets.cassetteId);
      // Перезагружаем доступные листы, так как один из них ушёл в кассету
      await fetchAvailableSheets(availableSheets.page);
      alert(`Лист ${matId} добавлен в кассету ${selectedCassetteForSheets.cassetteId}.`);
    } catch (err) {
      console.error('Ошибка добавления листа в кассету:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при добавлении листа в кассету.');
    }
  };

  // Обработчик удаления листа из кассеты через DnD
  const handleRemoveSheetFromCassette = async (matId) => {
    if (!selectedCassetteForSheets) return;

    setError('');
    try {
      await api.delete(`/cassette/${selectedCassetteForSheets.cassetteId}/remove-sheet/${matId}`);
      await fetchLinkedSheets(selectedCassetteForSheets.cassetteId);
      // Перезагружаем доступные листы, так как один из них вернулся из кассеты
      await fetchAvailableSheets(availableSheets.page);
      alert(`Лист ${matId} удалён из кассеты ${selectedCassetteForSheets.cassetteId}.`);
    } catch (err) {
      console.error('Ошибка удаления листа из кассеты:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при удалении листа из кассеты.');
    }
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

  // Загрузка кассет при монтировании
  useEffect(() => {
    fetchCassettes();
  }, []);

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
                      <Tooltip title="Управление листами">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenSheetsDialog(cassette)}
                          color="success"
                        >
                          <AddIcon fontSize="small" />
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

      <Dialog open={openStatusDialog} onClose={handleCloseStatusDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Изменить статус кассеты {selectedCassetteForStatus?.cassetteId}
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

      <Dialog open={openSheetsDialog} onClose={handleCloseSheetsDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          Управление листами кассеты {selectedCassetteForSheets?.cassetteId}
        </DialogTitle>
        <DialogContent dividers>
          <DragDropContext onDragEnd={onDragEnd}>
            <Box display="flex" flexDirection="column" gap={2} minHeight="400px">
              {/* Фильтры для доступных листов */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Фильтры доступных листов
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        label="ID"
                        value={availableSheetsFilters.matIdFilter}
                        onChange={(e) => handleFilterChange('matIdFilter', e.target.value)}
                        size="small"
                        InputProps={{
                          endAdornment: availableSheetsFilters.matIdFilter ? (
                            <InputAdornment position="end">
                              <MuiIconButton onClick={() => handleFilterChange('matIdFilter', '')} size="small">
                                <ClearIcon />
                              </MuiIconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        label="Плавка"
                        value={availableSheetsFilters.meltNumberFilter}
                        onChange={(e) => handleFilterChange('meltNumberFilter', e.target.value)}
                        size="small"
                        InputProps={{
                          endAdornment: availableSheetsFilters.meltNumberFilter ? (
                            <InputAdornment position="end">
                              <MuiIconButton onClick={() => handleFilterChange('meltNumberFilter', '')} size="small">
                                <ClearIcon />
                              </MuiIconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        label="Партия"
                        value={availableSheetsFilters.batchNumberFilter}
                        onChange={(e) => handleFilterChange('batchNumberFilter', e.target.value)}
                        size="small"
                        InputProps={{
                          endAdornment: availableSheetsFilters.batchNumberFilter ? (
                            <InputAdornment position="end">
                              <MuiIconButton onClick={() => handleFilterChange('batchNumberFilter', '')} size="small">
                                <ClearIcon />
                              </MuiIconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        label="Пачка"
                        value={availableSheetsFilters.packNumberFilter}
                        onChange={(e) => handleFilterChange('packNumberFilter', e.target.value)}
                        size="small"
                        InputProps={{
                          endAdornment: availableSheetsFilters.packNumberFilter ? (
                            <InputAdornment position="end">
                              <MuiIconButton onClick={() => handleFilterChange('packNumberFilter', '')} size="small">
                                <ClearIcon />
                              </MuiIconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        label="Марка стали"
                        value={availableSheetsFilters.steelGradeFilter}
                        onChange={(e) => handleFilterChange('steelGradeFilter', e.target.value)}
                        size="small"
                        InputProps={{
                          endAdornment: availableSheetsFilters.steelGradeFilter ? (
                            <InputAdornment position="end">
                              <MuiIconButton onClick={() => handleFilterChange('steelGradeFilter', '')} size="small">
                                <ClearIcon />
                              </MuiIconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        label="Размер листа"
                        value={availableSheetsFilters.sheetDimensionsFilter}
                        onChange={(e) => handleFilterChange('sheetDimensionsFilter', e.target.value)}
                        size="small"
                        InputProps={{
                          endAdornment: availableSheetsFilters.sheetDimensionsFilter ? (
                            <InputAdornment position="end">
                              <MuiIconButton onClick={() => handleFilterChange('sheetDimensionsFilter', '')} size="small">
                                <ClearIcon />
                              </MuiIconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        label="№ Листа"
                        value={availableSheetsFilters.sheetNumberFilter}
                        onChange={(e) => handleFilterChange('sheetNumberFilter', e.target.value)}
                        size="small"
                        InputProps={{
                          endAdornment: availableSheetsFilters.sheetNumberFilter ? (
                            <InputAdornment position="end">
                              <MuiIconButton onClick={() => handleFilterChange('sheetNumberFilter', '')} size="small">
                                <ClearIcon />
                              </MuiIconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={handleClearFilters}
                        fullWidth
                      >
                        Сбросить
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <Button
                        variant="contained"
                        onClick={() => fetchAvailableSheets(availableSheets.page)} // Применить фильтры к текущей странице
                        fullWidth
                      >
                        Применить
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Основной контент с двумя списками */}
              <Box display="flex" gap={2} flex={1}>
                <Card sx={{ flex: 1, minWidth: 300 }}>
                  <CardHeader
  title={`Доступные листы (${availableSheets.totalCount})`} // <-- Обратные апострофы
  subheader={`Стр. ${availableSheets.page} из ${availableSheets.totalPages}`}
  sx={{ pb: 0 }}
/>
                  <CardContent sx={{ p: 1, height: '100%' }}>
                    {loadingAvailable ? (
                      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <Droppable droppableId="available-sheets-list">
                        {(provided) => (
                          <List
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            dense
                            sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper' }}
                          >
                            {availableSheets.data.map((sheet, index) => (
                              <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                {(provided) => (
                                  <ListItem
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    secondaryAction={
                                      <Tooltip title="Добавить в кассету">
                                        <IconButton edge="end" aria-label="add" size="small" onClick={() => handleAddSheetToCassette(sheet.matId)}>
                                          <AddIcon />
                                        </IconButton>
                                      </Tooltip>
                                    }
                                  >
                                    <ListItemText
                                      primary={
                                        <Typography variant="body2">
                                          <strong>ID:</strong> {sheet.matId} <br />
                                          <strong>Плавка:</strong> {sheet.meltNumber} <br />
                                          <strong>Партия:</strong> {sheet.batchNumber} <br />
                                          <strong>Пачка:</strong> {sheet.packNumber} <br />
                                          <strong>Марка стали:</strong> {sheet.steelGrade} <br />
                                          <strong>Размер листа:</strong> {sheet.sheetDimensions} <br />
                                          <strong>№ Листа:</strong> {sheet.sheetNumber}
                                        </Typography>
                                      }
                                    />
                                  </ListItem>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </List>
                        )}
                      </Droppable>
                    )}
                  </CardContent>
                </Card>

                <Card sx={{ flex: 1, minWidth: 300 }}>
                  <CardHeader
                    title={`Листы в кассете (${linkedSheets.length})`}
                    subheader={`Кассета: ${selectedCassetteForSheets?.cassetteId}`}
                    sx={{ pb: 0 }}
                  />
                  <CardContent sx={{ p: 1, height: '100%' }}>
                    {loadingLinked ? (
                      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <Droppable droppableId="linked-sheets-list">
                        {(provided) => (
                          <List
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            dense
                            sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper' }}
                          >
                            {linkedSheets.map((sheet, index) => (
                              <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                {(provided) => (
                                  <ListItem
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    secondaryAction={
                                      <Tooltip title="Удалить из кассеты">
                                        <IconButton edge="end" aria-label="delete" size="small" onClick={() => handleRemoveSheetFromCassette(sheet.matId)}>
                                          <DeleteIcon />
                                        </IconButton>
                                      </Tooltip>
                                    }
                                  >
                                    <ListItemText
                                      primary={
                                        <Typography variant="body2">
                                          <strong>ID:</strong> {sheet.matId} <br />
                                          <strong>Плавка:</strong> {sheet.meltNumber} <br />
                                          <strong>Партия:</strong> {sheet.batchNumber} <br />
                                          <strong>Пачка:</strong> {sheet.packNumber} <br />
                                          <strong>Марка стали:</strong> {sheet.steelGrade} <br />
                                          <strong>Размер листа:</strong> {sheet.sheetDimensions} <br />
                                          <strong>№ Листа:</strong> {sheet.sheetNumber}
                                        </Typography>
                                      }
                                    />
                                  </ListItem>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </List>
                        )}
                      </Droppable>
                    )}
                  </CardContent>
                </Card>
              </Box>

              {/* Пагинация для доступных листов */}
              {availableSheets.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={2}>
                  <Pagination
                    count={availableSheets.totalPages}
                    page={availableSheets.page}
                    onChange={handlePageChange}
                    color="primary"
                    size="small"
                  />
                </Box>
              )}
            </Box>
          </DragDropContext>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSheetsDialog} startIcon={<CloseIcon />}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CassetteManagementPage;