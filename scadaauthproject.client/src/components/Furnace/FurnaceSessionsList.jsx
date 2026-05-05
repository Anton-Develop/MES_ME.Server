// src/components/Furnace/FurnaceSessionsList.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Button,
  Typography, Chip, CircularProgress, Grid, IconButton,
  Tooltip, Alert, Popover, InputAdornment,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Visibility, Print, Refresh, ArrowUpward, ArrowDownward,
  FilterList, Close, Search, Clear,
} from '@mui/icons-material';
import { furnaceApi } from '../../api/furnaceApi';

const fmtDate = (d) => d
  ? new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  : '—';

const fmtMin = (v) => v != null ? `${Number(v).toFixed(1)} мин` : '—';

// Конфигурация столбцов для сортировки и фильтрации
const columns = [
  { id: 'sheet', label: 'Лист', type: 'string' },
  { id: 'slab', label: 'Сляб', type: 'string' },
  { id: 'melt', label: 'Плавка', type: 'string' },
  { id: 'partNo', label: 'Партия', type: 'string' },
  { id: 'pack', label: 'Пачка', type: 'string' },
  { id: 'reheatNum', label: '№ нагрева', type: 'number' },
  { id: 'enteredAt', label: 'Вход', type: 'datetime' },
  { id: 'exitedAt', label: 'Выход', type: 'datetime' },
  { id: 'totalMin', label: 'Время', type: 'number' },
  { id: 'f1Min', label: 'F1', type: 'number' },
  { id: 'f2Min', label: 'F2', type: 'number' },
  { id: 'f3Min', label: 'F3', type: 'number' },
  { id: 'f4Min', label: 'F4', type: 'number' },
  { id: 'zonesPath', label: 'Маршрут', type: 'string' },
  { id: 'alloyCodeText', label: 'Сплав', type: 'string' },
  { id: 'hadAlarm', label: 'Авария', type: 'boolean' },
];

