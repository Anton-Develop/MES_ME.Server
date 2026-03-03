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
  DialogContentText,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  InputAdornment,
  Autocomplete, // Для поиска листа по MatId
  Pagination, // Для пагинации
  Grid, // Для фильтров
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import api from '../api';

const AnnealingSchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Состояния для ф  
  const [filters, setFilters] = useState({
    statusFilter: '',
    matIdFilter: '',
    furnaceNumberFilter: '',
  });

  // Состояния для создания новой записи
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newScheduleData, setNewScheduleData] = useState({
    matId: '',
    sequenceNumber: null,
    furnaceNumber: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [availableSheetsForAutocomplete, setAvailableSheetsForAutocomplete] = useState([]); // Для Autocomplete
  const [loadingSheetsForAutocomplete, setLoadingSheetsForAutocomplete] = useState(false);

  // Состояния для обновления статуса
  const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
  const [scheduleToUpdate, setScheduleToUpdate] = useState(null);
  const [updateStatusData, setUpdateStatusData] = useState({
    status: '',
    comment: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Состояния для удаления
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Возможные статусы выполнения
  const possibleExecutionStatuses = [
    'Запланировано',
    'Ожидает',
    'В работе',
    'Завершено',
    'Прервано аварией',
    'Отменено',
  ];

  // Возможные типы печей
  const possibleFurnaceTypes = ['Закалочная'];

  // Загрузка списка плана закалки
  const fetchSchedules = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        pageSize,
        statusFilter: filters.statusFilter,
        matIdFilter: filters.matIdFilter,
        furnaceNumberFilter: filters.furnaceNumberFilter,
      };

      // Убираем пустые фильтры из параметров
      Object.keys(params).forEach(key => (params[key] === '' || params[key] === null) && delete params[key]);

      const response = await api.get('/annealingschedule', { params });
      setSchedules(response.data.data);
      setTotalCount(response.data.totalCount);
    } catch (err) {
      console.error('Ошибка загрузки плана закалки:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке плана закалки.');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка всех листов для Autocomplete при открытии диалога создания или изменении ввода
  const fetchAllSheetsForAutocomplete = async (inputValue = '') => {
    setLoadingSheetsForAutocomplete(true);
    try {
      // Используем эндпоинт для получения всех листов из inputdata
      // Фильтрация по вводу будет происходить на клиенте
      // Можноинацию на сервере, если данных очень много
      const response = await api.get('/inputdata', { params: { page: 1, pageSize: 1000 } }); // Пример с большим pageSize
      // Фильтруем на клиенте по вводу, если inputValue есть
      const allSheets = response.data.data.map(s => ({ label: s.matId, value: s.matId }));
      if (inputValue) {
        setAvailableSheetsForAutocomplete(allSheets.filter(s => s.label.toLowerCase().includes(inputValue.toLowerCase())));
      } else {
        setAvailableSheetsForAutocomplete(allSheets);
      }
    } catch (err) {
      console.error('Ошибка загрузки листов для Autocomplete:', err);
      setAvailableSheetsForAutocomplete([]);
      // Опционально: показать ошибку в Autocomplete
    } finally {
      setLoadingSheetsForAutocomplete(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [page, pageSize, filters]);

  // Обработчик изменения фильтра
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Сброс на первую страницу при изменении фильтра
  };

  // Обработчик сброса фильтров
  const handleClearFilters = () => {
    setFilters({
      statusFilter: '',
      matIdFilter: '',
      furnaceNumberFilter: '',
    });
    setPage(1);
  };

  // Обработчик изменения страницы
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  // Обработчик изменения размера страницы
  const handlePageSizeChange = (event) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(1); // Сброс на первую страницу при изменении размера
  };

  // --- Обработчики для создания новой записи ---

  const handleOpenCreateDialog = () => {
    setNewScheduleData({
      matId: '',
      sequenceNumber: null,
      furnaceNumber: '',
      scheduledStartTime: '',
      scheduledEndTime: '',
      notes: '',
    });
    setOpenCreateDialog(true);
    fetchAllSheetsForAutocomplete(); // Загрузим все листы для Autocomplete
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
    setIsCreating(false);
    setError(''); // Очистим ошибку при закрытии
  };

  const handleNewScheduleDataChange = (field, value) => {
    setNewScheduleData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateSchedule = async () => {
    if (!newScheduleData.matId) {
        setError('Необходимо выбрать лист (MatId).');
        return;
    }

    setIsCreating(true);
    setError('');
    try {
      await api.post('/annealingschedule', newScheduleData);
      handleCloseCreateDialog();
      fetchSchedules(); // Обновить список
      alert('Запись плана закалки создана успешно.');
    } catch (err) {
      console.error('Ошибка создания записи плана закалки:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при создании записи плана закалки.');
    } finally {
      setIsCreating(false);
    }
  };

  // --- Обработчики для обновления статуса выполнения ---

  const handleOpenUpdateDialog = (schedule) => {
    setScheduleToUpdate(schedule);
    setUpdateStatusData({
      status: schedule.status,
      comment: schedule.executionComment || '',
    });
    setOpenUpdateDialog(true);
  };

  const handleCloseUpdateDialog = () => {
    setOpenUpdateDialog(false);
    setScheduleToUpdate(null);
    setUpdateStatusData({ status: '', comment: '' });
    setIsUpdating(false);
    setError(''); // Очистим ошибку при закрытии
  };

  const handleUpdateStatusDataChange = (field, value) => {
    setUpdateStatusData(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdateScheduleExecution = async () => {
    if (!scheduleToUpdate || !updateStatusData.status) return;

    setIsUpdating(true);
    setError('');
    try {
      await api.put(`/annealingschedule/${scheduleToUpdate.annealingPlanId}/execute`, updateStatusData);
      handleCloseUpdateDialog();
      fetchSchedules(); // Обновить список
      alert(`Статус выполнения для листа ${scheduleToUpdate.matId} обновлён.`);
    } catch (err) {
      console.error('Ошибка обновления статуса выполнения:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при обновлении статуса выполнения.');
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Обработчики для удаления записи ---

  const handleOpenDeleteDialog = (schedule) => {
    setScheduleToDelete(schedule);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setScheduleToDelete(null);
    setIsDeleting(false);
    setError(''); // Очистим ошибку при закрытии
  };

  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;

    setIsDeleting(true);
    setError('');
    try {
      await api.delete(`/annealingschedule/${scheduleToDelete.annealingPlanId}`);
      handleCloseDeleteDialog();
      fetchSchedules(); // Обновить список
      alert(`Запись плана закалки для листа ${scheduleToDelete.matId} удалена.`);
    } catch (err) {
      console.error('Ошибка удаления записи плана закалки:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при удалении записи плана закалки.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Функция для получения цвета чипа статуса
  const getStatusColor = (status) => {
    switch (status) {
      case 'Запланировано':
        return 'default';
      case 'Ожидает':
        return 'info';
      case 'В работе':
        return 'warning';
      case 'Завершено':
        return 'success';
      case 'Прервано аварией':
        return 'error';
      case 'Отменено':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" gutterBottom>
            План закалки листов
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
            // disabled={isCreating} // Не отключаем кнопку, если диалог открыт
          >
            Добавить в план
          </Button>
        </Box>

        {/* Фильтры */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Фильтры
          </Typography>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Статус"
                select
                value={filters.statusFilter}
                onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="">Все</MenuItem>
                {possibleExecutionStatuses.map((status) => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="ID Листа"
                value={filters.matIdFilter}
                onChange={(e) => handleFilterChange('matIdFilter', e.target.value)}
                size="small"
                fullWidth
                InputProps={{
                  endAdornment: filters.matIdFilter ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleFilterChange('matIdFilter', '')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Номер печи"
                value={filters.furnaceNumberFilter}
                onChange={(e) => handleFilterChange('furnaceNumberFilter', e.target.value)}
                size="small"
                fullWidth
                InputProps={{
                  endAdornment: filters.furnaceNumberFilter ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleFilterChange('furnaceNumberFilter', '')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                fullWidth
              >
                Сбросить
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Таблица плана */}
        {error && <Alert severity="error">{error}</Alert>}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer component={Paper}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>ID Плана</TableCell>
                    <TableCell>ID Листа</TableCell>
                    <TableCell>Порядок</TableCell>
                    <TableCell>Тип печи</TableCell>
                    <TableCell>Номер печи</TableCell>
                    <TableCell>Запл. начало</TableCell>
                    <TableCell>Запл. окончание</TableCell>
                    <TableCell>Факт. начало</TableCell>
                    <TableCell>Факт. окончание</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Комментарий</TableCell>
                    <TableCell>Выполнено кем</TableCell>
                    <TableCell>Выполнено когда</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.annealingPlanId}>
                      <TableCell>{schedule.annealingPlanId}</TableCell>
                      <TableCell>{schedule.matId}</TableCell>
                      <TableCell>{schedule.sequenceNumber || 'N/A'}</TableCell>
                      <TableCell>{schedule.furnaceType || 'N/A'}</TableCell>
                      <TableCell>{schedule.furnaceNumber || 'N/A'}</TableCell>
                      <TableCell>{schedule.scheduledStartTime ? new Date(schedule.scheduledStartTime).toLocaleString('ru-RU') : 'N/A'}</TableCell>
                      <TableCell>{schedule.scheduledEndTime ? new Date(schedule.scheduledEndTime).toLocaleString('ru-RU') : 'N/A'}</TableCell>
                      <TableCell>{schedule.actualStartTime ? new Date(schedule.actualStartTime).toLocaleString('ru-RU') : 'N/A'}</TableCell>
                      <TableCell>{schedule.actualEndTime ? new Date(schedule.actualEndTime).toLocaleString('ru-RU') : 'N/A'}</TableCell>
                      <TableCell>
                        <Chip label={schedule.status} color={getStatusColor(schedule.status)} size="small" />
                      </TableCell>
                      <TableCell>{schedule.executionComment || 'N/A'}</TableCell>
                      <TableCell>{schedule.executedBy || 'N/A'}</TableCell>
                      <TableCell>{schedule.executedAt ? new Date(schedule.executedAt).toLocaleString('ru-RU') : 'N/A'}</TableCell>
                      <TableCell>
                        <Tooltip title="Отметить выполнение">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenUpdateDialog(schedule)}
                            color="primary"
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить запись">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDeleteDialog(schedule)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Пагинация */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
              <Box>
                <TextField
                  select
                  label="На странице"
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  size="small"
                  sx={{ minWidth: 100 }}
                >
                  {[5, 10, 25, 50].map((size) => (
                    <MenuItem key={size} value={size}>{size}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box>
                <Pagination
                  count={Math.ceil(totalCount / pageSize)}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size="small"
                />
              </Box>
            </Box>
          </>
        )}
      </Paper>

      {/* Диалог создания новой записи */}
      <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Добавить лист в план закалки
        </DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2}>
            {/* Autocomplete для MatId */}
            <Autocomplete
              freeSolo // Позволяет вводить текст вручную
              options={availableSheetsForAutocomplete}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
              value={availableSheetsForAutocomplete.find(opt => opt.value === newScheduleData.matId) || { label: newScheduleData.matId, value: newScheduleData.matId }}
              onChange={(event, newValue) => {
                if (newValue && typeof newValue === 'object') {
                  handleNewScheduleDataChange('matId', newValue.value);
                } else if (typeof newValue === 'string') {
                  handleNewScheduleDataChange('matId', newValue); // Для freeSolo
                }
              }}
              onInputChange={(event, newInputValue) => {
                 // При изменении ввода, фильтруем доступные опции
                 fetchAllSheetsForAutocomplete(newInputValue);
              }}
              loading={loadingSheetsForAutocomplete}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="ID Листа (MatId)"
                  required
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <React.Fragment>
                        {loadingSheetsForAutocomplete ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </React.Fragment>
                    ),
                  }}
                />
              )}
            />

            <TextField
              label="Порядок (необязательно)"
              type="number"
              value={newScheduleData.sequenceNumber || ''}
              onChange={(e) => handleNewScheduleDataChange('sequenceNumber', e.target.value ? parseInt(e.target.value, 10) : null)}
              size="small"
            />
            <TextField
              label="Номер закалочной печи"
              value={newScheduleData.furnaceNumber}
              onChange={(e) => handleNewScheduleDataChange('furnaceNumber', e.target.value)}
              size="small"
            />
            <TextField
              label="Запланированное время начала"
              type="datetime-local"
              value={newScheduleData.scheduledStartTime}
              onChange={(e) => handleNewScheduleDataChange('scheduledStartTime', e.target.value)}
              size="small"
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              label="Запланированное время окончания"
              type="datetime-local"
              value={newScheduleData.scheduledEndTime}
              onChange={(e) => handleNewScheduleDataChange('scheduledEndTime', e.target.value)}
              size="small"
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              label="Примечания (необязательно)"
              value={newScheduleData.notes}
              onChange={(e) => handleNewScheduleDataChange('notes', e.target.value)}
              size="small"
              multiline
              rows={2}
            />
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog} startIcon={<CloseIcon />}>
            Отмена
          </Button>
          <Button
            onClick={handleCreateSchedule}
            variant="contained"
            startIcon={<AddIcon />}
            disabled={isCreating}
            autoFocus
          >
            {isCreating ? 'Создание...' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог обновления статуса выполнения */}
      <Dialog open={openUpdateDialog} onClose={handleCloseUpdateDialog} maxWidth="sm" fullWidth>
        <DialogTitle> Отметить выполнение для листа {scheduleToUpdate?.matId}
        </DialogTitle>
		
        <DialogContent dividers>
		{scheduleToUpdate && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Текущий статус: <strong>{scheduleToUpdate.status}</strong>
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <FormControl fullWidth margin="dense">
                  <InputLabel id="status-update-select-label">Новый статус выполнения</InputLabel>
                  <Select
                    labelId="status-update-select-label"
                    id="status-update-select"
                    value={updateStatusData.status}
                    label="Новый статус выполнения"
                    onChange={(e) => handleUpdateStatusDataChange('status', e.target.value)}
                    size="small"
                  >
                    {possibleExecutionStatuses.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Комментарий (необязательно)"
                  value={updateStatusData.comment}
                  onChange={(e) => handleUpdateStatusDataChange('comment', e.target.value)}
                  margin="dense"
                  multiline
                  rows={2}
                />
              </Box>
            </>
          )}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUpdateDialog} startIcon={<CloseIcon />}>
            Отмена
          </Button>
          <Button
            onClick={handleUpdateScheduleExecution}
            variant="contained"
            startIcon={<CheckCircleIcon />}
            disabled={isUpdating || !updateStatusData.status}
            autoFocus
          >
            {isUpdating ? 'Сохранение...' : 'Отметить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>{"Подтвердите удаление"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить запись плана закалки для листа <strong>{scheduleToDelete?.matId}</strong> (ID плана: {scheduleToDelete?.annealingPlanId})?
            Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Отмена</Button>
          <Button
            onClick={handleDeleteSchedule}
            color="error"
            startIcon={<DeleteIcon />}
            disabled={isDeleting}
          >
            {isDeleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AnnealingSchedulePage;