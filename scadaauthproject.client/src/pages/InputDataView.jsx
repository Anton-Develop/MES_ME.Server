import React, { useState, useEffect, useMemo,useRef } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DataGrid, GridToolbar, gridClasses } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import dayjs from 'dayjs';
import api from '../api';

const InputDataView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // ИСПРАВЛЕНИЕ 1: Используем единый объект модели пагинации
  const [paginationModel, setPaginationModel] = useState({
    page: 0, // DataGrid использует 0-based индексацию (0, 1, 2...)
    pageSize: 10,
  });

  // ИСПРАВЛЕНИЕ 2: Используем 'matId' (с заглавной I) для сортировки
  const [sortModel, setSortModel] = useState([{ field: 'matId', sort: 'asc' }]);

  const [filterModel, setFilterModel] = useState({
    matid: '',
    status: '',
    meltNumber: '',
    batchNumber: '',
    packNumber: '',
    sheetNumber: '',
    rollDateFrom: null,
    rollDateTo: null,
  });

  // --- НОВЫЕ СОСТОЯНИЯ ДЛЯ ДИАЛОГА ИЗМЕНЕНИЯ СТАТУСА ---
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [selectedSheetForStatusChange, setSelectedSheetForStatusChange] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  // -- Для изменения статуса оптом
  const [selectedIds, setSelectedIds] = useState([]); // Хранит массив MatId (string) выбранных строк
  const [selectedNewStatus, setSelectedNewStatus] = useState(''); // Хранит выбранный статус
  const [massUpdateLoading, setMassUpdateLoading] = useState(false); // Для индикации процесса обновления
  const [massUpdateError, setMassUpdateError] = useState(''); // Для сообщений об ошибке
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() });

  const currentPageIdsRef = useRef(new Set());
  //window.selectedIdsFromComponent = selectedIds; // Экспонируем в глобальный объект window
  //window.massUpdateLoadingFromComponent = massUpdateLoading; 
  //window.dataForDebugging = data;
  //const allMatIds = window.InputDataViewRef.current.data.map(row => row.matId);
  //const uniqueMatIds = new Set(allMatIds);

  // Возможные статусы - расширим список на основе данных
  const possibleStatuses = [
    'Подготовлен к прокату',
	'В плане закалки',
    'Прошел закалку',
    'Добавлен в кассету',
    'Прошел отпуск',
    'Недокат',
    'Чистый выброс',
    'Годный', 
    'Брак',
    ];

  // Преобразование sortModel в параметры для API
  const [sortField, sortOrder] = useMemo(() => {
    if (sortModel.length > 0) {
      // Используем 'matId' для сортировки
      return [sortModel[0].field, sortModel[0].sort];
    }
    // Используем 'matId' по умолчанию
    return ['matId', 'asc'];
  }, [sortModel]);

  // Загрузка данных
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Преобразуем 0-based page из DataGrid в 1-based page для вашего API
      const apiPage = paginationModel.page + 1;
      const apiPageSize = paginationModel.pageSize;

      const [sortField, sortOrder] = sortModel.length > 0
        ? [sortModel[0].field, sortModel[0].sort]
        : ['matId', 'asc']; // Используем 'matId'

      const params = {
        page: apiPage,
        pageSize: apiPageSize,
        sortField,
        sortOrder,
        matidFilter: filterModel.matid,
        statusFilter: filterModel.status,
        meltNumberFilter: filterModel.meltNumber,
        batchNumberFilter: filterModel.batchNumber,
        packNumberFilter: filterModel.packNumber,
        sheetNumberFilter: filterModel.sheetNumber,
        rollDateFromFilter: filterModel.rollDateFrom ? filterModel.rollDateFrom.toISOString().split('T')[0] : null,
        rollDateToFilter: filterModel.rollDateTo ? filterModel.rollDateTo.toISOString().split('T')[0] : null,
      };

      const response = await api.get('/inputdata', { params });

      // --- ИСПРАВЛЕНИЕ: Присваиваем response.data.data напрямую ---
      // Потому что response.data.data уже является массивом объектов вида { matId: "...", status: "...", ... }
      const fetchedData = response.data.data || [];
      setData(fetchedData);
      // Сохраняем ID всех полученных строк на текущей странице
      const ids = fetchedData.map(row => row.matId);
      currentPageIdsRef.current = new Set(ids); // Обновляем ref
      //setData(response.data.data || []);
      setTotalCount(response.data.totalCount || 0);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке данных.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Теперь данные будут грузиться при изменении страницы, размера страницы, сортировки ИЛИ фильтров
  }, [paginationModel, sortModel, filterModel]);

  // Обработчики фильтров
  const handleFilterChange = (field, value) => {
    setFilterModel(prev => ({ ...prev, [field]: value }));
    // Примечание: Сброс страницы на 0 произойдет автоматически в handleSearch или можно сделать здесь,
    // но лучше явно срабатывать при нажатии "Найти", чтобы избежать лишних запросов при вводе текста.
  };

  const handleClearFilters = () => {
    setFilterModel({
      matid: '', status: '', meltNumber: '', batchNumber: '',
      packNumber: '', sheetNumber: '', rollDateFrom: null, rollDateTo: null,
    });
    setPaginationModel(prev => ({ ...prev, page: 0 })); // Сброс на первую страницу
    // fetchData вызвется через useEffect из-за изменения filterModel
  };

  const handleSearch = () => {
    // При явном поиске сбрасываем на первую страницу
    setPaginationModel(prev => ({ ...prev, page: 0 }));
    // fetchData вызвется через useEffect из-за изменения paginationModel.page
  };

  // Вспомогательная функция для безопасного форматирования даты
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      return new Date(dateValue).toLocaleDateString('ru-RU');
    } catch {
      return '';
    }
  };

  // Вспомогательная функция для безопасного форматирования числа
  const formatNumber = (numValue) => {
    if (numValue == null || numValue === '') return '';
    try {
      return parseFloat(numValue).toFixed(2);
    } catch {
      return '';
    }
  };

  // --- НОВЫЕ ОБРАБОТЧИКИ ДЛЯ ДИАЛОГА ИЗМЕНЕНИЯ СТАТУСА ---
  const handleOpenStatusDialog = (sheetData) => {
    setSelectedSheetForStatusChange(sheetData);
    setNewStatus(sheetData.status || ''); // Устанавливаем текущий статус по умолчанию
    setStatusError(''); // Очищаем ошибки при открытии
    setOpenStatusDialog(true);
  };

  const handleCloseStatusDialog = () => {
    setOpenStatusDialog(false);
    setSelectedSheetForStatusChange(null);
    setNewStatus('');
    setUpdatingStatus(false);
    setStatusError('');
  };

  const handleStatusChange = (event) => {
    setNewStatus(event.target.value);
  };

  const handleSaveStatus = async () => {
    if (!selectedSheetForStatusChange) return;

    setUpdatingStatus(true);
    setStatusError('');

    try {
      await api.put(`/import/update-sheet-status/${selectedSheetForStatusChange.matId}`, { newStatus }); // matId на верхнем уровне
      // Успешно обновлено. Обновим локальное состояние данных.
      setData(prevData =>
        prevData.map(sheet =>
          sheet.matId === selectedSheetForStatusChange.matId // matId на верхнем уровне
            ? { ...sheet, status: newStatus }
            : sheet
        )
      );
      handleCloseStatusDialog();
      // Опционально: показать уведомление об успехе
      // alert(`Статус листа ${selectedSheetForStatusChange.matId} успешно изменён на '${newStatus}'.`);
    } catch (err) {
      console.error('Ошибка изменения статуса:', err);
      setStatusError(err.response?.data?.message || err.message || 'Ошибка при изменении статуса.');
    } finally {
      setUpdatingStatus(false);
    }
  };
