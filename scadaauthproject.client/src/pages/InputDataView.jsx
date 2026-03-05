import React, { useState, useEffect, useMemo } from 'react';
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DataGrid } from '@mui/x-data-grid';
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortModel, setSortModel] = useState([{ field: 'matid', sort: 'asc' }]);
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

  // Возможные статусы
  const possibleStatuses = [
    'Подготовлен к прокату',
    'Прошел закалку',
    'Добавлен в кассету',
    'Прошел отпуск',
    'Недокат',
    'Чистый выброс',
  ];

  // Преобразование sortModel в параметры для API
  const [sortField, sortOrder] = useMemo(() => {
    if (sortModel.length > 0) {
      return [sortModel[0].field, sortModel[0].sort];
    }
    return ['matid', 'asc'];
  }, [sortModel]);

  // Загрузка данных
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        pageSize,
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
	  //console.log(response);
      setData(response.data.data || []);
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
  }, [page, pageSize, sortField, sortOrder]); // Убрали filterModel из зависимостей

  // Обработчики изменения фильтров
  const handleFilterChange = (field, value) => {
    setFilterModel(prev => ({ ...prev, [field]: value }));
  };

  // Обработчик сброса фильтров
  const handleClearFilters = () => {
    setFilterModel({
      matid: '',
      status: '',
      meltNumber: '',
      batchNumber: '',
      packNumber: '',
      sheetNumber: '',
      rollDateFrom: null,
      rollDateTo: null,
    });
    setPage(1);
    fetchData();
  };

  // Обработчик поиска (применения фильтров)
  const handleSearch = () => {
    setPage(1);
    fetchData();
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
    if (!selectedSheetForStatusChange || !newStatus) return;

    setUpdatingStatus(true);
    setStatusError('');

    try {
      await api.put(`/import/update-sheet-status/${selectedSheetForStatusChange.matId}`, { newStatus });
      // Успешно обновлено. Обновим локальное состояние данных.
      setData(prevData =>
        prevData.map(sheet =>
          sheet.matId === selectedSheetForStatusChange.matId
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
  // Определение колонок для DataGrid
  const columns = [
    {
      field: 'actions',headerName: 'Действия',width: 120, sortable: false,renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() => handleOpenStatusDialog(params.row)} // Передаём всю строку
          color="primary"
          title="Изменить статус"
        >
          <EditIcon />
        </IconButton>
      ),
    },
    { field: 'matId', headerName: 'MatID', width: 120, sortable: true },
    { field: 'status', headerName: 'Статус', width: 150, sortable: true },
    { field: 'certificateNumber', headerName: 'Сертификат', width: 150, sortable: true },
    { field: 'shortOrderNumber', headerName: 'Короткий заказ', width: 150, sortable: true },
    { field: 'commercialOrderNumber', headerName: 'Комерческий заказ', width: 150, sortable: true },
    {
      field: 'rollDate',
      headerName: 'Дата поступления проката',
      width: 180,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    { field: 'meltNumber', headerName: 'Номер плавки', width: 120, sortable: true },
    { field: 'batchNumber', headerName: 'Номер партии', width: 120, sortable: true },
    { field: 'packNumber', headerName: 'Номер пачки', width: 120, sortable: true },
    { field: 'packSystemNumber', headerName: 'Номер пачки в системе', width: 150, sortable: true },
    { field: 'steelGrade', headerName: 'Марка стали', width: 120, sortable: true },
    { field: 'sheetDimensions', headerName: 'Размеры листа', width: 150, sortable: true },
    { field: 'slabNumber', headerName: 'Номер сляба', width: 120, sortable: true },
    {
      field: 'actualNetWeightKg',
      headerName: 'Факт. вес нетто (кг)',
      width: 180,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    {
      field: 'certificateNetWeightKg',
      headerName: 'Вес по сертификату (кг)',
      width: 180,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    { field: 'sheetsCount', headerName: 'Кол-во листов', width: 120, sortable: true },
    {
      field: 'sheetWeightKg',
      headerName: 'Вес листа (кг)',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    {
      field: 'rawMaterialKg',
      headerName: 'Сырье (кг)',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    { field: 'sheetNumber', headerName: '№ листа', width: 120, sortable: true },
    {
      field: 'quenchingDate',
      headerName: 'Дата закалки',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    { field: 'quenchingStatus', headerName: 'Закалка', width: 120, sortable: true },
    { field: 'marking', headerName: 'Маркировка', width: 120, sortable: true },
    {
      field: 'repeatedToDate',
      headerName: 'Повторная ТО',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    { field: 'gpAcceptanceStatusWeight', headerName: 'Приемка ГП', width: 150, sortable: true },
    { field: 'npAcceptanceStatusWeight', headerName: 'Приемка НП', width: 150, sortable: true },
    { field: 'scrapAcceptanceStatusWeight', headerName: 'Приемка БРАК', width: 150, sortable: true },
    {
      field: 'actualWeight',
      headerName: 'Факт. вес',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    {
      field: 'nonReturnScrap',
      headerName: 'Невозвратный лом',
      width: 150,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    {
      field: 'trimming',
      headerName: 'Обрезь',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    {
      field: 'flatnessMm',
      headerName: 'Плоскостность (мм)',
      width: 150,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    { field: 'defect', headerName: 'Дефект', width: 120, sortable: true },
    { field: 'note', headerName: 'Примечание', width: 200, sortable: true },
    { field: 'npAct', headerName: 'Акт НП', width: 120, sortable: true },
    { field: 'mmkClaimReason', headerName: 'Претензия ММК', width: 150, sortable: true },
    { field: 'npDecision', headerName: 'Решение НП', width: 120, sortable: true },
    { field: 'sampleCardsSelection', headerName: 'Отбор проб', width: 150, sortable: true },
    { field: 'sampleNumberVk', headerName: 'Номер образца ВК', width: 150, sortable: true },
    {
      field: 'ballisticsSampleSendDate1',
      headerName: 'Баллистика 1',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    {
      field: 'ballisticsSampleSendDate2',
      headerName: 'Баллистика 2',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    {
      field: 'ballisticsSampleSendDate3',
      headerName: 'Баллистика 3',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    {
      field: 'metallographySampleSendDate1',
      headerName: 'Металлография 1',
      width: 150,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    {
      field: 'metallographySampleSendDate2',
      headerName: 'Металлография 2',
      width: 150,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    {
      field: 'hardnessSampleSendDate1',
      headerName: 'Твердость 1',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    {
      field: 'hardnessSampleSendDate2',
      headerName: 'Твердость 2',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    {
      field: 'hardnessSampleSendDate3',
      headerName: 'Твердость 3',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    { field: 'orderLink', headerName: 'Привязка к заказу', width: 150, sortable: true },
    { field: 'igkLink', headerName: 'Привязка к ИГК', width: 150, sortable: true },
    { field: 'testingStatus', headerName: 'Статус испытаний', width: 150, sortable: true },
    {
      field: 'gpVpPresentationDate',
      headerName: 'Предъявление ГП ВП',
      width: 150,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    {
      field: 'shipmentDate',
      headerName: 'Дата отгрузки',
      width: 120,
      sortable: true,
      valueFormatter: (params) => formatDate(params?.value),
    },
    { field: 'orderNumber', headerName: 'Номер заказа', width: 120, sortable: true },
    { field: 'certificateNumber2', headerName: 'Номер сертификата 2', width: 150, sortable: true },
    {
      field: 'shippedSheetsWeightKg',
      headerName: 'Вес отгр. листов (кг)',
      width: 180,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    {
      field: 'sheetWeightAfterToStorageKg',
      headerName: 'Вес листа после ТО (кг)',
      width: 200,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
    {
      field: 'postShipDiff',
      headerName: 'Разница пост/отгр',
      width: 150,
      sortable: true,
      valueFormatter: (params) => formatNumber(params?.value),
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom align="center">
          Просмотр данных листов
        </Typography>

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
              getRowId={(row) => {
  // Если matid существует и не пустой, используем его
  if (row.matid && row.matid.trim() !== '') {
    return row.matid;
  }
  // Иначе создаём составной ключ из доступных полей
  return `row-${row.sheetNumber || ''}-${row.batchNumber || ''}-${Math.random()}`;
}}
              rowCount={totalCount}
              pagination
              page={page - 1}
              onPageChange={(newPage) => setPage(newPage + 1)}
              pageSize={pageSize}
              onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
              paginationMode="server"
              sortingMode="server"
              onSortModelChange={setSortModel}
              loading={loading}
              rowsPerPageOptions={[10, 25, 50, 100]}
              disableSelectionOnClick
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
    </Container>
  );
};

export default InputDataView;