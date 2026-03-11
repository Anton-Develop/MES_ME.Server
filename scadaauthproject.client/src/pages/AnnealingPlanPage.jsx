// src/pages/AnnealingPlanPage.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
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
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  Divider,
  ListItemSecondaryAction,
  Grid,
  Pagination,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  History as HistoryIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon,
  CheckCircle as CheckCircleIcon,
  RemoveCircle as RemoveCircleIcon, // Иконка для удаления кассеты
} from '@mui/icons-material';
import api from '../api';

// Константы для статусов и цветов
const ANNEALING_PLAN_STATUSES = [
  'Создан',
  'Готов к запуску',
  'В работе',
  'Завершён',
  'Прерван',
  'Отменён',
];

const ANNEALING_PLAN_STATUS_COLORS = {
  'Создан': 'default',
  'Готов к запуску': 'info',
  'В работе': 'warning',
  'Завершён': 'success',
  'Прерван': 'error',
  'Отменён': 'secondary',
  'default': 'default',
};

const getStatusColor = (status) => {
  return ANNEALING_PLAN_STATUS_COLORS[status] || ANNEALING_PLAN_STATUS_COLORS['default'];
};

const AnnealingPlanPage = () => {
  // Основные состояния
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Состояния для пагинации
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10); // Фиксированный размер страницы
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Состояния для фильтров
  const [filters, setFilters] = useState({
    statusFilter: '',
    furnaceNumberFilter: '',
  });

  // Состояния для индикации загрузки/обработки
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCassettesLoading, setIsCassettesLoading] = useState(false); // Для загрузки кассет в диалоге
  const [isLoadingCassettesForSelection, setIsLoadingCassettesForSelection] = useState(false); // Для загрузки кассет при создании

  // Состояния для диалогов
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [openCassettesDialog, setOpenCassettesDialog] = useState(false);
  const [openDeleteConfirmDialog, setOpenDeleteConfirmDialog] = useState(false);
  const [openRemoveConfirmDialog, setOpenRemoveConfirmDialog] = useState(false); // Новый диалог

  // Состояния для данных диалогов
  const [newPlanData, setNewPlanData] = useState({
    planName: '',
    scheduledStartTime: null,
    scheduledEndTime: null,
    furnaceNumber: '',
    notes: '',
  });
  const [selectedCassettesForCreation, setSelectedCassettesForCreation] = useState([]);
  const [allCassettesForSelection, setAllCassettesForSelection] = useState([]);

  const [planToUpdate, setPlanToUpdate] = useState(null);
  const [planForStatus, setPlanForStatus] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [planForCassettes, setPlanForCassettes] = useState(null);
  const [cassettesInPlan, setCassettesInPlan] = useState([]);
  const [cassetteToRemove, setCassetteToRemove] = useState(null); // Для удаления
  const [planToDelete, setPlanToDelete] = useState(null);

  // --- Функции загрузки данных ---

  const fetchPlans = async (currentPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: currentPage,
        pageSize: pageSize,
      };
      if (filters.statusFilter) {
        params.statusFilter = filters.statusFilter;
      }
      if (filters.furnaceNumberFilter) {
        params.furnaceNumberFilter = filters.furnaceNumberFilter;
      }
      // Убираем пустые фильтры из параметров
      Object.keys(params).forEach(key => (params[key] === '' || params[key] === null) && delete params[key]);

      const response = await api.get('/annealingplan', { params });
      setPlans(response.data.data || response.data);
      setTotalCount(response.data.totalCount || (response.data.data || response.data).length);
      setTotalPages(response.data.totalPages || Math.ceil(response.data.totalCount / pageSize));
      setPage(response.data.page || currentPage); // Убедимся, что состояние page соответствует полученному
    } catch (err) {
      console.error('Ошибка загрузки планов отпуска:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке планов отпуска.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchCassettesForPlan = async (planId) => {
    setIsCassettesLoading(true); // Устанавливаем состояние загрузки
    try {
      const response = await api.get(`/annealingplan/${planId}/cassettes`);
      return response.data.data || response.data; // Обработка возможных разных структур ответа
    } catch (err) {
      console.error(`Ошибка загрузки кассет для плана ${planId}:`, err);
      return [];
    } finally {
      setIsCassettesLoading(false); // Сбрасываем состояние загрузки
    }
  };

  const fetchAllCassettesForSelection = async () => {
    if (allCassettesForSelection.length > 0) return; // Загружаем один раз
    setIsLoadingCassettesForSelection(true);
    try {
      const response = await api.get('/cassette'); // Используем существующий эндпоинт
      // Отфильтруем кассеты, которые уже находятся в *любом* плане отпуска
      const allPlanLinksResponse = await api.get('/cassette-plan-links'); // Получаем все связи
      const linkedCassetteIds = new Set(allPlanLinksResponse.data.map(link => link.cassetteId));
      const availableCassettes = response.data.filter(cassette => !linkedCassetteIds.has(cassette.cassetteId));

      setAllCassettesForSelection(availableCassettes);
    } catch (err) {
      console.error('Ошибка загрузки кассет для выбора:', err);
      setError('Ошибка загрузки кассет для выбора.');
      setAllCassettesForSelection([]);
    } finally {
      setIsLoadingCassettesForSelection(false);
    }
  };

  useEffect(() => {
    fetchPlans(); // Перезагружаем при изменении фильтров или страницы
  }, [filters.statusFilter, filters.furnaceNumberFilter, page]);

  // --- Обработчики изменений ---

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Сброс на первую страницу при изменении фильтра
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleNewPlanChange = (field, value) => {
    setNewPlanData(prev => ({ ...prev, [field]: value }));
  };

  const handlePlanToUpdateChange = (field, value) => {
    setPlanToUpdate(prev => ({ ...prev, [field]: value }));
  };

  const handleStatusChange = (e) => {
    setNewStatus(e.target.value);
  };

  const handleStatusCommentChange = (e) => {
    setStatusComment(e.target.value);
  };

  const handleSelectCassettesForCreation = (event, newValue) => {
    setSelectedCassettesForCreation(newValue);
  };

  // --- Обработчики действий ---

  const handleOpenCreateDialog = () => {
    setOpenCreateDialog(true);
    // Загружаем кассеты для выбора при открытии диалога
    fetchAllCassettesForSelection();
  };

  const handleCreatePlan = async () => {
    // Проверка на наличие имени плана (если требуется)
    if (!newPlanData.planName) {
      setError('Необходимо указать название плана.');
      return;
    }

    setIsCreating(true);
    setError('');
    try {
      const requestData = {
        planName: newPlanData.planName,
        scheduledStartTime: newPlanData.scheduledStartTime,
        scheduledEndTime: newPlanData.scheduledEndTime,
        furnaceNumber: newPlanData.furnaceNumber,
        notes: newPlanData.notes,
        // Включаем список кассет
        cassettesToInclude: selectedCassettesForCreation.map(c => c.cassetteId),
      };

      await api.post('/annealingplan', requestData);
      setOpenCreateDialog(false);
      setNewPlanData({ planName: '', scheduledStartTime: null, scheduledEndTime: null, furnaceNumber: '', notes: '' });
      setSelectedCassettesForCreation([]); // Сбросить выбор кассет
      fetchPlans(); // Обновляем список
      alert(`План отпуска "${requestData.planName}" создан.`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Ошибка при создании плана отпуска.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!planToUpdate) return;
    setIsUpdating(true);
    setError('');
    try {
      await api.put(`/annealingplan/${planToUpdate.planId}`, {
        planName: planToUpdate.planName,
        scheduledStartTime: planToUpdate.scheduledStartTime,
        scheduledEndTime: planToUpdate.scheduledEndTime,
        furnaceNumber: planToUpdate.furnaceNumber,
        notes: planToUpdate.notes,
      });
      setOpenUpdateDialog(false);
      setPlanToUpdate(null);
      fetchPlans();
      alert('План отпуска обновлён.');
    } catch (err) {
      console.error(err);
      setError('Ошибка обновления плана отпуска');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!planForStatus || !newStatus) {
      setError('Необходимо выбрать статус.');
      return;
    }
    setIsStatusUpdating(true);
    setError('');
    try {
      await api.put(`/annealingplan/${planForStatus.planId}/status`, {
        newStatus: newStatus,
        comment: statusComment,
      });
      setOpenStatusDialog(false);
      setPlanForStatus(null);
      setNewStatus('');
      setStatusComment('');
      fetchPlans();
      alert(`Статус плана "${planForStatus.planName}" обновлён.`);
    } catch (err) {
      console.error('Ошибка обновления статуса плана отпуска:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при обновлении статуса плана.');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    setIsDeleting(true);
    setError('');
    try {
      await api.delete(`/annealingplan/${planToDelete.planId}`);
      setOpenDeleteConfirmDialog(false);
      setPlanToDelete(null);
      fetchPlans();
      alert(`План отпуска "${planToDelete.planName}" удалён.`);
    } catch (err) {
      console.error('Ошибка удаления плана отпуска:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при удалении плана отпуска.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenCassettesDialog = async (plan) => {
    setPlanForCassettes(plan);
    const cassettes = await handleFetchCassettesForPlan(plan.planId);
    setCassettesInPlan(cassettes);
    setOpenCassettesDialog(true);
  };

  const handleCloseCassettesDialog = () => {
    setOpenCassettesDialog(false);
    setPlanForCassettes(null);
    setCassettesInPlan([]);
  };

  // --- НОВОЕ: Обработчики для удаления кассеты из плана ---
  const handleOpenRemoveConfirmDialog = (cassette) => {
    setCassetteToRemove(cassette);
    setOpenRemoveConfirmDialog(true);
  };

  const handleRemoveCassetteFromPlan = async () => {
    if (!planForCassettes || !cassetteToRemove) return;

    setIsRemovingCassette(true);
    setError('');
    try {
      await api.delete(`/annealingplan/${planForCassettes.planId}/remove-cassette/${cassetteToRemove.cassetteId}`);
      setOpenRemoveConfirmDialog(false);
      setCassetteToRemove(null);

      // Обновить UI:
      // 1. Обновить список в диалоге "Кассеты в плане"
      setCassettesInPlan(prev => prev.filter(c => c.cassetteId !== cassetteToRemove.cassetteId));
      // 2. Обновить cassettesCount в planForCassettes
      setPlanForCassettes(prev => ({...prev, cassettesCount: Math.max(0, prev.cassettesCount - 1)})); // Защита от отрицательного счёта
      // 3. Обновить cassettesCount в главном списке планов
      setPlans(prevPlans => prevPlans.map(p => p.planId === planForCassettes.planId ? {...p, cassettesCount: p.cassettesCount - 1} : p));

      alert(`Кассета ${cassetteToRemove.cassetteId} удалена из плана отпуска ${planForCassettes.planId}.`);
    } catch (err) {
      console.error('Ошибка удаления кассеты из плана:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при удалении кассеты из плана отпуска.');
    } finally {
      setIsRemovingCassette(false);
    }
  };
  // --- КОНЕЦ НОВОГО ---

  // --- Форматирование дат ---
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('ru-RU');
  };

  // --- Состояния для индикации загрузки/обработки ---
  const [isRemovingCassette, setIsRemovingCassette] = useState(false); // Для удаления кассеты

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            План отпуска
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
          >
            Создать план отпуска
          </Button>
        </Box>

        {/* Фильтры */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Статус</InputLabel>
                <Select
                  name="statusFilter"
                  value={filters.statusFilter}
                  onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                  label="Статус"
                >
                  <MenuItem value="">Все</MenuItem>
                  {ANNEALING_PLAN_STATUSES.map(status => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Печь №"
                name="furnaceNumberFilter"
                value={filters.furnaceNumberFilter}
                onChange={(e) => handleFilterChange('furnaceNumberFilter', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button onClick={() => setFilters({ statusFilter: '', furnaceNumberFilter: '' })} startIcon={<ClearIcon />}>
                Сбросить фильтры
              </Button>
            </Grid>
          </Grid>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                    <TableCell>Название</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Печь</TableCell>
                    <TableCell>Запл. начало</TableCell>
                    <TableCell>Запл. конец</TableCell>
                    <TableCell>Факт. начало</TableCell>
                    <TableCell>Факт. конец</TableCell>
                    <TableCell>Кассет</TableCell>
                    <TableCell>Вес (кг)</TableCell>
                    <TableCell>Заметки</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.planId}>
                      <TableCell>{plan.planId}</TableCell>
                      <TableCell>{plan.planName}</TableCell>
                      <TableCell>
                        <Chip label={plan.status} color={getStatusColor(plan.status)} size="small" />
                      </TableCell>
                      <TableCell>{plan.furnaceNumber || 'N/A'}</TableCell>
                      <TableCell>{formatDate(plan.scheduledStartTime)}</TableCell>
                      <TableCell>{formatDate(plan.scheduledEndTime)}</TableCell>
                      <TableCell>{formatDate(plan.actualStartTime)}</TableCell>
                      <TableCell>{formatDate(plan.actualEndTime)}</TableCell>
                      <TableCell>{plan.cassettesCount}</TableCell>
                      <TableCell>{plan.totalWeightKg}</TableCell>
                      <TableCell>{plan.notes || 'N/A'}</TableCell>
                      <TableCell>
                        <Tooltip title="Редактировать">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setPlanToUpdate(plan);
                              setOpenUpdateDialog(true);
                            }}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Изменить статус">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setPlanForStatus(plan);
                              setNewStatus(plan.status); // Устанавливаем текущий статус как начальный
                              setStatusComment(''); // Сбрасываем комментарий
                              setOpenStatusDialog(true);
                            }}
                            color="secondary"
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Кассеты в плане">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenCassettesDialog(plan)}
                            color="info"
                          >
                            <PlaylistAddCheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setPlanToDelete(plan);
                              setOpenDeleteConfirmDialog(true);
                            }}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {/* <Tooltip title="Отчет">
                          <IconButton
                            size="small"
                            onClick={() => {}}
                            color="info"
                          >
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip> */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Пагинация */}
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          </>
        )}
      </Paper>

      {/* Диалог создания */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
        <DialogTitle>Создать план отпуска</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            margin="dense"
            name="planName"
            label="Название плана"
            type="text"
            fullWidth
            variant="outlined"
            value={newPlanData.planName}
            onChange={(e) => handleNewPlanChange('planName', e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="scheduledStartTime"
            label="Планируемое время начала"
            type="datetime-local"
            fullWidth
            variant="outlined"
            value={newPlanData.scheduledStartTime || ''}
            onChange={(e) => handleNewPlanChange('scheduledStartTime', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="scheduledEndTime"
            label="Планируемое время окончания"
            type="datetime-local"
            fullWidth
            variant="outlined"
            value={newPlanData.scheduledEndTime || ''}
            onChange={(e) => handleNewPlanChange('scheduledEndTime', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="furnaceNumber"
            label="Номер печи"
            type="text"
            fullWidth
            variant="outlined"
            value={newPlanData.furnaceNumber}
            onChange={(e) => handleNewPlanChange('furnaceNumber', e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="notes"
            label="Заметки"
            type="text"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newPlanData.notes}
            onChange={(e) => handleNewPlanChange('notes', e.target.value)}
            sx={{ mb: 2 }}
          />
          {/* Выбор кассет */}
          <Autocomplete
            multiple
            limitTags={2}
            id="cassettes-select"
            options={allCassettesForSelection}
            getOptionLabel={(option) => `${option.cassetteId} (${option.status})`}
            value={selectedCassettesForCreation}
            onChange={handleSelectCassettesForCreation}
            loading={isLoadingCassettesForSelection}
            isOptionEqualToValue={(option, value) => option.cassetteId === value.cassetteId}
            renderInput={(params) => (
              <TextField {...params} label="Выберите кассеты для включения" placeholder="Начните вводить ID..." />
            )}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Отмена</Button>
          <Button onClick={handleCreatePlan} variant="contained" disabled={isCreating}>
            {isCreating ? 'Создание...' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог обновления */}
      <Dialog open={openUpdateDialog} onClose={() => setOpenUpdateDialog(false)}>
        <DialogTitle>Обновить план отпуска</DialogTitle>
        <DialogContent dividers>
          {planToUpdate && (
            <>
              <TextField
                autoFocus
                margin="dense"
                name="planName"
                label="Название плана"
                type="text"
                fullWidth
                variant="outlined"
                value={planToUpdate.planName}
                onChange={(e) => handlePlanToUpdateChange('planName', e.target.value)}
                required
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                name="scheduledStartTime"
                label="Планируемое время начала"
                type="datetime-local"
                fullWidth
                variant="outlined"
                value={planToUpdate.scheduledStartTime || ''}
                onChange={(e) => handlePlanToUpdateChange('scheduledStartTime', e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                name="scheduledEndTime"
                label="Планируемое время окончания"
                type="datetime-local"
                fullWidth
                variant="outlined"
                value={planToUpdate.scheduledEndTime || ''}
                onChange={(e) => handlePlanToUpdateChange('scheduledEndTime', e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                name="furnaceNumber"
                label="Номер печи"
                type="text"
                fullWidth
                variant="outlined"
                value={planToUpdate.furnaceNumber}
                onChange={(e) => handlePlanToUpdateChange('furnaceNumber', e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                name="notes"
                label="Заметки"
                type="text"
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                value={planToUpdate.notes}
                onChange={(e) => handlePlanToUpdateChange('notes', e.target.value)}
                sx={{ mb: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenUpdateDialog(false)}>Отмена</Button>
          <Button onClick={handleUpdatePlan} variant="contained" disabled={isUpdating}>
            {isUpdating ? 'Обновление...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог изменения статуса */}
      <Dialog open={openStatusDialog} onClose={() => setOpenStatusDialog(false)}>
        <DialogTitle>Изменить статус плана</DialogTitle>
        <DialogContent dividers>
          {planForStatus && (
            <>
              <Typography variant="body1" gutterBottom>
                План: <strong>{planForStatus.planId}</strong> - <em>{planForStatus.planName}</em>
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Новый статус</InputLabel>
                <Select
                  value={newStatus}
                  onChange={handleStatusChange}
                  label="Новый статус"
                >
                  {ANNEALING_PLAN_STATUSES.map(status => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                margin="dense"
                name="comment"
                label="Комментарий (опционально)"
                type="text"
                fullWidth
                multiline
                rows={2}
                variant="outlined"
                value={statusComment}
                onChange={handleStatusCommentChange}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStatusDialog(false)}>Отмена</Button>
          <Button onClick={handleUpdateStatus} variant="contained" disabled={isStatusUpdating}>
            {isStatusUpdating ? 'Обновление...' : 'Обновить статус'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог списка кассет в плане */}
      <Dialog open={openCassettesDialog} onClose={handleCloseCassettesDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Кассеты в плане - {planForCassettes?.planName}
        </DialogTitle>
        <DialogContent dividers>
          {isCassettesLoading ? ( // Показываем прогресс при загрузке
            <Box display="flex" justifyContent="center" py={5}>
              <CircularProgress />
            </Box>
          ) : planForCassettes ? (
            <>
              <Typography variant="body2" color="textSecondary" paragraph>
                Всего кассет: {cassettesInPlan.length}
              </Typography>
              {cassettesInPlan.length > 0 ? (
                <List dense>
                  {cassettesInPlan.map((cassette) => (
                    <React.Fragment key={cassette.cassetteId}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <>
                              <strong>ID:</strong> {cassette.cassetteId} | <strong>Статус:</strong> {cassette.status}
                            </>
                          }
                          secondary={
                            <>
                              <Typography component="span" variant="body2" color="textPrimary">
                                Создана: {formatDate(cassette.createdAt)}
                              </Typography>
                              <br />
                              <Typography component="span" variant="body2" color="textSecondary">
                                Создал: {cassette.createdBy} | Заметки: {cassette.notes || 'Нет'}
                              </Typography>
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title={`Удалить кассету ${cassette.cassetteId} из плана`}>
                            <IconButton
                              edge="end"
                              onClick={() => handleOpenRemoveConfirmDialog(cassette)}
                              color="error"
                              size="small"
                            >
                              <RemoveCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" align="center" color="textSecondary" sx={{ py: 2 }}>
                  В плане нет кассет.
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" align="center" color="textSecondary">
              Загрузка...
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCassettesDialog}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог подтверждения удаления кассеты */}
      <Dialog open={openRemoveConfirmDialog} onClose={() => setOpenRemoveConfirmDialog(false)}>
        <DialogTitle>Подтвердите удаление кассеты</DialogTitle>
        <DialogContent dividers>
          {cassetteToRemove && planForCassettes && (
            <Typography variant="body1">
              Вы уверены, что хотите удалить кассету <strong>{cassetteToRemove.cassetteId}</strong> из плана отпуска <strong>{planForCassettes.planName}</strong>?
              <br />
              <em>Статус кассеты будет сброшен.</em>
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRemoveConfirmDialog(false)}>Отмена</Button>
          <Button
            onClick={handleRemoveCassetteFromPlan}
            variant="contained"
            color="error"
            disabled={isRemovingCassette}
          >
            {isRemovingCassette ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>

       {/* Диалог подтверждения удаления плана */}
       <Dialog open={openDeleteConfirmDialog} onClose={() => setOpenDeleteConfirmDialog(false)}>
        <DialogTitle>Подтвердите удаление</DialogTitle>
        <DialogContent dividers>
          {planToDelete && (
            <Typography variant="body1">
              Вы уверены, что хотите удалить план отпуска <strong>{planToDelete.planId}</strong> - <em>{planToDelete.planName}</em>?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirmDialog(false)}>Отмена</Button>
          <Button onClick={handleDeletePlan} variant="contained" color="error" disabled={isDeleting}>
            {isDeleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AnnealingPlanPage;