const handleRowSelectionModelChange = (model) => {
    let newSelectedIdsArray;

    if (model.type === 'include') {
      // Выделены конкретные ID (например, выбор отдельных строк, снятие "всех")
      newSelectedIdsArray = Array.from(model.ids);
    } else if (model.type === 'exclude') {
      // Исключены конкретные ID из выделения. Это означает, что все остальные (на текущей странице) выделены.
      // Получаем ID, которые НЕ должны быть выделены
      const excludedIds = model.ids; // Это Set
      // Вычисляем ID, которые должны быть выделены: все ID текущей страницы MINUS исключенные
      // (Это работает, если DataGrid исключает ID только с текущей страницы)
      // ВАЖНО: Это работает корректно, только если DataGrid управляет выделением только на текущей странице
      // и "exclude" означает "все на странице, кроме этих".
      // Это может не сработать, если exclude подразумевает "все в таблице, кроме этих".
      // Для полного "выделить все" по всей таблице, нужно знать все ID.
      const currentPageIds = currentPageIdsRef.current; // Получаем ID с ref
      const includedIdsSet = new Set(currentPageIds);
      for (const id of excludedIds) {
          includedIdsSet.delete(id);
      }
      newSelectedIdsArray = Array.from(includedIdsSet);
    } else {
      // Неизвестный тип модели, просто игнорируем или сбрасываем
      console.warn("Неизвестный тип модели выделения:", model.type);
      newSelectedIdsArray = [];
    }

    //console.log("Обновление selectedIds. Новый массив:", newSelectedIdsArray);
    setSelectedIds(newSelectedIdsArray);
  };

  // --- ОБРАБОТЧИК ДЛЯ МАССОВОГО ИЗМЕНЕНИЯ СТАТУСА ---
  const handleMassStatusUpdate = async () => {
    if (!selectedNewStatus || selectedIds.length === 0) {
      console.warn("Не выбран статус или нет выделенных строк.");
      return; // Ничего не делаем, если условия не соблюдены
    }

    setMassUpdateLoading(true);
    setMassUpdateError('');

    try {
        // selectedIds теперь содержит строки matId
        // Просто отправляем их как есть
        const response = await api.post('/inputdata/update-sheets-status-bulk', {
            matIds: selectedIds, // selectedIds уже массив строк matId
            newStatus: selectedNewStatus,
        });

        console.log(response.data.message); // Например: "Статус успешно обновлен для X листов."

        // После успешного обновления:
        // 1. Обновляем локальное состояние данных
        setData(prevData =>
            prevData.map(sheet =>
                selectedIds.includes(sheet.matId) // Проверяем, был ли лист в списке обновленных
                    ? { ...sheet, status: selectedNewStatus } // Применяем новый статус
                    : sheet // Оставляем без изменений
            )
        );
        // 2. Снимаем выделение
        setSelectedIds([]);
        // 3. Сбрасываем выбранный статус
        setSelectedNewStatus('');
        // 4. Показать уведомление об успехе (опционально)
        // toast.success(response.data.message);

    } catch (err) {
        console.error('Ошибка при массовом обновлении статуса:', err);
        let errorMessage = 'Ошибка при обновлении статусов.';
        if (err.response) {
            // Сервер вернул ошибку
            errorMessage = err.response.data?.message || `Ошибка ${err.response.status}: ${err.response.statusText}`;
        } else if (err.request) {
            // Не удалось выполнить запрос
            errorMessage = 'Не удалось подключиться к серверу.';
        } else {
            // Ошибка при создании запроса
            errorMessage = err.message;
        }
        setMassUpdateError(errorMessage);
        // 5. Показать уведомление об ошибке (опционально)
        // toast.error(errorMessage);
    } finally {
        setMassUpdateLoading(false);
    }
    };

    const [rowDialog, setRowDialog] = useState({
        open: false,
        mode: 'create', // 'create' или 'edit'
        matId: null,
    });

    const [rowForm, setRowForm] = useState({});
    const [rowErrors, setRowErrors] = useState([]);
    const [savingRow, setSavingRow] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const REQUIRED_ROW_FIELDS = new Set([
        'status',
        'rollDate',
        'meltNumber',
        'batchNumber',
        'packNumber',
        'packSystemNumber',
        'steelGrade',
        'slabNumber',
        'sheetsCount',
        'sheetNumber',
        'quenchingDate',
        'quenchingStatus',
    ]);

  // Определение колонок для DataGrid
    const columns = [
        {
            field: 'actions',
            headerName: 'Действия',
            width: 110,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <IconButton
                    size="small"
                    onClick={() => handleOpenEditRow(params.row)}
                    color="primary"
                    title="Редактировать"
                >
                    <EditIcon />
                </IconButton>
            ),
        },
        {
            field: 'matId',
            headerName: 'MatID',
            width: 130,
            sortable: true,
            type: 'text',
        },
        {
            field: 'status',
            headerName: 'Статус',
            width: 170,
            sortable: true,
            type: 'text',
        },
        {
            field: 'meltNumber',
            headerName: 'Плавка',
            width: 120,
            sortable: true,
            type: 'text',
        },
        {
            field: 'batchNumber',
            headerName: 'Партия',
            width: 120,
            sortable: true,
            type: 'text',
        },
        {
            field: 'packNumber',
            headerName: 'Пачка',
            width: 110,
            sortable: true,
            type: 'text',
        },
        {
            field: 'sheetNumber',
            headerName: '№ листа',
            width: 110,
            sortable: true,
            type: 'text',
        },
        {
            field: 'steelGrade',
            headerName: 'Марка стали',
            width: 140,
            sortable: true,
            type: 'text',
        },

        // Пока толщина берется из sheetDimensions.
        // Если добавите отдельное поле thicknessMm, замените field на 'thicknessMm'.
        {
            field: 'sheetDimensions',
            headerName: 'Толщина',
            width: 130,
            sortable: true,
            type: 'text',
        },

        // Дальше всё остальное
        {
            field: 'certificateNumber',
            headerName: 'Сертификат',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'shortOrderNumber',
            headerName: 'Короткий заказ',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'commercialOrderNumber',
            headerName: 'Коммерческий заказ',
            width: 170,
            sortable: true,
            type: 'text',
        },
        {
            field: 'rollDate',
            headerName: 'Дата поступления проката',
            width: 190,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'packSystemNumber',
            headerName: 'Номер пачки в системе',
            width: 170,
            sortable: true,
            type: 'text',
        },
        {
            field: 'slabNumber',
            headerName: 'Номер сляба',
            width: 120,
            sortable: true,
            type: 'text',
        },
        {
            field: 'actualNetWeightKg',
            headerName: 'Факт. вес нетто (кг)',
            width: 180,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'certificateNetWeightKg',
            headerName: 'Вес по сертификату (кг)',
            width: 180,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'sheetsCount',
            headerName: 'Кол-во листов',
            width: 120,
            sortable: true,
            type: 'number',
        },
        {
            field: 'sheetWeightKg',
            headerName: 'Вес листа (кг)',
            width: 130,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'rawMaterialKg',
            headerName: 'Сырье (кг)',
            width: 120,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'quenchingDate',
            headerName: 'Дата закалки',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'quenchingStatus',
            headerName: 'Закалка',
            width: 130,
            sortable: true,
            type: 'text',
        },
        {
            field: 'marking',
            headerName: 'Маркировка',
            width: 130,
            sortable: true,
            type: 'text',
        },
        {
            field: 'repeatedToDate',
            headerName: 'Повторная ТО',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'gpAcceptanceStatusWeight',
            headerName: 'Приемка ГП',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'npAcceptanceStatusWeight',
            headerName: 'Приемка НП',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'scrapAcceptanceStatusWeight',
            headerName: 'Приемка БРАК',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'actualWeight',
            headerName: 'Факт. вес',
            width: 120,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'nonReturnScrap',
            headerName: 'Невозвратный лом',
            width: 150,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'trimming',
            headerName: 'Обрезь',
            width: 120,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'flatnessMm',
            headerName: 'Плоскостность (мм)',
            width: 150,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'defect',
            headerName: 'Дефект',
            width: 120,
            sortable: true,
            type: 'text',
        },
        {
            field: 'note',
            headerName: 'Примечание',
            width: 200,
            sortable: true,
            type: 'text',
        },
        {
            field: 'npAct',
            headerName: 'Акт НП',
            width: 120,
            sortable: true,
            type: 'text',
        },
        {
            field: 'mmkClaimReason',
            headerName: 'Претензия ММК',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'npDecision',
            headerName: 'Решение НП',
            width: 120,
            sortable: true,
            type: 'text',
        },
        {
            field: 'sampleCardsSelection',
            headerName: 'Отбор проб',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'sampleNumberVk',
            headerName: 'Номер образца ВК',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'ballisticsSampleSendDate1',
            headerName: 'Баллистика 1',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'ballisticsSampleSendDate2',
            headerName: 'Баллистика 2',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'ballisticsSampleSendDate3',
            headerName: 'Баллистика 3',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'metallographySampleSendDate1',
            headerName: 'Металлография 1',
            width: 150,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'metallographySampleSendDate2',
            headerName: 'Металлография 2',
            width: 150,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'hardnessSampleSendDate1',
            headerName: 'Твердость 1',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'hardnessSampleSendDate2',
            headerName: 'Твердость 2',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'hardnessSampleSendDate3',
            headerName: 'Твердость 3',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'orderLink',
            headerName: 'Привязка к заказу',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'igkLink',
            headerName: 'Привязка к ИГК',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'testingStatus',
            headerName: 'Статус испытаний',
            width: 150,
            sortable: true,
            type: 'text',
        },
        {
            field: 'gpVpPresentationDate',
            headerName: 'Предъявление ГП ВП',
            width: 160,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'shipmentDate',
            headerName: 'Дата отгрузки',
            width: 130,
            sortable: true,
            type: 'date',
            valueFormatter: (params) => formatDate(params?.value),
        },
        {
            field: 'orderNumber',
            headerName: 'Номер заказа',
            width: 130,
            sortable: true,
            type: 'text',
        },
        {
            field: 'certificateNumber2',
            headerName: 'Номер сертификата 2',
            width: 160,
            sortable: true,
            type: 'text',
        },
        {
            field: 'shippedSheetsWeightKg',
            headerName: 'Вес отгр. листов (кг)',
            width: 180,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'sheetWeightAfterToStorageKg',
            headerName: 'Вес листа после ТО (кг)',
            width: 200,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
        {
            field: 'postShipDiff',
            headerName: 'Разница пост/отгр',
            width: 150,
            sortable: true,
            type: 'number',
            valueFormatter: (params) => formatNumber(params?.value),
        },
    ];


    const buildEmptyRow = () => {
        const empty = {};

        columns
            .filter((col) => col.field !== 'actions')
            .forEach((col) => {
                if (col.type === 'date') {
                    empty[col.field] = null;
                } else {
                    empty[col.field] = '';
                }
            });

        return empty;
    };

    const normalizeRowForm = (row) => {
        const empty = buildEmptyRow();

        const normalized = {
            ...empty,
            ...row,
        };

        columns
            .filter((col) => col.type === 'date')
            .forEach((col) => {
                normalized[col.field] = normalized[col.field]
                    ? dayjs(normalized[col.field])
                    : null;
            });

        return normalized;
    };

    const handleRowFormChange = (field, value) => {
        setRowForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleOpenCreateRow = () => {
        const empty = buildEmptyRow();

        empty.status = 'Подготовлен к прокату';
        empty.slabNumber = '0';
        empty.rollDate = dayjs();
        empty.quenchingDate = dayjs();

        setRowForm(empty);
        setRowErrors([]);
        setRowDialog({
            open: true,
            mode: 'create',
            matId: null,
        });
    };

    const handleOpenEditRow = (row) => {
        const normalized = normalizeRowForm(row);

        setRowForm(normalized);
        setRowErrors([]);
        setRowDialog({
            open: true,
            mode: 'edit',
            matId: row.matId,
        });
    };

    const handleCloseRowDialog = () => {
        setRowDialog({
            open: false,
            mode: 'create',
            matId: null,
        });

        setRowForm({});
        setRowErrors([]);
        setSavingRow(false);
    };

    const validateRowForm = (form) => {
        const errors = [];

        const editableColumns = columns.filter((col) => col.field !== 'actions');

        editableColumns.forEach((col) => {
            const value = form[col.field];

            const isEmpty =
                value === null ||
                value === undefined ||
                String(value).trim() === '';

            if (REQUIRED_ROW_FIELDS.has(col.field) && isEmpty) {
                errors.push(`Поле «${col.headerName}» обязательно.`);
            }

            if (!isEmpty && col.type === 'number' && isNaN(Number(value))) {
                errors.push(`Поле «${col.headerName}» должно быть числом.`);
            }

            if (!isEmpty && col.type === 'date' && !dayjs(value).isValid()) {
                errors.push(`Поле «${col.headerName}» содержит некорректную дату.`);
            }
        });

        if (
            form.sheetsCount !== '' &&
            form.sheetsCount !== null &&
            form.sheetsCount !== undefined &&
            Number(form.sheetsCount) <= 0
        ) {
            errors.push('Поле «Кол-во листов» должно быть больше 0.');
        }

        return errors;
    };

    const prepareRowPayload = (form) => {
        const payload = { ...form };

        columns
            .filter((col) => col.field !== 'actions')
            .forEach((col) => {
                const value = payload[col.field];

                if (col.type === 'date') {
                    payload[col.field] =
                        value && dayjs(value).isValid()
                            ? dayjs(value).startOf('day').toISOString()
                            : null;
                }

                if (col.type === 'number') {
                    payload[col.field] =
                        value === '' || value === null || value === undefined
                            ? null
                            : Number(value);
                }

                if (typeof payload[col.field] === 'string') {
                    payload[col.field] = payload[col.field].trim();
                }
            });

        return payload;
    };

    const handleSaveRow = async () => {
        const errors = validateRowForm(rowForm);

        if (errors.length > 0) {
            setRowErrors(errors);
            return;
        }

        setSavingRow(true);
        setRowErrors([]);

        try {
            const payload = prepareRowPayload(rowForm);

            let response;

            if (rowDialog.mode === 'edit') {
                response = await api.put(`/inputdata/${rowDialog.matId}`, payload);
            } else {
                response = await api.post('/inputdata', payload);
            }

            setSuccessMessage(
                response?.data?.message ||
                (rowDialog.mode === 'edit'
                    ? 'Запись успешно обновлена.'
                    : 'Запись успешно создана.')
            );

            handleCloseRowDialog();

            await fetchData();
        } catch (err) {
            console.error('Ошибка сохранения строки InputData:', err);

            const message =
                err.response?.data?.message ||
                err.message ||
                'Ошибка при сохранении данных.';

            setRowErrors([message]);
        } finally {
            setSavingRow(false);
        }
    };
  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom align="center">
          Просмотр данных листов
        </Typography>

        {/* Контейнер для элементов управления массовым действием */}
              <Box p={2} display="flex" alignItems="center" gap={2}>
                  <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleOpenCreateRow}
                  >
                      Добавить запись
                  </Button>
          <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel id="select-new-status-label">Новый статус</InputLabel>
            <Select
              labelId="select-new-status-label"
              value={selectedNewStatus}
              label="Новый статус"
              onChange={(e) => setSelectedNewStatus(e.target.value)} // ИСПРАВЛЕНИЕ: правильный обработчик
              disabled={massUpdateLoading || selectedIds.length === 0} // Блокируем, если ничего не выбрано или идет обновление
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
            onClick={handleMassStatusUpdate} // ИСПРАВЛЕНИЕ: правильный обработчик
            disabled={
              massUpdateLoading ||
              !selectedNewStatus || // Блокируем, если статус не выбран
              selectedIds.length === 0 // Блокируем, если строки не выбраны
            }
          >
            {massUpdateLoading ? 'Применение...' : `Применить к ${selectedIds.length} листам`}
          </Button>
        </Box>

              {successMessage && (
                  <Alert
                      severity="success"
                      onClose={() => setSuccessMessage('')}
                      sx={{ mb: 2 }}
                  >
                      {successMessage}
                  </Alert>
              )}
        {massUpdateError && <Alert severity="error">{massUpdateError}</Alert>}

        {/* Фильтры */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Grid container spacing={2} alignItems="end">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="MatID"
                value={filterModel.matid}
                onChange={(e) => handleFilterChange('matid', e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: filterModel.matid ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleFilterChange('matid', '')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Статус"
                value={filterModel.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: filterModel.status ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleFilterChange('status', '')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Номер плавки"
                value={filterModel.meltNumber}
                onChange={(e) => handleFilterChange('meltNumber', e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: filterModel.meltNumber ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleFilterChange('meltNumber', '')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Номер партии"
                value={filterModel.batchNumber}
                onChange={(e) => handleFilterChange('batchNumber', e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: filterModel.batchNumber ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleFilterChange('batchNumber', '')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Номер пачки"
                value={filterModel.packNumber}
                onChange={(e) => handleFilterChange('packNumber', e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: filterModel.packNumber ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleFilterChange('packNumber', '')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="№ листа"
                value={filterModel.sheetNumber}
                onChange={(e) => handleFilterChange('sheetNumber', e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: filterModel.sheetNumber ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleFilterChange('sheetNumber', '')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Дата пост. от"
                  value={filterModel.rollDateFrom ? dayjs(filterModel.rollDateFrom) : null}
                  onChange={(newValue) => handleFilterChange('rollDateFrom', newValue ? newValue.toDate() : null)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Дата пост. до"
                  value={filterModel.rollDateTo ? dayjs(filterModel.rollDateTo) : null}
                  onChange={(newValue) => handleFilterChange('rollDateTo', newValue ? newValue.toDate() : null)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                fullWidth
              >
                Найти
              </Button>
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
          </Grid>
        </Box>

        {/* DataGrid */}
        {error && <Alert severity="error">{error}</Alert>}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : (
          <Box height={600} width="100%">
            <DataGrid
              rows={data}
              columns={columns}
              // --- Новые пропсы ---
              checkboxSelection // <- Добавляем чекбоксы
              disableSelectionOnClick // <- Отключаем выделение при клике на строку
              
              //rowSelectionModel={{ type: 'include', ids: new Set(selectedIds) }}
              //onRowSelectionModelChange={(model) => {
                // Вытаскиваем массив из Set для вашего стейта
              //  setSelectedIds(Array.from(model.ids));
             // }}
             // rowSelectionModel={selectedIds} // <- Привязываем состояние к выделению
              onRowSelectionModelChange={handleRowSelectionModelChange}
              getRowId={(row) => {
                 // ИСПРАВЛЕНИЕ: корректно берёт matId из inputData
                 // Добавим проверку на случай, если row или row.matId undefined
                 if (!row || typeof row.matId !== 'string' || row.matId.trim() === '') {
                     console.error("getRowId: получена строка без или с пустым matId:", row);
                     // Возвращаем запасной ключ, если matId нет
                     return `invalid-row-${Math.random()}`;
                    
                 }
                 return row.matId;
                  
              }}
              
              // --- /Новые пропсы ----
              rowCount={totalCount}
              paginationMode="server"
              sortingMode="server"

              // Передаем модель и обработчик изменения
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}

              sortModel={sortModel}
              onSortModelChange={setSortModel}

              loading={loading}
              pageSizeOptions={[10, 25, 50, 100]} // Новое имя пропа вместо rowsPerPageOptions
              components={{
                Toolbar: GridToolbar, // Добавляем стандартный тулбар (не обязательно)
            }}
              localeText={{
                noRowsLabel: 'Нет данных',
                footerRowSelected: (count) => `${count} строк выбрано`,
                footerTotalRows: (total) => `Всего строк: ${total}`,
              }}
            />
          </Box>
        )}
      </Paper>
      {/* --- ДИАЛОГ ИЗМЕНЕНИЯ СТАТУСА --- */}
      <Dialog open={openStatusDialog} onClose={handleCloseStatusDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Изменить статус листа
        </DialogTitle>
        <DialogContent dividers>
          {selectedSheetForStatusChange && (
            <>
              <Typography variant="body1" gutterBottom>
                <strong>MatID:</strong> {selectedSheetForStatusChange.matId}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Текущий статус:</strong> <Chip label={selectedSheetForStatusChange.status} size="small" />
              </Typography>
              <FormControl fullWidth margin="dense">
                <InputLabel id="status-select-label">Новый статус</InputLabel>
                <Select
                  labelId="status-select-label"
                  id="status-select"
                  value={newStatus}
                  label="Новый статус"
                  onChange={handleStatusChange}
                  size="small"
                  disabled={updatingStatus} // Блокируем во время обновления
                >
                  {possibleStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {statusError && <Alert severity="error" sx={{ mt: 2 }}>{statusError}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStatusDialog} disabled={updatingStatus}>
            Отмена
          </Button>
          <Button
            onClick={handleSaveStatus}
            variant="contained"
            disabled={updatingStatus || !newStatus}
          >
            {updatingStatus ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
          </Dialog>

          <Dialog
              open={rowDialog.open}
              onClose={handleCloseRowDialog}
              maxWidth="lg"
              fullWidth
          >
              <DialogTitle>
                  {rowDialog.mode === 'edit'
                      ? `Редактирование записи MatId: ${rowDialog.matId}`
                      : 'Создание новой записи'}
              </DialogTitle>

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DialogContent dividers>
                      {rowErrors.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                              {rowErrors.map((error, index) => (
                                  <Alert key={index} severity="error" sx={{ mb: 1 }}>
                                      {error}
                                  </Alert>
                              ))}
                          </Box>
                      )}

                      <Grid container spacing={2}>
                          {columns
                              .filter((col) => col.field !== 'actions')
                              .map((col) => {
                                  const isRequired = REQUIRED_ROW_FIELDS.has(col.field);
                                  const isMatId = col.field === 'matId';

                                  return (
                                      <Grid item xs={12} sm={6} md={4} key={col.field}>
                                          {col.type === 'date' ? (
                                              <DatePicker
                                                  label={col.headerName}
                                                  value={rowForm[col.field] || null}
                                                  onChange={(newValue) =>
                                                      handleRowFormChange(col.field, newValue)
                                                  }
                                                  disabled={isMatId || savingRow}
                                                  slotProps={{
                                                      textField: {
                                                          fullWidth: true,
                                                          size: 'small',
                                                          required: isRequired,
                                                      },
                                                  }}
                                              />
                                          ) : (
                                              <TextField
                                                  fullWidth
                                                  size="small"
                                                  label={col.headerName}
                                                  value={rowForm[col.field] ?? ''}
                                                  onChange={(e) =>
                                                      handleRowFormChange(col.field, e.target.value)
                                                  }
                                                  required={isRequired}
                                                  disabled={isMatId || savingRow}
                                                  type={col.type === 'number' ? 'number' : 'text'}
                                              />
                                          )}
                                      </Grid>
                                  );
                              })}
                      </Grid>
                  </DialogContent>
              </LocalizationProvider>

              <DialogActions>
                  <Button
                      onClick={handleCloseRowDialog}
                      disabled={savingRow}
                  >
                      Отмена
                  </Button>

                  <Button
                      variant="contained"
                      onClick={handleSaveRow}
                      disabled={savingRow}
                  >
                      {savingRow ? 'Сохранение...' : 'Сохранить'}
                  </Button>
              </DialogActions>
          </Dialog>
    </Container>
  );
};

export default InputDataView;