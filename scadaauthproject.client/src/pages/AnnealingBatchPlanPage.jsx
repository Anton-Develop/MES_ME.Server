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
    Autocomplete, // Для поиска листа по MatId (может быть не использован в новом DnD интерфейсе, но оставим для возможного поиска в списке)
    Pagination, // Для пагинации
    Grid, // Для фильтров
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemText,
    Card,
    CardHeader,
    CardContent,
    ListItemSecondaryAction,
} from '@mui/material';
import {
    Add as AddIcon,
    Save as SaveIcon,
    Close as CloseIcon,
    Edit as EditIcon,
    CheckCircle as CheckCircleIcon,
    RoomService as RoomService,
    Clear as ClearIcon,
    ExpandMore as ExpandMoreIcon,
    Delete as DeleteIcon, // Импортируем иконку удаления для кнопки в списке
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; // Импортируем DnD
import api from '../api';
import PlanDetailsDialog from './PlanDetailsDialog';

const AnnealingBatchPlanPage = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    // Новый стейт для диалога
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    // Состояния для фильтров
    const [filters, setFilters] = useState({
        statusFilter: '',
        furnaceNumberFilter: '',
    });

    // --- НОВЫЕ СОСТОЯНИЯ ДЛЯ УПРАВЛЕНИЯ ЛИСТАМИ В ДИАЛОГЕ ---
    const [availableSheets, setAvailableSheets] = useState([]); // Список доступных листов
    const [selectedSheets, setSelectedSheets] = useState([]); // Список выбранных листов для плана
    const [loadingAvailable, setLoadingAvailable] = useState(false); // Для спиннера загрузки доступных

    // Состояния для создания нового плана
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [newPlanData, setNewPlanData] = useState({
        planName: '',
        furnaceNumber: '',
        scheduledStartTime: '',
        scheduledEndTime: '',
        notes: '',
    });
    const [newPlanMatIds, setNewPlanMatIds] = useState([]); // Теперь не используется напрямую для DnD, но может быть вспомогательным
    const [availableSheetsForAutocomplete, setAvailableSheetsForAutocomplete] = useState([]); // Для Autocomplete (если используется)
    const [loadingSheetsForAutocomplete, setLoadingSheetsForAutocomplete] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Состояния для обновления статуса плана
    const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
    const [planToUpdate, setPlanToUpdate] = useState(null);
    const [updateStatusData, setUpdateStatusData] = useState({
        status: '',
        actualStartTime: '', // <-- Новое состояние для фактического начала
        actualEndTime: '',   // <-- Новое состояние для фактического окончания
        comment: '', // Комментарий не используется в этом API, но можно добавить поле в Notes или отдельно
    });
    const [isUpdating, setIsUpdating] = useState(false);

    // Состояния для удаления плана
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [planToDelete, setPlanToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // --- Состояния и функции для редактирования (ОБНОВЛЕННЫЕ) ---
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [planToEdit, setPlanToEdit] = useState(null);
    const [editPlanData, setEditPlanData] = useState({
        planName: '',
        furnaceNumber: '',
        scheduledStartTime: '',
        scheduledEndTime: '',
        notes: ''
    });

    // --- НОВЫЕ СОСТОЯНИЯ ДЛЯ УПРАВЛЕНИЯ ЛИСТАМИ В ДИАЛОГЕ РЕДАКТИРОВАНИЯ ---
    const [editingAvailableSheets, setEditingAvailableSheets] = useState([]);
    const [editingSelectedSheets, setEditingSelectedSheets] = useState([]);
    const [loadingEditingSheets, setLoadingEditingSheets] = useState(false); // Для спиннера загрузки листов при редактировании

    const handleOpenEditDialog = async (plan) => {
        console.log("handleOpenEditDialog вызван с:", plan.planName); // <-- Логируем полученный объект
        if (plan.status !== 'Создан') {
            alert(`Невозможно редактировать план "${plan.planName}", так как его статус '${plan.status}'. Редактирование возможно только для планов со статусом 'Создан'.`);
            return;
        }

        setPlanToEdit(plan);
        // Инициализируем форму текущими значениями плана
        setEditPlanData({
            planName: plan.planName || '',
            furnaceNumber: plan.furnaceNumber || '',
            scheduledStartTime: plan.scheduledStartTime || '',
            scheduledEndTime: plan.scheduledEndTime || '',
            notes: plan.notes || ''
        });

        // --- ЗАГРУЗКА ЛИСТОВ ДЛЯ ДИАЛОГА РЕДАКТИРОВАНИЯ ---
        setLoadingEditingSheets(true);
        setError(''); // Очищаем предыдущую ошибку
        try {
            // 1. Загрузить все доступные листы (так же, как в create)
            const availableResponse = await api.get('/inputdata/for-annealing-plan', { params: { page: 1, pageSize: 50 } });
            let allAvailable = availableResponse.data.data || [];

            // 2. Загрузить листы, уже входящие в этот конкретный план (используем существующий endpoint)
            const planDetailsResponse = await api.get(`/annealingbatchplan/${plan.planId}/details`);
            const planSheets = planDetailsResponse.data.sheets || [];

            // 3. Исключить листы, уже находящиеся в этом плане, из списка доступных
            const availableFiltered = allAvailable.filter(availSheet =>
                !planSheets.some(planSheet => planSheet.matId === availSheet.matId)
            );

            // 4. Установить состояния
            setEditingAvailableSheets(availableFiltered);
            setEditingSelectedSheets(planSheets); // Устанавливаем листы, которые уже в плане

        } catch (err) {
            console.error('Ошибка загрузки листов для редактирования плана:', err);
            setError(err.response?.data?.message || err.message || 'Ошибка при загрузке листов для редактирования.');
            setEditingAvailableSheets([]);
            setEditingSelectedSheets([]);
        } finally {
            setLoadingEditingSheets(false);
        }

        setOpenEditDialog(true);
    };

    const handleCloseEditDialog = () => {
        setOpenEditDialog(false);
        setPlanToEdit(null);
        setEditPlanData({
            planName: '',
            furnaceNumber: '',
            scheduledStartTime: '',
            scheduledEndTime: '',
            notes: ''
        });
        setEditingAvailableSheets([]);
        setEditingSelectedSheets([]);
        setIsEditing(false);
        setError(''); // Очистим ошибку при закрытии
    };

    const [isEditing, setIsEditing] = useState(false);

    const handleEditPlanDataChange = (field, value) => {
        setEditPlanData(prev => ({ ...prev, [field]: value }));
    };

    // --- НОВЫЕ ОБРАБОТЧИКИ ДЛЯ DND В ДИАЛОГЕ РЕДАКТИРОВАНИЯ ---
    const onEditDragEnd = (result) => {
        const { destination, source } = result;

        if (!destination) return;

        if (destination.droppableId === source.droppableId) {
            // Переупорядочивание внутри одного списка (опционально, можно не реализовывать)
            const items = source.droppableId === 'editing-available-sheets-list' ? [...editingAvailableSheets] : [...editingSelectedSheets];
            const [reorderedItem] = items.splice(source.index, 1);
            items.splice(destination.index, 0, reorderedItem);

            if (source.droppableId === 'editing-available-sheets-list') {
                setEditingAvailableSheets(items);
            } else {
                setEditingSelectedSheets(items);
            }
        } else {
            // Перемещение между списками
            const sourceItems = source.droppableId === 'editing-available-sheets-list' ? [...editingAvailableSheets] : [...editingSelectedSheets];
            const destItems = destination.droppableId === 'editing-available-sheets-list' ? [...editingAvailableSheets] : [...editingSelectedSheets];

            const [movedItem] = sourceItems.splice(source.index, 1);
            destItems.splice(destination.index, 0, movedItem);

            if (source.droppableId === 'editing-available-sheets-list') {
                setEditingAvailableSheets(sourceItems);
                setEditingSelectedSheets(destItems);
            } else {
                setEditingSelectedSheets(sourceItems);
                setEditingAvailableSheets(destItems);
            }
        }
    };
    // --- АЛЬТЕРНАТИВНЫЕ ОБРАБОТЧИКИ ДЛЯ КНОПОК (Если DnD не нужен) ---
    // const handleAddSheetToEditingPlan = (sheet) => {
    //   if (!editingSelectedSheets.some(s => s.matId === sheet.matId)) {
    //     setEditingSelectedSheets(prev => [...prev, sheet]);
    //     setEditingAvailableSheets(prev => prev.filter(s => s.matId !== sheet.matId));
    //   }
    // };

    // const handleRemoveSheetFromEditingPlan = (matId) => {
    //   setEditingSelectedSheets(prev => prev.filter(s => s.matId !== matId));
    //   const sheetToReturn = editingSelectedSheets.find(s => s.matId === matId);
    //   if (sheetToReturn) {
   // AvailableSheets(prev => [...prev, sheetToReturn]);
    //   }
    // };
    const handleEditPlan = async () => {
        if (!planToEdit) return;

        // Проверим, что план можно редактировать (статус "Создан")
        if (planToEdit.status !== 'Создан') {
            setError(`Невозможно редактировать план "${planToEdit.planName}", так как его статус '${planToEdit.status}'. Редактирование возможно только для планов со статусом 'Создан'.`);
            return;
        }

        // Проверим, выбраны ли листы
        if (editingSelectedSheets.length === 0) {
            setError('Необходимо выбрать хотя бы один лист для плана.');
            return;
        }

        setIsEditing(true);
        setError('');
        try {
            // Подготовим данные для отправки
            const payload = { ...editPlanData }; // Основные данные плана
            payload.matIds = editingSelectedSheets.map(s => s.matId); // Список MatId листов, которые должны быть в плане

            await api.put(`/annealingbatchplan/${planToEdit.planId}`, payload);

            handleCloseEditDialog();
            fetchPlans(); // Обновить список планов
            alert(`План закалки "${planToEdit.planName}" обновлён.`);
        } catch (err) {
            console.error('Ошибка редактирования плана закалки:', err);
            console.error('Response data:', err.response?.data);
            console.error('Response status:', err.response?.status);
            setError(err.response?.data?.message || err.message || 'Ошибка при редактировании плана закалки.');
        } finally {
            setIsEditing(false);
        }
    };

    // Обработчик клика по строке или кнопке "Отчет"
    const handleOpenDetails = (id) => {
        console.log("Открываем отчет для плана:", id);
        setSelectedPlanId(id);
        setIsDetailsOpen(true);
    };

    const handleCloseDetails = () => {
        setIsDetailsOpen(false);
        setSelectedPlanId(null);
    };

    // Возможные статусы выполнения плана
    const possibleExecutionStatuses = [
        'Создан',
        'Готов к работе',
        'В работе',
        'Завершён',
        'Прерван',
        'Отменён',
    ];

    // Возможные типы печей
    const possibleFurnaceTypes = ['Закалочная'];

    // Загрузка списка планов
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
            Object.keys(params).forEach(key => (params[key] === '' || params[key] === null) && delete params[key]);

            const response = await api.get('/annealingbatchplan', { params });
            setPlans(response.data.data);
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
            const response = await api.get('/inputdata', { params: { page: 1, pageSize: 1000 } }); // Пример с большим pageSize
            const allSheets = response.data.data.map(s => ({ label: s.matId, value: s.matId }));
            // Фильтруем на клиенте по вводу, если inputValue есть
            if (inputValue) {
                setAvailableSheetsForAutocomplete(allSheets.filter(s => s.label.toLowerCase().includes(inputValue.toLowerCase())));
            } else {
                setAvailableSheetsForAutocomplete(allSheets);
            }
        } catch (err) {
            console.error('Ошибка загрузки листов для Autocomplete:', err);
            setAvailableSheetsForAutocomplete([]);
        } finally {
            setLoadingSheetsForAutocomplete(false);
        }
    };

    // --- НОВАЯ ФУНКЦИЯ: Загрузка доступных листов ---
    const fetchAvailableSheets = async (page = 1, searchParams = {}) => {
        setLoadingAvailable(true);
        setError('');
        try {
            // ИСПОЛЬЗУЕМ НОВЫЙ ЭНДПОИНТ, КОТОРЫЙ ВОЗВРАЩАЕТ ТОЛЬКО ЛИСТЫ СО СТАТУСОМ "Подготовлен к прокату"
            // Добавляем к параметрам фильтрации статус "Подготовлен к прокату"
            // В новом эндпоинте этот статус уже зашит, но параметры searchParams могут добавлять другие фильтры
            const response = await api.get('/inputdata/for-annealing-plan', { params: { page, pageSize: 50, ...searchParams } });
            // Больше не нужно фильтровать на клиенте по статусу "Подготовлен к прокату", так как API уже вернул правильный список
            const available = response.data.data;
            setAvailableSheets(available);
        } catch (err) {
            console.error('Ошибка загрузки доступных листов для плана закалки:', err);
            setError(err.response?.data?.message || err.message || 'Ошибка при загрузке доступных листов для плана закалки.');
            setAvailableSheets([]);
        } finally {
            setLoadingAvailable(false);
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

    // --- Обработчики для создания нового плана ---

    const updateSheetStatus = async (matIds, newStatus) => {
        try {
            await api.put('/inputdata/update-status', {
                matIds: matIds,
                newStatus: newStatus
            });
            // console.log(`Статус обновлён для ${matIds.length} листов на '${newStatus}'`);
            // Можно добавить опциональный успех, если нужно показать пользователю
        } catch (err) {
            console.error(`Ошибка обновления статуса листов в '${newStatus}':`, err);
            // Важно: не блокировать основной процесс (создание/удаление плана) из-за этой ошибки,
            // но стоит логировать её. В реальной системе можно показать предупреждение.
            // setError(err.response?.data?.message || err.message || `Ошибка при обновлении статуса листов в '${newStatus}'.`);
        }
    };

    // Обработчик открытия диалога создания (обновлён)
    const handleOpenCreateDialog = () => {
        const now = new Date();
        const formattedNow = now.toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        setNewPlanData({
            planName: '',
            furnaceNumber: '1',
            scheduledStartTime: '',
            scheduledEndTime: '',
            actualStartTime: '', // <-- Инициализация нового поля
            actualEndTime: '',   // <-- Инициализация нового поля
            notes: '',
        });
        // Очищаем списки листов при открытии
        setAvailableSheets([]);
        setSelectedSheets([]);
        setOpenCreateDialog(true);
        // Загружаем доступные листы при открытии диалога
        fetchAvailableSheets(1);
    };

    const handleCloseCreateDialog = () => {
        setOpenCreateDialog(false);
        setIsCreating(false);
        setError(''); // Очистим ошибку при закрытии
    };

    const handleNewPlanDataChange = (field, value) => {
        setNewPlanData(prev => ({ ...prev, [field]: value }));
    };

    // --- НОВЫЕ ОБРАБОТЧИКИ ДЛЯ DND ---

    // Обработчик Drag-and-Drop
    const onDragEnd = (result) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;

        if (destination.droppableId === source.droppableId) {
            // Переупорядочивание внутри одного списка
            const items = source.droppableId === 'available-sheets-list' ? [...availableSheets] : [...selectedSheets];
            const [reorderedItem] = items.splice(source.index, 1);
            items.splice(destination.index, 0, reorderedItem);

            if (source.droppableId === 'available-sheets-list') {
                setAvailableSheets(items);
            } else {
                setSelectedSheets(items);
            }
            return;
        }

        // Перемещение между списками
        const sourceItems = source.droppableId === 'available-sheets-list' ? [...availableSheets] : [...selectedSheets];
        const destItems = destination.droppableId === 'available-sheets-list' ? [...availableSheets] : [...selectedSheets];

        const [movedItem] = sourceItems.splice(source.index, 1);
        destItems.splice(destination.index, 0, movedItem);

        if (source.droppableId === 'available-sheets-list') {
            setAvailableSheets(sourceItems);
            setSelectedSheets(destItems);
        } else {
            setSelectedSheets(sourceItems);
            setAvailableSheets(destItems);
        }
    };

    // Обработчик добавления листа в план (через кнопку)
    const handleAddSheetToPlan = (sheet) => {
        // Проверяем, не добавлен ли уже
        if (!selectedSheets.some(s => s.matId === sheet.matId)) {
            setSelectedSheets(prev => [...prev, sheet]);
            setAvailableSheets(prev => prev.filter(s => s.matId !== sheet.matId));
        }
    };

    // Обработчик удаления листа из плана (через кнопку)
    const handleRemoveSheetFromPlan = (matId) => {
        setSelectedSheets(prev => prev.filter(s => s.matId !== matId));
        // Возвращаем лист в доступные (предполагаем, что он был в доступных изначально)
        // Это может быть неточно, если листы загружаются по-другому, но для простоты
        const sheetToReturn = selectedSheets.find(s => s.matId === matId);
        if (sheetToReturn) {
            setAvailableSheets(prev => [...prev, sheetToReturn]);
        }
    };

    // Обработчик создания плана (обновлён)
    const handleCreatePlan = async () => {
        if (!newPlanData.planName || selectedSheets.length === 0) { // Проверяем selectedSheets
            setError('Необходимо указать название плана и выбрать хотя бы один лист.');
            return;
        }

        setIsCreating(true);
        setError('');
        try {
            const requestPayload = {
                ...newPlanData,
                matIds: selectedSheets.map(s => s.matId) // Отправляем matId из selectedSheets
            };
            const response = await api.post('/annealingbatchplan', requestPayload);

            // --- НОВАЯ ЛОГИКА: Обновление статуса листов ПОСЛЕ успешного создания плана ---
            const matIdsAdded = requestPayload.matIds;
            await updateSheetStatus(matIdsAdded, `В плане закалки "${response.data.planName}"`);

            handleCloseCreateDialog();
            fetchPlans(); // Обновить список
            alert('План закалки создан успешно.');
        } catch (err) {
            console.error('Ошибка создания плана закалки:', err);
            console.error('Ошибка создания плана закалки:', err); // <-- Логируйте полный объект ошибки
            console.error('Response data:', err.response?.data); // <-- Логируйте тело ответа сервера
            console.error('Response status:', err.response?.status); // <-- Логируйте статус
            setError(err.response?.data?.message || err.message || 'Ошибка при создании плана закалки.');
        } finally {
            setIsCreating(false);
        }
    };

    // --- Обработчики для обновления статуса плана ---

    const handleOpenUpdateDialog = (plan) => {
        setPlanToUpdate(plan);
        // Инициализируем значениями из плана или пустыми строками
        setUpdateStatusData({
            status: plan.status || '',
            actualStartTime: plan.actualStartTime || '', // <-- Инициализация поля
            actualEndTime: plan.actualEndTime || '',     // <-- Инициализация поля
            comment: '', // Комментарий не используется в этом API, но можно добавить поле в Notes или отдельно
        });
        setOpenUpdateDialog(true);
    };

    const handleCloseUpdateDialog = () => {
        setOpenUpdateDialog(false);
        setPlanToUpdate(null);
        setUpdateStatusData({ status: '', actualStartTime: '', actualEndTime: '', comment: '' }); // <-- Сброс состояния при закрытии
        setIsUpdating(false);
        setError(''); // Очистим ошибку при закрытии
    };

    const handleUpdateStatusDataChange = (field, value) => {
        setUpdateStatusData(prev => ({ ...prev, [field]: value }));
    };

    const handleUpdatePlanStatus = async () => {
        // Проверяем, что статус выбран
        if (!planToUpdate || !updateStatusData.status) {
            setError('Необходимо выбрать статус.');
            return;
        }

        // Проверяем, что время окончания не раньше времени начала (если оба установлены)
        if (updateStatusData.actualStartTime && updateStatusData.actualEndTime) {
            const startTime = new Date(updateStatusData.actualStartTime);
            const endTime = new Date(updateStatusData.actualEndTime);
            if (endTime < startTime) {
                setError('Время окончания не может быть раньше времени начала.');
                return;
            }
        }

        setIsUpdating(true);
        setError('');
        try {
            // Подготовим payload, включая новые поля, если они заполнены
            const payload = {
                status: updateStatusData.status,
                comment: updateStatusData.comment, // Если API принимает комментарий
            };

            if (updateStatusData.actualStartTime) {
                payload.actualStartTime = updateStatusData.actualStartTime;
            }
            if (updateStatusData.actualEndTime) {
                payload.actualEndTime = updateStatusData.actualEndTime;
            }

            await api.put(`/annealingbatchplan/${planToUpdate.planId}/status`, payload); // или /${planToUpdate.planId} если обновление целиком
            handleCloseUpdateDialog();
            fetchPlans(); // Обновить список
            alert(`Статус плана "${planToUpdate.planName}" обновлён.`);
        } catch (err) {
            console.error('Ошибка обновления статуса плана:', err);
            console.error('Response data:', err.response?.data); // <-- Логируйте тело ответа сервера
            console.error('Response status:', err.response?.status); // <-- Логируйте статус
            setError(err.response?.data?.message || err.message || 'Ошибка при обновлении статуса плана.');
        } finally {
            setIsUpdating(false);
        }
    };

    // --- Обработчики для удаления плана ---

    const handleOpenDeleteDialog = (plan) => {
        setPlanToDelete(plan);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setOpenDeleteDialog(false);
        setPlanToDelete(null);
        setIsDeleting(false);
        setError(''); // Очистим ошибку при закрытии
    };

    const handleDeletePlan = async () => {
        if (!planToDelete) return;

        setIsDeleting(true);
        setError('');
        try {
            // Получаем план перед удалением, чтобы знать его статус и листы
            const planDetailsResponse = await api.get(`/annealingbatchplan/${planToDelete.planId}/details`);
            const planDetails = planDetailsResponse.data;

            await api.delete(`/annealingbatchplan/${planToDelete.planId}`);

            // --- НОВАЯ ЛОГИКА: Обновление статуса листов ПОСЛЕ успешного удаления ---
            // Проверяем статус плана перед удалением
            if (planDetails.status === 'Создан') { // Только если план был "Создан"
                const matIdsToRemove = planDetails.sheets.map(s => s.matId); // Используем список листов из деталей плана
                // Сбрасываем статус на "Подготовлен к прокату", так как он был в этом состоянии до добавления в план
                await updateSheetStatus(matIdsToRemove, 'Подготовлен к прокату');
            }

            handleCloseDeleteDialog();
            fetchPlans(); // Обновить список планов
            // fetchAvailableSheets(1); // Опционально: обновить список доступных листов
            alert(`План закалки "${planToDelete.planName}" удалён.`);
        } catch (err) {
            console.error('Ошибка удаления плана закалки:', err);
            setError(err.response?.data?.message || err.message || 'Ошибка при удалении плана закалки.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Функция для получения цвета чипа статуса
    const getStatusColor = (status) => {
        switch (status) {
            case 'Создан':
                return 'default';
            case 'Готов к работе':
                return 'info';
            case 'В работе':
                return 'warning';
            case 'Завершён':
                return 'success';
            case 'Прерван':
                return 'error';
            case 'Отменён':
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
                        План закалки листов (Групповой)
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenCreateDialog}
                    // disabled={isCreating} // Не отключаем кнопку, если диалог открыт
                    >
                        Создать план
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
                                sx={{ minWidth: 300 }}
                            >
                                <MenuItem value="">Все</MenuItem>
                                {possibleExecutionStatuses.map((status) => (
                                    <MenuItem key={status} value={status}>{status}</MenuItem>
                                ))}
                            </TextField>
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

                {/* Таблица планов */}
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
                                        <TableCell>Название</TableCell>
                                        <TableCell>Статус</TableCell>
                                        <TableCell>Печь</TableCell>
                                        <TableCell>Запл. начало</TableCell>
                                        <TableCell>Запл. окончание</TableCell>
                                        {/* --- Добавлены новые колонки --- */}
                                        {/*  <TableCell>Факт. начало</TableCell>*/}
                                        {/*<TableCell>Факт. окончание</TableCell>*/}
                                        {/* ----------------------------- */}
                                        <TableCell>Примечания</TableCell>
                                        <TableCell>Листы</TableCell>
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
                                            <TableCell>{plan.scheduledStartTime ? new Date(plan.scheduledStartTime).toLocaleString('ru-RU') : 'N/A'}</TableCell>
                                            <TableCell>{plan.scheduledEndTime ? new Date(plan.scheduledEndTime).toLocaleString('ru-RU') : 'N/A'}</TableCell>
                                            {/* --- Отображение новых полей --- */}
                                            {/* <TableCell>{plan.actualStartTime ? new Date(plan.actualStartTime).toLocaleString('ru-RU') : 'N/A'}</TableCell>
                      <TableCell>{plan.actualEndTime ? new Date(plan.actualEndTime).toLocaleString('ru-RU') : 'N/A'}</TableCell>*/}
                                            {/* ---------------------------------- */}
                                            <TableCell>{plan.notes || 'N/A'}</TableCell>
                                            <TableCell>
                                                {/* Аккордеон для списка листов */}
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
                                                                            primary={link.sheet?.matId || link.matId} // Показываем matId листа
                                                                            secondary={`${link.sheet?.status || 'N/A'} | ${link.sheet?.meltNumber || 'N/A'}-${link.sheet?.batchNumber || 'N/A'}-${link.sheet?.packNumber || 'N/A'}-${link.sheet?.sheetNumber || 'N/A'}`}
                                                                        />
                                                                    </ListItem>
                                                                ))
                                                            ) : (
                                                                <ListItem>
                                                                    <ListItemText primary="Нет листов" />
                                                                </ListItem>
                                                            )}
                                                        </List>
                                                    </AccordionDetails>
                                                </Accordion>
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title="Отметить статус выполнения">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenUpdateDialog(plan)}
                                                        color="primary"
                                                    >
                                                        <CheckCircleIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Отчет по плану">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenDetails(plan.planId)}
                                                        color="primary"
                                                    >
                                                        <RoomService fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                {/* --- НОВАЯ КНОПКА РЕДАКТИРОВАНИЯ --- */}
                                                <Tooltip title="Редактировать план">
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenEditDialog(plan)}
                                                            color="warning" // Используем warning для редактирования
                                                            disabled={plan.status !== 'Создан'} // Пример: редактировать можно только созданные
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Удалить план">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenDeleteDialog(plan)}
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

            {/* --- ОБНОВЛЁННЫЙ ДИАЛОГ СОЗДАНИЯ --- */}
            <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog} maxWidth="lg" fullWidth>
                <DialogTitle>
                    Создать новый план закалки
                </DialogTitle>
                <DialogContent dividers>
                    {/* Форма основных данных плана */}
                    <Box display="flex" flexDirection="column" gap={2} mb={2}>
                        <TextField
                            label="Название плана"
                            value={newPlanData.planName}
                            onChange={(e) => handleNewPlanDataChange('planName', e.target.value)}
                            size="small"
                            required
                            fullWidth
                        />
                        <TextField
                            label="Номер закалочной печи"
                            value={newPlanData.furnaceNumber}
                            onChange={(e) => handleNewPlanDataChange('furnaceNumber', e.target.value)}
                            size="small"
                            fullWidth
                        />
                        <TextField
                            label="Запланированное время начала"
                            type="datetime-local"
                            value={newPlanData.scheduledStartTime}
                            onChange={(e) => handleNewPlanDataChange('scheduledStartTime', e.target.value)}
                            size="small"
                            fullWidth
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                        <TextField
                            label="Запланированное время окончания"
                            type="datetime-local"
                            value={newPlanData.scheduledEndTime}
                            onChange={(e) => handleNewPlanDataChange('scheduledEndTime', e.target.value)}
                            size="small"
                            fullWidth
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                        {/* --- Новые поля для фактического времени (обычно не заполняются при создании) --- */}
                        {/*<TextField
              label="Фактическое время начала (если известно)"
              type="datetime-local"
              value={newPlanData.actualStartTime}
              onChange={(e) => handleNewPlanDataChange('actualStartTime', e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              disabled // <-- Обычно поле недоступно при создании
            />
            <TextField
              label="Фактическое время окончания (если известно)"
              type="datetime-local"
              value={newPlanData.actualEndTime}
              onChange={(e) => handleNewPlanDataChange('actualEndTime', e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              disabled // <-- Обычно поле недоступно при создании
            />*/}
                        {/* ------------------------------------------------------------------------------- */}
                        <TextField
                            label="Примечания (необязательно)"
                            value={newPlanData.notes}
                            onChange={(e) => handleNewPlanDataChange('notes', e.target.value)}
                            size="small"
                            multiline
                            rows={2}
                            fullWidth
                        />
                    </Box>

                    {/* Списки листов */}
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Box display="flex" gap={2} minHeight="400px">
                            {/* Список доступных листов */}
                            <Card sx={{ flex: 1, minWidth: 300 }}>
                                <CardHeader
                                    title={`Доступные листы (${availableSheets.length})`}
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
                                                    {availableSheets.map((sheet, index) => (
                                                        <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                                            {(provided, snapshot) => ( // <-- Функция передаётся как children
                                                                <div // <-- Обязательная обёртка
                                                                    ref={provided.innerRef} // <-- innerRef на обёртку
                                                                    {...provided.draggableProps} // <-- draggableProps на обёртку
                                                                >
                                                                    <ListItem
                                                                        {...provided.dragHandleProps} // <-- dragHandleProps на ListItem (или на его часть)
                                                                        secondaryAction={
                                                                            <Tooltip title="Добавить в план">
                                                                                <IconButton edge="end" aria-label="add" size="small" onClick={() => handleAddSheetToPlan(sheet)}>
                                                                                    <AddIcon />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        }
                                                                    >
                                                                        <ListItemText
                                                                            primary={
                                                                                <Typography variant="body2">
                                                                                    <strong>ID:</strong> {sheet.matId} <br />
                                                                                    <strong>Статус:</strong> {sheet.status} <br />
                                                                                    <strong>Плавка:</strong> {sheet.meltNumber} <br />
                                                                                    <strong>Партия:</strong> {sheet.batchNumber} <br />
                                                                                    <strong>Пачка:</strong> {sheet.packNumber} <br />
                                                                                    <strong>№ Листа:</strong> {sheet.sheetNumber}
                                                                                </Typography>
                                                                            }
                                                                        />
                                                                    </ListItem>
                                                                    {provided.placeholder} {/* <-- ВАЖНО: Добавлен placeholder */}
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

                            {/* Список листов в плане */}
                            <Card sx={{ flex: 1, minWidth: 300 }}>
                                <CardHeader
                                    title={`Листы в плане (${selectedSheets.length})`}
                                    subheader={`Название: ${newPlanData.planName || 'Не задано'}`}
                                    sx={{ pb: 0 }}
                                />
                                <CardContent sx={{ p: 1, height: '100%' }}>
                                    <Droppable droppableId="selected-sheets-list">
                                        {(provided) => (
                                            <List
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                dense
                                                sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper' }}
                                            >
                                                {selectedSheets.map((sheet, index) => (
                                                    <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                                        {(provided, snapshot) => ( // <-- Функция передаётся как children
                                                            <div // <-- Обязательная обёртка
                                                                ref={provided.innerRef} // <-- innerRef на обёртку
                                                                {...provided.draggableProps} // <-- draggableProps на обёртку
                                                            >
                                                                <ListItem
                                                                    {...provided.dragHandleProps} // <-- dragHandleProps на ListItem
                                                                    secondaryAction={
                                                                        <Tooltip title="Удалить из плана">
                                                                            <IconButton edge="end" aria-label="delete" size="small" onClick={() => handleRemoveSheetFromPlan(sheet.matId)}>
                                                                                <DeleteIcon />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    }
                                                                >
                                                                    <ListItemText
                                                                        primary={
                                                                            <Typography variant="body2">
                                                                                <strong>ID:</strong> {sheet.matId} <br />
                                                                                <strong>Статус:</strong> {sheet.status} <br />
                                                                                <strong>Плавка:</strong> {sheet.meltNumber} <br />
                                                                                <strong>Партия:</strong> {sheet.batchNumber} <br />
                                                                                <strong>Пачка:</strong> {sheet.packNumber} <br />
                                                                                <strong>№ Листа:</strong> {sheet.sheetNumber}
                                                                            </Typography>
                                                                        }
                                                                    />
                                                                </ListItem>
                                                                {provided.placeholder} {/* <-- ВАЖНО: Добавлен placeholder */}
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

                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseCreateDialog} startIcon={<CloseIcon />}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleCreatePlan}
                        variant="contained"
                        startIcon={<AddIcon />}
                        disabled={isCreating}
                        autoFocus
                    >
                        {isCreating ? 'Создание...' : 'Создать план'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* --- Диалог обновления статуса плана (обновлён) --- */}
            <Dialog open={openUpdateDialog} onClose={handleCloseUpdateDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Отметить статус выполнения для плана "{planToUpdate?.planName}"
                </DialogTitle>
                <DialogContent dividers>
                    {planToUpdate && (
                        <>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Текущий статус: <strong>{planToUpdate.status}</strong>
                            </Typography>
                            <Box display="flex" flexDirection="column" gap={2}>
                                <FormControl fullWidth margin="dense">
                                    <InputLabel id="status-update-select-label">Новый статус плана</InputLabel>
                                    <Select
                                        labelId="status-update-select-label"
                                        id="status-update-select"
                                        value={updateStatusData.status}
                                        label="Новый статус плана"
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
                                {/* --- Добавлены поля для фактического времени --- */}
                                {updateStatusData.status === 'В работе' && (
                                    <TextField
                                        label="Фактическое время начала"
                                        type="datetime-local"
                                        value={updateStatusData.actualStartTime}
                                        onChange={(e) => handleUpdateStatusDataChange('actualStartTime', e.target.value)}
                                        size="small"
                                        fullWidth
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                    />
                                )}
                                {(updateStatusData.status === 'Завершён' || updateStatusData.status === 'Прерван') && (
                                    <TextField
                                        label="Фактическое время окончания"
                                        type="datetime-local"
                                        value={updateStatusData.actualEndTime}
                                        onChange={(e) => handleUpdateStatusDataChange('actualEndTime', e.target.value)}
                                        size="small"
                                        fullWidth
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                    />
                                )}
                                {/* ------------------------------------------------ */}
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
                        onClick={handleUpdatePlanStatus}
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        disabled={isUpdating || !updateStatusData.status}
                        autoFocus
                    >
                        {isUpdating ? 'Сохранение...' : 'Отметить'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* --- ПОДКЛЮЧЕНИЕ КОМПОНЕНТА ДИАЛОГА ОТЧЕТА --- */}
            <PlanDetailsDialog
                open={isDetailsOpen}
                planId={selectedPlanId}
                onClose={handleCloseDetails}
            />

            {/* --- ДИАЛОГ РЕДАКТИРОВАНИЯ (ОБНОВЛЁН) --- */}
            <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="lg" fullWidth>
                <DialogTitle>
                    Редактировать план "{planToEdit?.planName}"
                </DialogTitle>
                <DialogContent dividers>
                    {loadingEditingSheets ? (
                        <Box display="flex" justifyContent="center" py={5}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            {planToEdit?.status !== 'Создан' ? (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    План "{planToEdit?.planName}" имеет статус "{planToEdit?.status}". Редактирование возможно только для планов со статусом "Создан".
                                </Alert>
                            ) : null}
                            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                            <Box display="flex" flexDirection="column" gap={2} mb={2}>
                                <TextField
                                    label="Название плана"
                                    value={editPlanData.planName}
                                    onChange={(e) => handleEditPlanDataChange('planName', e.target.value)}
                                    size="small"
                                    required // Сделаем обязательным, если нужно
                                    fullWidth
                                    disabled={planToEdit?.status !== 'Создан'} // Блокируем ввод, если статус не "Создан"
                                />
                                <TextField
                                    label="Номер закалочной печи"
                                    value={editPlanData.furnaceNumber}
                                    onChange={(e) => handleEditPlanDataChange('furnaceNumber', e.target.value)}
                                    size="small"
                                    fullWidth
                                    disabled={planToEdit?.status !== 'Создан'} // Блокируем ввод, если статус не "Создан"
                                />
                                <TextField
                                    label="Запланированное время начала"
                                    type="datetime-local"
                                    value={editPlanData.scheduledStartTime}
                                    onChange={(e) => handleEditPlanDataChange('scheduledStartTime', e.target.value)}
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    disabled={planToEdit?.status !== 'Создан'} // Блокируем ввод, если статус не "Создан"
                                />
                                <TextField
                                    label="Запланированное время окончания"
                                    type="datetime-local"
                                    value={editPlanData.scheduledEndTime}
                                    onChange={(e) => handleEditPlanDataChange('scheduledEndTime', e.target.value)}
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    disabled={planToEdit?.status !== 'Создан'} // Блокируем ввод, если статус не "Создан"
                                />
                                <TextField
                                    label="Примечания"
                                    value={editPlanData.notes}
                                    onChange={(e) => handleEditPlanDataChange('notes', e.target.value)}
                                    size="small"
                                    multiline
                                    minRows={2}
                                    maxRows={4}
                                    fullWidth
                                    disabled={planToEdit?.status !== 'Создан'} // Блокируем ввод, если статус не "Создан"
                                />
                            </Box>

                            {/* --- СПИСКИ ЛИСТОВ ДЛЯ РЕДАКТИРОВАНИЯ --- */}
                            <DragDropContext onDragEnd={onEditDragEnd}>
                                <Box display="flex" gap={2} minHeight="400px">
                                    {/* Список доступных листов для редактирования */}
                                    <Card sx={{ flex: 1, minWidth: 300 }}>
                                        <CardHeader
                                            title={`Доступные листы (${editingAvailableSheets.length})`}
                                            sx={{ pb: 0 }}
                                        />
                                        <CardContent sx={{ p: 1, height: '100%' }}>
                                            <Droppable droppableId="editing-available-sheets-list">
                                                {(provided) => (
                                                    <List
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        dense
                                                        sx={{ maxHeight: '400px', overflowY: 'auto', bgcolor: 'grey.50', p: 1 }}
                                                    >
                                                        {editingAvailableSheets.map((sheet, index) => (
                                                            <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                                                {(provided) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                    >
                                                                        <ListItem
                                                                          
                                                                        >
                                                                            <ListItemText
                                                                                primary={
                                                                                    <Typography variant="body2">
                                                                                        <strong>ID:</strong> {sheet.matId} <br />
                                                                                        <strong>Статус:</strong> {sheet.status} <br />
                                                                                        <strong>Плавка:</strong> {sheet.meltNumber} <br />
                                                                                        <strong>Партия:</strong> {sheet.batchNumber} <br />
                                                                                        <strong>Пачка:</strong> {sheet.packNumber} <br />
                                                                                        <strong>№ Листа:</strong> {sheet.sheetNumber}
                                                                                    </Typography>
                                                                                }
                                                                            />
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

                                    {/* Список листов в плане для редактирования */}
                                    <Card sx={{ flex: 1, minWidth: 300 }}>
                                        <CardHeader
                                            title={`Листы в плане (${editingSelectedSheets.length})`}
                                            subheader={`Название: ${editPlanData.planName || 'Не задано'}`}
                                            sx={{ pb: 0 }}
                                        />
                                        <CardContent sx={{ p: 1, height: '100%' }}>
                                            <Droppable droppableId="editing-selected-sheets-list">
                                                {(provided) => (
                                                    <List
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        dense
                                                        sx={{ maxHeight: '400px', overflowY: 'auto', bgcolor: 'lightblue', p: 1 }}
                                                    >
                                                        {editingSelectedSheets.map((sheet, index) => (
                                                            <Draggable key={sheet.matId} draggableId={sheet.matId} index={index}>
                                                                {(provided) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                    >
                                                                        <ListItem
                                                                            
                                                                        >
                                                                            <ListItemText
                                                                                primary={
                                                                                    <Typography variant="body2">
                                                                                        <strong>ID:</strong> {sheet.matId} <br />
                                                                                        <strong>Статус:</strong> {sheet.status} <br />
                                                                                        <strong>Плавка:</strong> {sheet.meltNumber} <br />
                                                                                        <strong>Партия:</strong> {sheet.batchNumber} <br />
                                                                                        <strong>Пачка:</strong> {sheet.packNumber} <br />
                                                                                        <strong>№ Листа:</strong> {sheet.sheetNumber}
                                                                                    </Typography>
                                                                                }
                                                                            />
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
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditDialog} startIcon={<CloseIcon />}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleEditPlan}
                        variant="contained"
                        startIcon={<SaveIcon />}
                        disabled={isEditing || planToEdit?.status !== 'Создан'} // Блокируем кнопку, если статус не "Создан" или идет сохранение
                    >
                        {isEditing ? 'Сохранение...' : 'Сохранить изменения'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Диалог подтверждения удаления плана */}
            <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
                <DialogTitle>{"Подтвердите удаление"}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Вы уверены, что хотите удалить план закалки <strong>{planToDelete?.planName}</strong> (ID: {planToDelete?.planId})?
                        Все связи с листами в этом плане также будут удалены.
                        Это действие нельзя отменить.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog}>Отмена</Button>
                    <Button
                        onClick={handleDeletePlan}
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

export default AnnealingBatchPlanPage;