const FurnaceSessionsList = () => {
  const navigate = useNavigate();

  // Данные с сервера
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Клиентская пагинация
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Сортировка
  const [sortBy, setSortBy] = useState('enteredAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Фильтры для столбцов (клиентские)
  const [columnFilters, setColumnFilters] = useState({});
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [filterTempValue, setFilterTempValue] = useState('');

  // Глобальный поиск
  const [globalSearch, setGlobalSearch] = useState('');

  // ВАШИ ОРИГИНАЛЬНЫЕ ФИЛЬТРЫ (с серверной фильтрацией)
  const [draft, setDraft] = useState({
    slab: '', melt: '', alloyCode: '', dateFrom: '', dateTo: '',
  });
  const [applied, setApplied] = useState({
    slab: '', melt: '', alloyCode: '', dateFrom: '', dateTo: '',
  });

  // Загрузка данных с учетом ВАШИХ фильтров
  const fetchSessions = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await furnaceApi.getSessions({
        page: 1,
        pageSize: 10000,
        slab: filters.slab || undefined,
        melt: filters.melt || undefined,
        alloyCode: filters.alloyCode || undefined,
        from: filters.dateFrom || undefined,
        to: filters.dateTo || undefined,
      });
      setAllSessions(res.data.items ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем при изменении applied фильтров
  useEffect(() => {
    fetchSessions(applied);
  }, [applied, fetchSessions]);

  // Применение ВАШИХ фильтров (с сервера)
  const handleApplyFilter = () => {
    setPage(0);
    setApplied({ ...draft });
    setColumnFilters({}); // Сбрасываем клиентские фильтры
    setGlobalSearch('');   // Сбрасываем глобальный поиск
  };

  // Сброс ВАШИХ фильтров
  const handleResetFilters = () => {
    setDraft({ slab: '', melt: '', alloyCode: '', dateFrom: '', dateTo: '' });
    setApplied({ slab: '', melt: '', alloyCode: '', dateFrom: '', dateTo: '' });
    setColumnFilters({});
    setGlobalSearch('');
    setPage(0);
  };

  // ============ КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ ============
  const filteredSessions = useMemo(() => {
    let result = [...allSessions];

    // Применяем фильтры по столбцам (клиентские)
    Object.entries(columnFilters).forEach(([columnId, filterValue]) => {
      if (!filterValue || filterValue === '') return;
      
      result = result.filter(item => {
        const itemValue = item[columnId];
        if (itemValue == null) return false;
        
        const column = columns.find(c => c.id === columnId);
        
        switch (column?.type) {
          case 'boolean':
            return String(itemValue) === filterValue;
          case 'number':
            return Number(itemValue) === Number(filterValue);
          case 'datetime':
            // Фильтрация по дате (сравнение только по дате без времени)
            const itemDate = new Date(itemValue).toLocaleDateString('ru-RU');
            return itemDate.includes(filterValue);
          case 'string':
          default:
            return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
        }
      });
    });

    // Глобальный поиск
    if (globalSearch.trim()) {
      const searchLower = globalSearch.toLowerCase();
      result = result.filter(item => {
        return columns.some(col => {
          const value = item[col.id];
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    return result;
  }, [allSessions, columnFilters, globalSearch]);

  // Сортировка
  const sortedSessions = useMemo(() => {
    const sorted = [...filteredSessions];
    
    sorted.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const column = columns.find(c => c.id === sortBy);
      
      switch (column?.type) {
        case 'number':
          aVal = Number(aVal);
          bVal = Number(bVal);
          break;
        case 'datetime':
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
          break;
        case 'boolean':
          aVal = aVal ? 1 : 0;
          bVal = bVal ? 1 : 0;
          break;
        default:
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredSessions, sortBy, sortOrder]);

  // Пагинация
  const paginatedSessions = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedSessions.slice(start, start + rowsPerPage);
  }, [sortedSessions, page, rowsPerPage]);

  const totalFiltered = sortedSessions.length;

  // Обработчики сортировки и фильтров
  const handleSort = (columnId) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnId);
      setSortOrder('asc');
    }
  };

  const handleOpenFilter = (event, columnId) => {
    setActiveFilterColumn(columnId);
    setFilterTempValue(columnFilters[columnId] || '');
    setFilterAnchorEl(event.currentTarget);
  };

  const handleCloseFilter = () => {
    setFilterAnchorEl(null);
    setActiveFilterColumn(null);
    setFilterTempValue('');
  };

  const handleApplyColumnFilter = () => {
    if (activeFilterColumn) {
      setColumnFilters(prev => ({
        ...prev,
        [activeFilterColumn]: filterTempValue,
      }));
      setPage(0);
    }
    handleCloseFilter();
  };

  const handleClearColumnFilter = (columnId) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnId];
      return newFilters;
    });
    setPage(0);
  };

  const handleClearAllClientFilters = () => {
    setColumnFilters({});
    setGlobalSearch('');
    setPage(0);
  };

  const handleGlobalSearchChange = (e) => {
    setGlobalSearch(e.target.value);
    setPage(0);
  };

  const handleRefresh = () => {
    fetchSessions(applied);
  };

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleViewReport = (businessKey) =>
    navigate(`/furnace/report?key=${encodeURIComponent(businessKey)}`);

  const handlePrint = (businessKey) => {
    const w = window.open(
      `/furnace/report?key=${encodeURIComponent(businessKey)}&print=true`,
      '_blank'
    );
    w?.focus();
  };

  const getSortIcon = (columnId) => {
    if (sortBy !== columnId) return null;
    return sortOrder === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  const isFilterActive = (columnId) => {
    return columnFilters[columnId] && columnFilters[columnId] !== '';
  };

  const hasActiveClientFilters = Object.keys(columnFilters).length > 0 || globalSearch;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight={600}>
          Сессии нагрева листов
        </Typography>
        <Tooltip title="Обновить">
          <IconButton size="small" onClick={handleRefresh} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Всего: {allSessions.length} | Отфильтровано: {totalFiltered}
        </Typography>
      </Box>

      {/* ВАШИ ОРИГИНАЛЬНЫЕ ФИЛЬТРЫ (с сервера) */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Grid container spacing={1.5} alignItems="flex-end">
          <Grid item xs={6} sm={2}>
            <TextField
              label="Сляб" size="small" fullWidth value={draft.slab}
              onChange={e => setDraft(d => ({ ...d, slab: e.target.value }))}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField
              label="Плавка" size="small" fullWidth value={draft.melt}
              onChange={e => setDraft(d => ({ ...d, melt: e.target.value }))}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField
              label="Код сплава" size="small" fullWidth value={draft.alloyCode}
              onChange={e => setDraft(d => ({ ...d, alloyCode: e.target.value }))}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField
              label="Дата с" type="datetime-local" size="small" fullWidth
              value={draft.dateFrom}
              onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField
              label="Дата по" type="datetime-local" size="small" fullWidth
              value={draft.dateTo}
              onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <Button variant="contained" onClick={handleApplyFilter} fullWidth>
              Применить
            </Button>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Button variant="outlined" onClick={handleResetFilters} fullWidth>
              Сбросить
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Дополнительная фильтрация (клиентская) */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#f8f9fa' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Глобальный поиск по таблице..."
              value={globalSearch}
              onChange={handleGlobalSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: globalSearch && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setGlobalSearch('')}>
                      <Close fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                Фильтр по столбцам:
              </Typography>
              {hasActiveClientFilters && (
                <Button size="small" onClick={handleClearAllClientFilters} startIcon={<Clear />}>
                  Сбросить все фильтры
                </Button>
              )}
              {Object.entries(columnFilters).map(([key, value]) => {
                const column = columns.find(c => c.id === key);
                return (
                  <Chip
                    key={key}
                    label={`${column?.label}: ${value}`}
                    onDelete={() => handleClearColumnFilter(key)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                );
              })}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Таблица */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  sx={{ 
                    fontWeight: 600,
                    backgroundColor: '#fafafa',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Button
                      size="small"
                      onClick={() => handleSort(col.id)}
                      sx={{ 
                        minWidth: 'auto', 
                        p: 0.5, 
                        fontWeight: 600,
                        textTransform: 'none',
                        color: 'text.primary',
                        '&:hover': { backgroundColor: 'transparent' },
                      }}
                    >
                      {col.label}
                      {getSortIcon(col.id)}
                    </Button>
                    
                    <Tooltip title="Фильтр по столбцу">
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenFilter(e, col.id)}
                        sx={{ 
                          p: 0.5,
                          color: isFilterActive(col.id) ? 'primary.main' : 'action.active',
                        }}
                      >
                        <FilterList fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              ))}
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  backgroundColor: '#fafafa',
                  whiteSpace: 'nowrap',
                }}
                align="center"
              >
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : paginatedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              paginatedSessions.map(s => (
                <TableRow
                  key={s.businessKey ?? s.id}
                  hover
                  sx={{
                    bgcolor: s.reheatNum > 0 ? '#fff8e1' : 'inherit',
                  }}
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {s.sheet}
                  </TableCell>
                  <TableCell>{s.slab ?? '—'}</TableCell>
                  <TableCell>{s.melt ?? '—'}</TableCell>
                  <TableCell>{s.partNo ?? '—'}</TableCell>
                  <TableCell>{s.pack ?? '—'}</TableCell>
                  <TableCell>
                    {s.reheatNum > 0
                      ? <Chip label={`Повтор ${s.reheatNum}`} size="small" color="warning" />
                      : <Chip label="Первый" size="small" color="success" variant="outlined" />
                    }
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {fmtDate(s.enteredAt)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {fmtDate(s.exitedAt)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'warning.dark' }}>
                    {fmtMin(s.totalMin)}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{fmtMin(s.f1Min)}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{fmtMin(s.f2Min)}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{fmtMin(s.f3Min)}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{fmtMin(s.f4Min)}</TableCell>
                  <TableCell>
                    <Chip
                      label={s.zonesPath ?? '—'}
                      size="small" variant="outlined" color="primary"
                      sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}
                    />
                  </TableCell>
                  <TableCell>{s.alloyCodeText || s.alloyCode || '—'}</TableCell>
                  <TableCell>
                    {s.hadAlarm && (
                      <Chip label="АВАРИЯ" size="small" color="error" />
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Открыть отчёт">
                      <IconButton
                        size="small" color="primary"
                        onClick={() => handleViewReport(s.businessKey)}
                        disabled={!s.businessKey}
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Печать">
                      <IconButton
                        size="small"
                        onClick={() => handlePrint(s.businessKey)}
                        disabled={!s.businessKey}
                      >
                        <Print fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[10, 20, 50, 100]}
          component="div"
          count={totalFiltered}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Строк на странице:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
        />
      </TableContainer>

      {/* Popover для фильтрации столбца */}
      <Popover
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={handleCloseFilter}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="subtitle2" gutterBottom>
            Фильтр: {columns.find(c => c.id === activeFilterColumn)?.label}
          </Typography>
          
          <TextField
            fullWidth
            size="small"
            placeholder="Введите значение..."
            value={filterTempValue}
            onChange={(e) => setFilterTempValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleApplyColumnFilter()}
            autoFocus
          />
          
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={handleCloseFilter}>
              Отмена
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleApplyColumnFilter}
            >
              Применить
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
};

export default FurnaceSessionsList;