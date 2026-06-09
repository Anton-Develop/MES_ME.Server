import React, { useState, useEffect } from 'react';
import {
    Container, Paper, Typography, Button, Box, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TextField, FormControl, InputLabel,
    Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogContentText,
    DialogActions, Alert, CircularProgress, Chip, IconButton, Tooltip,
    Pagination, Grid, Accordion, AccordionSummary, AccordionDetails,
    List, ListItem, ListItemText, Card, CardHeader, CardContent
} from '@mui/material';
import {
    Add as AddIcon, Save as SaveIcon, Close as CloseIcon, Edit as EditIcon,
    CheckCircle as CheckCircleIcon, RoomService as RoomService, Clear as ClearIcon,
    ExpandMore as ExpandMoreIcon, Delete as DeleteIcon, Search as SearchIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api';
import PlanDetailsDialog from './PlanDetailsDialog';



const SheetFiltersUI = ({ filtersState, setFiltersState, onApply, onClear }) => (
        <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none', } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, px: 2, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                <Typography variant="subtitle2" color="primary">Фильтры поиска листов</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1, pt: 0 }}>
                <Grid container spacing={1}>
                    <Grid item xs={6}><TextField size="small" label="Плавка" fullWidth value={filtersState.meltNumber} onChange={e => setFiltersState(p => ({...p, meltNumber: e.target.value}))} /></Grid>
                    <Grid item xs={6}><TextField size="small" label="Партия" fullWidth value={filtersState.batchNumber} onChange={e => setFiltersState(p => ({...p, batchNumber: e.target.value}))} /></Grid>
                    <Grid item xs={6}><TextField size="small" label="Пачка" fullWidth value={filtersState.packNumber} onChange={e => setFiltersState(p => ({...p, packNumber: e.target.value}))} /></Grid>
                    <Grid item xs={6}><TextField size="small" label="№ Листа" fullWidth value={filtersState.sheetNumber} onChange={e => setFiltersState(p => ({...p, sheetNumber: e.target.value}))} /></Grid>
                    <Grid item xs={12}><TextField size="small" label="Марка стали" fullWidth value={filtersState.steelGrade} onChange={e => setFiltersState(p => ({...p, steelGrade: e.target.value}))} /></Grid>
                    <Grid item xs={12} container spacing={1} justifyContent="flex-end">
                        <Grid item><Button size="small" onClick={onClear} startIcon={<ClearIcon />}>Сбросить</Button></Grid>
                        <Grid item><Button size="small" variant="contained" onClick={onApply} startIcon={<SearchIcon />}>Найти</Button></Grid>
                    </Grid>
                </Grid>
            </AccordionDetails>
        </Accordion>
    );
const AnnealingBatchPlanPage = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [filters, setFilters] = useState({ statusFilter: '', furnaceNumberFilter: '' });

    const [availableSheets, setAvailableSheets] = useState([]);
    const [selectedSheets, setSelectedSheets] = useState([]);
    const [loadingAvailable, setLoadingAvailable] = useState(false);

    // Состояния для фильтров листов
    const [createSheetFilters, setCreateSheetFilters] = useState({
        meltNumber: '', batchNumber: '', packNumber: '', sheetNumber: '', steelGrade: ''
    });
    const [editSheetFilters, setEditSheetFilters] = useState({
        meltNumber: '', batchNumber: '', packNumber: '', sheetNumber: '', steelGrade: ''
    });

    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [newPlanData, setNewPlanData] = useState({
        planName: '', furnaceNumber: '1', scheduledStartTime: '', scheduledEndTime: '', notes: '',
    });
    const [isCreating, setIsCreating] = useState(false);

    const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
    const [planToUpdate, setPlanToUpdate] = useState(null);
    const [updateStatusData, setUpdateStatusData] = useState({ status: '', actualStartTime: '', actualEndTime: '', comment: '' });
    const [isUpdating, setIsUpdating] = useState(false);

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [planToDelete, setPlanToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [planToEdit, setPlanToEdit] = useState(null);
    const [editPlanData, setEditPlanData] = useState({ planName: '', furnaceNumber: '', scheduledStartTime: '', scheduledEndTime: '', notes: '' });
    const [editingAvailableSheets, setEditingAvailableSheets] = useState([]);
    const [editingSelectedSheets, setEditingSelectedSheets] = useState([]);
    const [loadingEditingSheets, setLoadingEditingSheets] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const possibleExecutionStatuses = ['Создан', 'Готов к работе', 'В работе', 'Завершён', 'Прерван', 'Отменён'];

    // --- ХЕЛПЕРЫ ДЛЯ ИСПРАВЛЕНИЯ ПРОБЛЕМЫ СО ВРЕМЕНЕМ (+5 ЧАСОВ) ---
    // Парсит дату с сервера как локальную, игнорируя часовой пояс (Z или +05:00)
    const parseAsLocal = (dateStr) => {
        if (!dateStr) return null;
        // Извлекаем YYYY-MM-DDTHH:mm:ss и игнорируем таймзоны, чтобы JS парсил как локальное время
        const match = String(dateStr).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
        const str = match ? match[1] : String(dateStr).replace('Z', '');
        return new Date(str);
    };

    const formatDisplayDate = (dateStr) => {
        const d = parseAsLocal(dateStr);
        return d ? d.toLocaleString('ru-RU') : 'N/A';
    };

    // Форматирует дату для вставки в input type="datetime-local"
    const formatForInput = (dateStr) => {
        if (!dateStr) return '';
        const match = String(dateStr).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
        return match ? match[1] : '';
    };
    // ---------------------------------------------------------------

    const fetchPlans = async () => {
        setLoading(true);
        setError('');
        try {
            const params = { page, pageSize, statusFilter: filters.statusFilter, furnaceNumberFilter: filters.furnaceNumberFilter };
            Object.keys(params).forEach(key => (params[key] === '' || params[key] === null) && delete params[key]);
            const response = await api.get('/annealingbatchplan', { params });
            setPlans(response.data.data);
            setTotalCount(response.data.totalCount);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Ошибка при загрузке плана закалки.');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchPlans(); }, [page, pageSize, filters]);

    const handleFilterChange = (field, value) => { setFilters(prev => ({ ...prev, [field]: value })); setPage(1); };
    const handleClearFilters = () => { setFilters({ statusFilter: '', furnaceNumberFilter: '' }); setPage(1); };
    const handlePageChange = (event, newPage) => { setPage(newPage); };
    const handlePageSizeChange = (event) => { setPageSize(parseInt(event.target.value, 10)); setPage(1); };

    const updateSheetStatus = async (matIds, newStatus) => {
        try {
            await api.put('/inputdata/update-status', { matIds: matIds, newStatus: newStatus });
        } catch (err) { console.error(`Ошибка обновления статуса листов:`, err); }
    };

    const fetchAvailableSheets = async (page = 1, searchParams = {}) => {
        setLoadingAvailable(true);
        try {
            const response = await api.get('/inputdata/for-annealing-plan', { params: { page, pageSize: 50, ...searchParams } });
            setAvailableSheets(response.data.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка при загрузке доступных листов.');
            setAvailableSheets([]);
        } finally { setLoadingAvailable(false); }
    };

    const fetchEditingAvailableSheets = async (searchParams = {}) => {
        setLoadingEditingSheets(true);
        try {
            const response = await api.get('/inputdata/for-annealing-plan', { params: { page: 1, pageSize: 50, ...searchParams } });
            let allAvailable = response.data.data || [];
            const availableFiltered = allAvailable.filter(availSheet =>
                !editingSelectedSheets.some(planSheet => planSheet.matId === availSheet.matId)
            );
            setEditingAvailableSheets(availableFiltered);
        } catch (err) {
            console.error('Ошибка загрузки листов для редактирования:', err);
            setEditingAvailableSheets([]);
        } finally { setLoadingEditingSheets(false); }
    };

    const buildFilterParams = (filterState) => {
        const params = {};
        if (filterState.meltNumber) params.meltNumberFilter = filterState.meltNumber;
        if (filterState.batchNumber) params.batchNumberFilter = filterState.batchNumber;
        if (filterState.packNumber) params.packNumberFilter = filterState.packNumber;
        if (filterState.sheetNumber) params.sheetNumberFilter = filterState.sheetNumber;
        if (filterState.steelGrade) params.steelGradeFilter = filterState.steelGrade;
        return params;
    };

    const handleApplyCreateFilters = () => fetchAvailableSheets(1, buildFilterParams(createSheetFilters));
    const handleClearCreateFilters = () => {
        setCreateSheetFilters({ meltNumber: '', batchNumber: '', packNumber: '', sheetNumber: '', steelGrade: '' });
        fetchAvailableSheets(1, {});
    };

    const handleApplyEditFilters = () => fetchEditingAvailableSheets(buildFilterParams(editSheetFilters));
    const handleClearEditFilters = () => {
        setEditSheetFilters({ meltNumber: '', batchNumber: '', packNumber: '', sheetNumber: '', steelGrade: '' });
        fetchEditingAvailableSheets({});
    };

    // --- ДИАЛОГ СОЗДАНИЯ ---
    const handleOpenCreateDialog = () => {
        setNewPlanData({ planName: '', furnaceNumber: '1', scheduledStartTime: '', scheduledEndTime: '', notes: '' });
        setAvailableSheets([]); setSelectedSheets([]);
        setCreateSheetFilters({ meltNumber: '', batchNumber: '', packNumber: '', sheetNumber: '', steelGrade: '' });
        setOpenCreateDialog(true);
        fetchAvailableSheets(1, {});
    };
    const handleCloseCreateDialog = () => { setOpenCreateDialog(false); setIsCreating(false); setError(''); };
    const handleNewPlanDataChange = (field, value) => setNewPlanData(prev => ({ ...prev, [field]: value }));

    const onDragEnd = (result) => {
        const { destination, source } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId) {
            const items = source.droppableId === 'available-sheets-list' ? [...availableSheets] : [...selectedSheets];
            const [reorderedItem] = items.splice(source.index, 1);
            items.splice(destination.index, 0, reorderedItem);
            if (source.droppableId === 'available-sheets-list') setAvailableSheets(items); else setSelectedSheets(items);
        } else {
            const sourceItems = source.droppableId === 'available-sheets-list' ? [...availableSheets] : [...selectedSheets];
            const destItems = destination.droppableId === 'available-sheets-list' ? [...availableSheets] : [...selectedSheets];
            const [movedItem] = sourceItems.splice(source.index, 1);
            destItems.splice(destination.index, 0, movedItem);
            if (source.droppableId === 'available-sheets-list') { setAvailableSheets(sourceItems); setSelectedSheets(destItems); }
            else { setSelectedSheets(sourceItems); setAvailableSheets(destItems); }
        }
    };

    const handleAddSheetToPlan = (sheet) => {
        if (!selectedSheets.some(s => s.matId === sheet.matId)) {
            setSelectedSheets(prev => [...prev, sheet]);
            setAvailableSheets(prev => prev.filter(s => s.matId !== sheet.matId));
        }
    };
    const handleRemoveSheetFromPlan = (matId) => {
        setSelectedSheets(prev => prev.filter(s => s.matId !== matId));
        const sheetToReturn = selectedSheets.find(s => s.matId === matId);
        if (sheetToReturn) setAvailableSheets(prev => [...prev, sheetToReturn]);
    };

    const handleCreatePlan = async () => {
        if (!newPlanData.planName || selectedSheets.length === 0) { setError('Необходимо указать название плана и выбрать хотя бы один лист.'); return; }
        setIsCreating(true); setError('');
        try {
            const requestPayload = { ...newPlanData, matIds: selectedSheets.map(s => s.matId) };
            const response = await api.post('/annealingbatchplan', requestPayload);
            await updateSheetStatus(requestPayload.matIds, `В плане закалки "${response.data.planName}"`);
            handleCloseCreateDialog(); fetchPlans();
            alert('План закалки создан успешно.');
        } catch (err) { setError(err.response?.data?.message || err.message || 'Ошибка при создании плана.'); } 
        finally { setIsCreating(false); }
    };

    // --- ДИАЛОГ РЕДАКТИРОВАНИЯ ---
    const handleOpenEditDialog = async (plan) => {
        if (plan.status !== 'Создан') { alert(`Редактирование возможно только для планов со статусом 'Создан'.`); return; }
        setPlanToEdit(plan);
        setEditPlanData({
            planName: plan.planName || '', furnaceNumber: plan.furnaceNumber || '',
            scheduledStartTime: plan.scheduledStartTime || '', scheduledEndTime: plan.scheduledEndTime || '', notes: plan.notes || ''
        });
        setEditSheetFilters({ meltNumber: '', batchNumber: '', packNumber: '', sheetNumber: '', steelGrade: '' });
        setLoadingEditingSheets(true); setError('');
        try {
            const planDetailsResponse = await api.get(`/annealingbatchplan/${plan.planId}/details`);
            const planSheets = planDetailsResponse.data.sheets || [];
            setEditingSelectedSheets(planSheets);
            
            const availableResponse = await api.get('/inputdata/for-annealing-plan', { params: { page: 1, pageSize: 50 } });
            let allAvailable = availableResponse.data.data || [];
            const availableFiltered = allAvailable.filter(availSheet => !planSheets.some(planSheet => planSheet.matId === availSheet.matId));
            setEditingAvailableSheets(availableFiltered);
        } catch (err) { setError('Ошибка при загрузке листов для редактирования.'); } 
        finally { setLoadingEditingSheets(false); setOpenEditDialog(true); }
    };
    const handleCloseEditDialog = () => { setOpenEditDialog(false); setPlanToEdit(null); setEditingAvailableSheets([]); setEditingSelectedSheets([]); setIsEditing(false); setError(''); };
    const handleEditPlanDataChange = (field, value) => setEditPlanData(prev => ({ ...prev, [field]: value }));

    // Обработчики кнопок + и - для редактирования
    const handleAddSheetToEditingPlan = (sheet) => {
        if (!editingSelectedSheets.some(s => s.matId === sheet.matId)) {
            setEditingSelectedSheets(prev => [...prev, sheet]);
            setEditingAvailableSheets(prev => prev.filter(s => s.matId !== sheet.matId));
        }
    };

    const handleRemoveSheetFromEditingPlan = (matId) => {
        setEditingSelectedSheets(prev => prev.filter(s => s.matId !== matId));
        const sheetToReturn = editingSelectedSheets.find(s => s.matId === matId);
        if (sheetToReturn) {
            setEditingAvailableSheets(prev => [...prev, sheetToReturn]);
        }
    };

    const onEditDragEnd = (result) => {
        const { destination, source } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId) {
            const items = source.droppableId === 'editing-available-sheets-list' ? [...editingAvailableSheets] : [...editingSelectedSheets];
            const [reorderedItem] = items.splice(source.index, 1); items.splice(destination.index, 0, reorderedItem);
            if (source.droppableId === 'editing-available-sheets-list') setEditingAvailableSheets(items); else setEditingSelectedSheets(items);
        } else {
            const sourceItems = source.droppableId === 'editing-available-sheets-list' ? [...editingAvailableSheets] : [...editingSelectedSheets];
            const destItems = destination.droppableId === 'editing-available-sheets-list' ? [...editingAvailableSheets] : [...editingSelectedSheets];
            const [movedItem] = sourceItems.splice(source.index, 1); destItems.splice(destination.index, 0, movedItem);
            if (source.droppableId === 'editing-available-sheets-list') { setEditingAvailableSheets(sourceItems); setEditingSelectedSheets(destItems); }
            else { setEditingSelectedSheets(sourceItems); setEditingAvailableSheets(destItems); }
        }
    };

    const handleEditPlan = async () => {
        if (!planToEdit || editingSelectedSheets.length === 0) { setError('Необходимо выбрать хотя бы один лист.'); return; }
        setIsEditing(true); setError('');
        try {
            const payload = { ...editPlanData, matIds: editingSelectedSheets.map(s => s.matId) };
            await api.put(`/annealingbatchplan/${planToEdit.planId}`, payload);
            handleCloseEditDialog(); fetchPlans(); alert('План обновлён.');
        } catch (err) { setError(err.response?.data?.message || 'Ошибка при редактировании.'); } 
        finally { setIsEditing(false); }
    };

    // --- ОСТАЛЬНЫЕ ОБРАБОТЧИКИ ---
    const handleOpenDetails = (id) => { setSelectedPlanId(id); setIsDetailsOpen(true); };
    const handleCloseDetails = () => { setIsDetailsOpen(false); setSelectedPlanId(null); };
    
    const handleOpenUpdateDialog = (plan) => {
        setPlanToUpdate(plan);
        setUpdateStatusData({ status: plan.status || '', actualStartTime: plan.actualStartTime || '', actualEndTime: plan.actualEndTime || '', comment: '' });
        setOpenUpdateDialog(true);
    };
    const handleCloseUpdateDialog = () => { setOpenUpdateDialog(false); setPlanToUpdate(null); setIsUpdating(false); setError(''); };
    const handleUpdateStatusDataChange = (field, value) => setUpdateStatusData(prev => ({ ...prev, [field]: value }));
    
    const handleUpdatePlanStatus = async () => {
        if (!planToUpdate || !updateStatusData.status) { setError('Необходимо выбрать статус.'); return; }
        setIsUpdating(true); setError('');
        try {
            const payload = { status: updateStatusData.status };
            if (updateStatusData.actualStartTime) payload.actualStartTime = updateStatusData.actualStartTime;
            if (updateStatusData.actualEndTime) payload.actualEndTime = updateStatusData.actualEndTime;
            await api.put(`/annealingbatchplan/${planToUpdate.planId}/status`, payload);
            handleCloseUpdateDialog(); fetchPlans(); alert('Статус обновлён.');
        } catch (err) { setError(err.response?.data?.message || 'Ошибка обновления статуса.'); } 
        finally { setIsUpdating(false); }
    };

    const handleOpenDeleteDialog = (plan) => { setPlanToDelete(plan); setOpenDeleteDialog(true); };
    const handleCloseDeleteDialog = () => { setOpenDeleteDialog(false); setPlanToDelete(null); setIsDeleting(false); setError(''); };
    
    const handleDeletePlan = async () => {
        if (!planToDelete) return;
        setIsDeleting(true); setError('');
        try {
            const planDetailsResponse = await api.get(`/annealingbatchplan/${planToDelete.planId}/details`);
            const planDetails = planDetailsResponse.data;
            await api.delete(`/annealingbatchplan/${planToDelete.planId}`);
            if (planDetails.status === 'Создан') {
                const matIdsToRemove = planDetails.sheets.map(s => s.matId);
                await updateSheetStatus(matIdsToRemove, 'Подготовлен к прокату');
            }
            handleCloseDeleteDialog(); fetchPlans(); alert('План удалён.');
        } catch (err) { setError('Ошибка удаления плана.'); } 
        finally { setIsDeleting(false); }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Создан': return 'default'; case 'Готов к работе': return 'info';
            case 'В работе': return 'warning'; case 'Завершён': return 'success';
            case 'Прерван': return 'error'; case 'Отменён': return 'secondary'; default: return 'default';
        }
    };

    // Компонент фильтров
    

    return (
        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h5" gutterBottom>План закалки листов (Групповой)</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>Создать план</Button>
                </Box>

                <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Grid container spacing={2} alignItems="flex-end">
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="Статус плана" select value={filters.statusFilter} onChange={(e) => handleFilterChange('statusFilter', e.target.value)} size="small" fullWidth>
                                <MenuItem value="">Все</MenuItem>
                                {possibleExecutionStatuses.map((status) => (<MenuItem key={status} value={status}>{status}</MenuItem>))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClearFilters} fullWidth>Сбросить</Button>
                        </Grid>
                    </Grid>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                {loading ? (
                    <Box display="flex" justifyContent="center" minHeight="200px"><CircularProgress /></Box>
                ) : (
                    <>
                        <TableContainer component={Paper}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>ID</TableCell><TableCell>Название</TableCell><TableCell>Статус</TableCell>
                                        <TableCell>Печь</TableCell><TableCell>Запл. начало</TableCell><TableCell>Запл. окончание</TableCell>
                                        <TableCell>Примечания</TableCell><TableCell>Листы</TableCell><TableCell>Действия</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {plans.map((plan) => (
                                        <TableRow key={plan.planId}>
                                            <TableCell>{plan.planId}</TableCell>
                                            <TableCell>{plan.planName}</TableCell>
                                            <TableCell><Chip label={plan.status} color={getStatusColor(plan.status)} size="small" /></TableCell>
                                            <TableCell>{plan.furnaceNumber || 'N/A'}</TableCell>
                                            <TableCell>{formatDisplayDate(plan.scheduledStartTime)}</TableCell>
                                            <TableCell>{formatDisplayDate(plan.scheduledEndTime)}</TableCell>
                                            <TableCell>{plan.notes || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Accordion disableGutters sx={{ boxShadow: 'none', border: '1px solid rgba(0, 0, 0, .125)' }}>
                                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                        <Typography variant="body2">{plan.linkedSheets?.length || 0} листов</Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        <List dense>
                                                            {plan.linkedSheets && plan.linkedSheets.length > 0 ? (
                                                                plan.linkedSheets.map((link, index) => (
                                                                    <ListItem key={index}>
                                                                        <ListItemText
                                                                            primary={link.sheet?.matId || link.matId}
                                                                            secondary={`${link.sheet?.status || 'N/A'} | ${link.sheet?.meltNumber || 'N/A'}`}
                                                                        />
                                                                    </ListItem>
                                                                ))
                                                            ) : (
                                                                <ListItem><ListItemText primary="Нет листов" /></ListItem>
                                                            )}
                                                        </List>
                                                    </AccordionDetails>
                                                </Accordion>
                                            </TableCell>
                                            <TableCell>
                                                <IconButton size="small" onClick={() => handleOpenUpdateDialog(plan)} color="primary"><CheckCircleIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" onClick={() => handleOpenDetails(plan.planId)} color="primary"><RoomService fontSize="small" /></IconButton>
                                                <IconButton size="small" onClick={() => handleOpenEditDialog(plan)} color="warning" disabled={plan.status !== 'Создан'}><EditIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" onClick={() => handleOpenDeleteDialog(plan)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                            <TextField select label="На странице" value={pageSize} onChange={handlePageSizeChange} size="small" sx={{ minWidth: 100 }}>
                                {[5, 10, 25, 50].map((size) => (<MenuItem key={size} value={size}>{size}</MenuItem>))}
                            </TextField>
                            <Pagination count={Math.ceil(totalCount / pageSize)} page={page} onChange={handlePageChange} color="primary" size="small" />
                        </Box>
                    </>
                )}
            </Paper>

            {/* --- ДИАЛОГ СОЗДАНИЯ (УВЕЛИЧЕН) --- */}
            <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog} maxWidth="xl" fullWidth PaperProps={{ sx: { minHeight: '85vh' } }}>
                <DialogTitle>Создать новый план закалки</DialogTitle>
                <DialogContent dividers>
                    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                    
                    <Box display="flex" flexDirection="column" gap={2} mb={2}>
                        <TextField label="Название плана" value={newPlanData.planName} onChange={(e) => handleNewPlanDataChange('planName', e.target.value)} size="small" required fullWidth />
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}><TextField label="Номер печи" value={newPlanData.furnaceNumber} onChange={(e) => handleNewPlanDataChange('furnaceNumber', e.target.value)} size="small" fullWidth /></Grid>
                            <Grid item xs={12} sm={4}><TextField label="Запл. начало" type="datetime-local" value={formatForInput(newPlanData.scheduledStartTime)} onChange={(e) => handleNewPlanDataChange('scheduledStartTime', e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} /></Grid>
                            <Grid item xs={12} sm={4}><TextField label="Запл. окончание" type="datetime-local" value={formatForInput(newPlanData.scheduledEndTime)} onChange={(e) => handleNewPlanDataChange('scheduledEndTime', e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} /></Grid>
                        </Grid>
                        <TextField label="Примечания" value={newPlanData.notes} onChange={(e) => handleNewPlanDataChange('notes', e.target.value)} size="small" multiline rows={2} fullWidth />
                    </Box>

                    <DragDropContext onDragEnd={onDragEnd}>
                        <Box display="flex" gap={2} minHeight="60vh">
                            <Card sx={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column' }}>
                                <CardHeader title={`Доступные листы (${availableSheets.length})`} sx={{ pb: 0 }} />
                                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                    <SheetFiltersUI filtersState={createSheetFilters} setFiltersState={setCreateSheetFilters} onApply={handleApplyCreateFilters} onClear={handleClearCreateFilters} />
                                </Box>
                                <CardContent sx={{ p: 1, flex: 1, overflow: 'auto' }}>
                                    {loadingAvailable ? (
                                        <Box display="flex" justifyContent="center" height="100%"><CircularProgress size={24} /></Box>
                                    ) : (
                                        <Droppable droppableId="available-sheets-list">
                                            {(provided) => (
                                                <List {...provided.droppableProps} ref={provided.innerRef} dense sx={{ bgcolor: 'background.paper' }}>
                                                    {availableSheets.map((sheet, index) => (
                                                        <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                                            {(provided) => (
                                                                <div ref={provided.innerRef} {...provided.draggableProps}>
                                                                    <ListItem {...provided.dragHandleProps} secondaryAction={
                                                                        <Tooltip title="Добавить в план"><IconButton edge="end" size="small" onClick={() => handleAddSheetToPlan(sheet)}><AddIcon /></IconButton></Tooltip>
                                                                    }>
                                                                        <ListItemText primary={
                                                                            <Typography variant="body2">
                                                                                <strong>ID:</strong> {sheet.matId} | <strong>Сталь:</strong> {sheet.steelGrade}<br/>
                                                                                <strong>Плавка:</strong> {sheet.meltNumber} | <strong>Партия:</strong> {sheet.batchNumber} | <strong>Пачка:</strong> {sheet.packNumber} | <strong>№:</strong> {sheet.sheetNumber}
                                                                            </Typography>
                                                                        } />
                                                                    </ListItem>
                                                                    {provided.placeholder}
                                                                </div>
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

                            <Card sx={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column' }}>
                                <CardHeader title={`Листы в плане (${selectedSheets.length})`} subheader={newPlanData.planName || 'Без названия'} sx={{ pb: 0 }} />
                                <CardContent sx={{ p: 1, flex: 1, overflow: 'auto' }}>
                                    <Droppable droppableId="selected-sheets-list">
                                        {(provided) => (
                                            <List {...provided.droppableProps} ref={provided.innerRef} dense sx={{ bgcolor: 'background.paper' }}>
                                                {selectedSheets.map((sheet, index) => (
                                                    <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                                        {(provided) => (
                                                            <div ref={provided.innerRef} {...provided.draggableProps}>
                                                                <ListItem {...provided.dragHandleProps} secondaryAction={
                                                                    <Tooltip title="Удалить"><IconButton edge="end" size="small" onClick={() => handleRemoveSheetFromPlan(sheet.matId)}><DeleteIcon /></IconButton></Tooltip>
                                                                }>
                                                                    <ListItemText primary={
                                                                        <Typography variant="body2">
                                                                            <strong>ID:</strong> {sheet.matId} | <strong>Сталь:</strong> {sheet.steelGrade}<br/>
                                                                            <strong>Плавка:</strong> {sheet.meltNumber} | <strong>Партия:</strong> {sheet.batchNumber}
                                                                        </Typography>
                                                                    } />
                                                                </ListItem>
                                                                {provided.placeholder}
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </List>
                                        )}
                                    </Droppable>
                                </CardContent>
                            </Card>
                        </Box>
                    </DragDropContext>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseCreateDialog}>Отмена</Button>
                    <Button onClick={handleCreatePlan} variant="contained" disabled={isCreating}>{isCreating ? 'Создание...' : 'Создать план'}</Button>
                </DialogActions>
            </Dialog>

            {/* --- ДИАЛОГ РЕДАКТИРОВАНИЯ (УВЕЛИЧЕН, С КНОПКАМИ +/-) --- */}
            <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="xl" fullWidth PaperProps={{ sx: { minHeight: '85vh' } }}>
                <DialogTitle>Редактировать план "{planToEdit?.planName}"</DialogTitle>
                <DialogContent dividers>
                    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                    {planToEdit?.status !== 'Создан' && <Alert severity="warning" sx={{ mb: 2 }}>Редактирование возможно только для планов со статусом "Создан".</Alert>}
                    
                    <Box display="flex" flexDirection="column" gap={2} mb={2}>
                        <TextField label="Название плана" value={editPlanData.planName} onChange={(e) => handleEditPlanDataChange('planName', e.target.value)} size="small" required fullWidth disabled={planToEdit?.status !== 'Создан'} />
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}><TextField label="Номер печи" value={editPlanData.furnaceNumber} onChange={(e) => handleEditPlanDataChange('furnaceNumber', e.target.value)} size="small" fullWidth disabled={planToEdit?.status !== 'Создан'} /></Grid>
                            <Grid item xs={12} sm={4}><TextField label="Запл. начало" type="datetime-local" value={formatForInput(editPlanData.scheduledStartTime)} onChange={(e) => handleEditPlanDataChange('scheduledStartTime', e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} disabled={planToEdit?.status !== 'Создан'} /></Grid>
                            <Grid item xs={12} sm={4}><TextField label="Запл. окончание" type="datetime-local" value={formatForInput(editPlanData.scheduledEndTime)} onChange={(e) => handleEditPlanDataChange('scheduledEndTime', e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} disabled={planToEdit?.status !== 'Создан'} /></Grid>
                        </Grid>
                        <TextField label="Примечания" value={editPlanData.notes} onChange={(e) => handleEditPlanDataChange('notes', e.target.value)} size="small" multiline rows={2} fullWidth disabled={planToEdit?.status !== 'Создан'} />
                    </Box>

                    <DragDropContext onDragEnd={onEditDragEnd}>
                        <Box display="flex" gap={2} minHeight="60vh">
                            <Card sx={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column' }}>
                                <CardHeader title={`Доступные листы (${editingAvailableSheets.length})`} sx={{ pb: 0 }} />
                                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                    <SheetFiltersUI filtersState={editSheetFilters} setFiltersState={setEditSheetFilters} onApply={handleApplyEditFilters} onClear={handleClearEditFilters} />
                                </Box>
                                <CardContent sx={{ p: 1, flex: 1, overflow: 'auto' }}>
                                    {loadingEditingSheets ? <CircularProgress /> : (
                                        <Droppable droppableId="editing-available-sheets-list">
                                            {(provided) => (
                                                <List {...provided.droppableProps} ref={provided.innerRef} dense>
                                                    {editingAvailableSheets.map((sheet, index) => (
                                                        <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                                            {(provided) => (
                                                                <div ref={provided.innerRef} {...provided.draggableProps}>
                                                                    <ListItem {...provided.dragHandleProps} secondaryAction={
                                                                        <Tooltip title="Добавить в план">
                                                                            <IconButton edge="end" size="small" onClick={() => handleAddSheetToEditingPlan(sheet)}><AddIcon /></IconButton>
                                                                        </Tooltip>
                                                                    }>
                                                                        <ListItemText primary={<Typography variant="body2"><strong>ID:</strong> {sheet.matId} | <strong>Сталь:</strong> {sheet.steelGrade}<br/><strong>Плавка:</strong> {sheet.meltNumber} | <strong>Партия:</strong> {sheet.batchNumber}</Typography>} />
                                                                    </ListItem>
                                                                    {provided.placeholder}
                                                                </div>
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

                            <Card sx={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', bgcolor: 'lightblue' }}>
                                <CardHeader title={`Листы в плане (${editingSelectedSheets.length})`} sx={{ pb: 0 }} />
                                <CardContent sx={{ p: 1, flex: 1, overflow: 'auto' }}>
                                    <Droppable droppableId="editing-selected-sheets-list">
                                        {(provided) => (
                                            <List {...provided.droppableProps} ref={provided.innerRef} dense>
                                                {editingSelectedSheets.map((sheet, index) => (
                                                    <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                                        {(provided) => (
                                                            <div ref={provided.innerRef} {...provided.draggableProps}>
                                                                <ListItem {...provided.dragHandleProps} secondaryAction={
                                                                    <Tooltip title="Удалить из плана">
                                                                        <IconButton edge="end" size="small" onClick={() => handleRemoveSheetFromEditingPlan(sheet.matId)}><DeleteIcon /></IconButton>
                                                                    </Tooltip>
                                                                }>
                                                                    <ListItemText primary={<Typography variant="body2"><strong>ID:</strong> {sheet.matId} | <strong>Сталь:</strong> {sheet.steelGrade}<br/><strong>Плавка:</strong> {sheet.meltNumber} | <strong>Партия:</strong> {sheet.batchNumber}</Typography>} />
                                                                </ListItem>
                                                                {provided.placeholder}
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </List>
                                        )}
                                    </Droppable>
                                </CardContent>
                            </Card>
                        </Box>
                    </DragDropContext>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditDialog}>Отмена</Button>
                    <Button onClick={handleEditPlan} variant="contained" disabled={isEditing || planToEdit?.status !== 'Создан'}>{isEditing ? 'Сохранение...' : 'Сохранить изменения'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openUpdateDialog} onClose={handleCloseUpdateDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Отметить статус выполнения для плана "{planToUpdate?.planName}"</DialogTitle>
                <DialogContent dividers>
                    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                    {planToUpdate && (
                        <Box display="flex" flexDirection="column" gap={2}>
                            <Typography variant="body2">Текущий статус: <strong>{planToUpdate.status}</strong></Typography>
                            <FormControl fullWidth size="small">
                                <InputLabel>Новый статус</InputLabel>
                                <Select value={updateStatusData.status} label="Новый статус" onChange={(e) => handleUpdateStatusDataChange('status', e.target.value)}>
                                    {possibleExecutionStatuses.map((status) => (<MenuItem key={status} value={status}>{status}</MenuItem>))}
                                </Select>
                            </FormControl>
                            {updateStatusData.status === 'В работе' && <TextField label="Фактическое начало" type="datetime-local" value={formatForInput(updateStatusData.actualStartTime)} onChange={(e) => handleUpdateStatusDataChange('actualStartTime', e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} />}
                            {(updateStatusData.status === 'Завершён' || updateStatusData.status === 'Прерван') && <TextField label="Фактическое окончание" type="datetime-local" value={formatForInput(updateStatusData.actualEndTime)} onChange={(e) => handleUpdateStatusDataChange('actualEndTime', e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} />}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseUpdateDialog}>Отмена</Button>
                    <Button onClick={handleUpdatePlanStatus} variant="contained" disabled={isUpdating}>{isUpdating ? 'Сохранение...' : 'Отметить'}</Button>
                </DialogActions>
            </Dialog>

            <PlanDetailsDialog open={isDetailsOpen} planId={selectedPlanId} onClose={handleCloseDetails} />

            <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
                <DialogTitle>Подтвердите удаление</DialogTitle>
                <DialogContent>
                    <DialogContentText>Вы уверены, что хотите удалить план <strong>{planToDelete?.planName}</strong>?</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog}>Отмена</Button>
                    <Button onClick={handleDeletePlan} color="error" disabled={isDeleting}>{isDeleting ? 'Удаление...' : 'Удалить'}</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default AnnealingBatchPlanPage;