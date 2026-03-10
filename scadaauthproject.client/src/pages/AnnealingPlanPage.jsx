// src/pages/AnnealingPlanPage.jsx
import React, { useState, useEffect, Fragment } from 'react';
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
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Состояния для фильтров
    const [filters, setFilters] = useState({
        statusFilter: '',
        furnaceNumberFilter: '',
    });

    // Состояния для диалогов
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
    const [openStatusDialog, setOpenStatusDialog] = useState(false);
    const [openCassettesDialog, setOpenCassettesDialog] = useState(false);
    const [openDeleteConfirmDialog, setOpenDeleteConfirmDialog] = useState(false);

    // Состояния для данных диалогов
    const [newPlanData, setNewPlanData] = useState({
        planName: '',
        scheduledStartTime: '',
        scheduledEndTime: '',
        furnaceNumber: '',
        notes: '',
    });
    const [planToUpdate, setPlanToUpdate] = useState(null);
    const [planForStatus, setPlanForStatus] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [statusComment, setStatusComment] = useState('');
    const [planForCassettes, setPlanForCassettes] = useState(null);
    const [cassettesInPlan, setCassettesInPlan] = useState([]);
    const [planToDelete, setPlanToDelete] = useState(null);

    // Состояния для loading в диалогах
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isStatusUpdating, setIsStatusUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCassettesLoading, setIsCassettesLoading] = useState(false);

    // Загрузка планов
    const fetchPlans = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {
                page,
                pageSize,
                statusFilter: filters.statusFilter,
                furnaceNumberFilter: filters.furnaceNumberFilter,
            };

            // Убираем пустые фильтры из параметров
            Object.keys(params).forEach(key => 
                (params[key] === '' || params[key] === null) && delete params[key]
            );

            const response = await api.get('/annealingplan', { params });
            setPlans(response.data.data || response.data);
            setTotalCount(response.data.totalCount || (response.data.data || response.data).length);
        } catch (err) {
            console.error('Ошибка загрузки планов отпуска:', err);
            setError(err.response?.data?.message || err.message || 'Ошибка при загрузке планов отпуска.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
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

    // Создание плана
    const handleCreatePlan = async () => {
        if (!newPlanData.planName) {
            setError('Необходимо указать название плана.');
            return;
        }

        setIsCreating(true);
        setError('');
        try {
            await api.post('/annealingplan', newPlanData);
            setOpenCreateDialog(false);
            setNewPlanData({ 
                planName: '', 
                scheduledStartTime: '', 
                scheduledEndTime: '', 
                furnaceNumber: '', 
                notes: '' 
            });
            fetchPlans();
            alert('План отпуска создан успешно.');
        } catch (err) {
            console.error('Ошибка создания плана отпуска:', err);
            setError(err.response?.data?.message || err.message || 'Ошибка при создании плана отпуска.');
        } finally {
            setIsCreating(false);
        }
    };

    // Обновление плана
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
            console.error('Ошибка обновления плана отпуска:', err);
            setError(err.response?.data?.message || err.message || 'Ошибка при обновлении плана отпуска.');
        } finally {
            setIsUpdating(false);
        }
    };

    // Обновление статуса
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

    // Удаление плана
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

    // Загрузка кассет для плана
    const handleFetchCassettesForPlan = async (planId) => {
        setIsCassettesLoading(true);
        try {
            const response = await api.get(`/annealingplan/${planId}/cassettes`);
            return response.data.data || response.data;
        } catch (err) {
            console.error(`Ошибка загрузки кассет для плана ${planId}:`, err);
            return [];
        } finally {
            setIsCassettesLoading(false);
        }
    };

    const handleOpenCassettesDialog = async (plan) => {
        setPlanForCassettes(plan);
        setIsCassettesLoading(true);
        const cassettes = await handleFetchCassettesForPlan(plan.planId);
        setCassettesInPlan(cassettes);
        setOpenCassettesDialog(true);
    };

    // Обработчики изменения данных в диалогах
    const handleNewPlanChange = (field, value) => {
        setNewPlanData(prev => ({ ...prev, [field]: value }));
    };

    const handlePlanToUpdateChange = (field, value) => {
        setPlanToUpdate(prev => ({ ...prev, [field]: value }));
    };

    // Форматирование дат
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('ru-RU');
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Paper sx={{ p: 3 }}>
                {/* Заголовок и кнопка создания */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h5" gutterBottom>
                        План отпуска
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenCreateDialog(true)}
                        disabled={isCreating}
                    >
                        Создать план отпуска
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
                                label="Статус плана"
                                select
                                value={filters.statusFilter}
                                onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                                size="small"
                                fullWidth
                                sx={{ minWidth: 200 }}
                            >
                                <MenuItem value="">Все</MenuItem>
                                {ANNEALING_PLAN_STATUSES.map((status) => (
                                    <MenuItem key={status} value={status}>{status}</MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                label="Номер печи"
                                value={filters.furnaceNumberFilter}
                                onChange={(e) => handleFilterChange('furnaceNumberFilter', e.target.value)}
                                size="small"
                                fullWidth
                                sx={{ minWidth: 200 }}
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

                {/* Ошибки и загрузка */}
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
                                                <Chip 
                                                    label={plan.status} 
                                                    color={getStatusColor(plan.status)} 
                                                    size="small" 
                                                />
                                            </TableCell>
                                            <TableCell>{plan.furnaceNumber || 'N/A'}</TableCell>
                                            <TableCell>{formatDate(plan.scheduledStartTime)}</TableCell>
                                            <TableCell>{formatDate(plan.scheduledEndTime)}</TableCell>
                                            <TableCell>{formatDate(plan.actualStartTime)}</TableCell>
                                            <TableCell>{formatDate(plan.actualEndTime)}</TableCell>
                                            <TableCell>{plan.cassettesCount || 0}</TableCell>
                                            <TableCell>{plan.totalWeightKg || 'N/A'}</TableCell>
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
                                                            setNewStatus(plan.status);
                                                            setStatusComment('');
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

            {/* Диалог создания */}
            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Создать план отпуска</DialogTitle>
                <DialogContent dividers>
                    <Box display="flex" flexDirection="column" gap={2}>
                        <TextField
                            autoFocus
                            name="planName"
                            label="Название плана"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={newPlanData.planName}
                            onChange={(e) => handleNewPlanChange('planName', e.target.value)}
                            required
                        />
                        <TextField
                            name="furnaceNumber"
                            label="Номер печи"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={newPlanData.furnaceNumber}
                            onChange={(e) => handleNewPlanChange('furnaceNumber', e.target.value)}
                        />
                        <TextField
                            name="scheduledStartTime"
                            label="Планируемое время начала"
                            type="datetime-local"
                            fullWidth
                            variant="outlined"
                            value={newPlanData.scheduledStartTime || ''}
                            onChange={(e) => handleNewPlanChange('scheduledStartTime', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            name="scheduledEndTime"
                            label="Планируемое время окончания"
                            type="datetime-local"
                            fullWidth
                            variant="outlined"
                            value={newPlanData.scheduledEndTime || ''}
                            onChange={(e) => handleNewPlanChange('scheduledEndTime', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            name="notes"
                            label="Заметки"
                            type="text"
                            fullWidth
                            multiline
                            rows={3}
                            variant="outlined"
                            value={newPlanData.notes}
                            onChange={(e) => handleNewPlanChange('notes', e.target.value)}
                        />
                    </Box>
                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)} startIcon={<CloseIcon />}>
                        Отмена
                    </Button>
                    <Button 
                        onClick={handleCreatePlan} 
                        variant="contained" 
                        startIcon={<AddIcon />}
                        disabled={isCreating}
                    >
                        {isCreating ? 'Создание...' : 'Создать'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог обновления */}
            <Dialog open={openUpdateDialog} onClose={() => setOpenUpdateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Обновить план отпуска</DialogTitle>
                <DialogContent dividers>
                    {planToUpdate && (
                        <Box display="flex" flexDirection="column" gap={2}>
                            <TextField
                                autoFocus
                                name="planName"
                                label="Название плана"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={planToUpdate.planName}
                                onChange={(e) => handlePlanToUpdateChange('planName', e.target.value)}
                                required
                            />
                            <TextField
                                name="furnaceNumber"
                                label="Номер печи"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={planToUpdate.furnaceNumber}
                                onChange={(e) => handlePlanToUpdateChange('furnaceNumber', e.target.value)}
                            />
                            <TextField
                                name="scheduledStartTime"
                                label="Планируемое время начала"
                                type="datetime-local"
                                fullWidth
                                variant="outlined"
                                value={planToUpdate.scheduledStartTime || ''}
                                onChange={(e) => handlePlanToUpdateChange('scheduledStartTime', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                name="scheduledEndTime"
                                label="Планируемое время окончания"
                                type="datetime-local"
                                fullWidth
                                variant="outlined"
                                value={planToUpdate.scheduledEndTime || ''}
                                onChange={(e) => handlePlanToUpdateChange('scheduledEndTime', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                name="notes"
                                label="Заметки"
                                type="text"
                                fullWidth
                                multiline
                                rows={3}
                                variant="outlined"
                                value={planToUpdate.notes}
                                onChange={(e) => handlePlanToUpdateChange('notes', e.target.value)}
                            />
                        </Box>
                    )}
                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenUpdateDialog(false)} startIcon={<CloseIcon />}>
                        Отмена
                    </Button>
                    <Button 
                        onClick={handleUpdatePlan} 
                        variant="contained" 
                        startIcon={<SaveIcon />}
                        disabled={isUpdating}
                    >
                        {isUpdating ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог изменения статуса */}
            <Dialog open={openStatusDialog} onClose={() => setOpenStatusDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Изменить статус плана</DialogTitle>
                <DialogContent dividers>
                    {planForStatus && (
                        <Box display="flex" flexDirection="column" gap={2}>
                            <Typography variant="body2" color="text.secondary">
                                План: <strong>{planForStatus.planName}</strong> (ID: {planForStatus.planId})
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Текущий статус: <Chip label={planForStatus.status} size="small" />
                            </Typography>
                            <FormControl fullWidth>
                                <InputLabel>Новый статус</InputLabel>
                                <Select
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                    label="Новый статус"
                                    size="small"
                                >
                                    {ANNEALING_PLAN_STATUSES.map((status) => (
                                        <MenuItem key={status} value={status}>{status}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                name="comment"
                                label="Комментарий (опционально)"
                                type="text"
                                fullWidth
                                multiline
                                rows={2}
                                variant="outlined"
                                value={statusComment}
                                onChange={(e) => setStatusComment(e.target.value)}
                            />
                        </Box>
                    )}
                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenStatusDialog(false)} startIcon={<CloseIcon />}>
                        Отмена
                    </Button>
                    <Button 
                        onClick={handleUpdateStatus} 
                        variant="contained" 
                        startIcon={<CheckCircleIcon />}
                        disabled={isStatusUpdating || !newStatus}
                    >
                        {isStatusUpdating ? 'Сохранение...' : 'Обновить статус'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог списка кассет в плане */}
            <Dialog open={openCassettesDialog} onClose={() => setOpenCassettesDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    Кассеты в плане - {planForCassettes?.planName}
                </DialogTitle>
                <DialogContent dividers>
                    {isCassettesLoading ? (
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
                                    {cassettesInPlan.map((cassette, index) => (
                                        <Fragment key={cassette.cassetteId || index}>
                                            <ListItem>
                                                <ListItemText
                                                    primary={
                                                        <>
                                                            <strong>ID:</strong> {cassette.cassetteId} | 
                                                            <strong> Статус:</strong> {cassette.status}
                                                        </>
                                                    }
                                                    secondary={
                                                        <>
                                                            <Typography component="span" variant="body2" color="textPrimary">
                                                                Создана: {formatDate(cassette.createdAt)}
                                                            </Typography>
                                                            <br />
                                                            <Typography component="span" variant="body2" color="textSecondary">
                                                                Создал: {cassette.createdBy || 'N/A'} | Заметки: {cassette.notes || 'Нет'}
                                                            </Typography>
                                                        </>
                                                    }
                                                />
                                            </ListItem>
                                            <Divider component="li" />
                                        </Fragment>
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
                    <Button onClick={() => setOpenCassettesDialog(false)} startIcon={<CloseIcon />}>
                        Закрыть
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог подтверждения удаления */}
            <Dialog open={openDeleteConfirmDialog} onClose={() => setOpenDeleteConfirmDialog(false)}>
                <DialogTitle>Подтвердите удаление</DialogTitle>
                <DialogContent dividers>
                    {planToDelete && (
                        <Typography variant="body1">
                            Вы уверены, что хотите удалить план отпуска 
                            <strong> {planToDelete.planName}</strong> (ID: {planToDelete.planId})?
                            <br />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Это действие нельзя отменить.
                            </Typography>
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteConfirmDialog(false)} startIcon={<CloseIcon />}>
                        Отмена
                    </Button>
                    <Button 
                        onClick={handleDeletePlan} 
                        variant="contained" 
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

export default AnnealingPlanPage;