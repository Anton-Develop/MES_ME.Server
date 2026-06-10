// src/components/Furnace/FurnaceSessionsList.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Button,
  Typography, Chip, CircularProgress, Grid, IconButton,
  Tooltip, Alert, Popover, InputAdornment
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Visibility, Refresh, ArrowUpward, ArrowDownward,
  FilterList, Close, Search, Clear, WaterDrop, Assessment, Thermostat,
} from '@mui/icons-material';
import { furnaceApi } from '../../api/furnaceApi';
import { quenchingApi } from '../../api/quenchingApi';
import PageContainer from '../PageContainer';
import api from '../../api';

const fmtDate = (d) => d
  ? new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  : '—';

const fmtMin = (v) => v != null ? `${Number(v).toFixed(1)} мин` : '—';

const formatSlab = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).padStart(5, '0');
};

const columns = [
  { id: 'sheet', label: 'Лист', type: 'number' },
  { id: 'slab', label: 'Сляб', type: 'number', render: (row) => formatSlab(row.slab) },
  { id: 'melt', label: 'Плавка', type: 'number' },
  { id: 'partNo', label: 'Партия', type: 'number' },
  { id: 'pack', label: 'Пачка', type: 'number' },
  { id: 'reheatNum', label: '№ нагрева', type: 'number' },
  { id: 'enteredAt', label: 'Вход', type: 'datetime' },
  { id: 'exitedAt', label: 'Выход', type: 'datetime' },
  { id: 'totalMin', label: 'Время', type: 'number' },
  { id: 'zonesPath', label: 'Маршрут', type: 'string' },
  { id: 'alloyCodeText', label: 'Марка стали', type: 'string' },
  { id: 'hadAlarm', label: 'Авария', type: 'boolean' },
];

const FurnaceSessionsList = () => {
  const navigate = useNavigate();

  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [sortBy, setSortBy] = useState('enteredAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [columnFilters, setColumnFilters] = useState({});
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [filterTempValue, setFilterTempValue] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');

  // ✅ ДОБАВЛЕНО: sheet
    const [draft, setDraft] = useState({
    sheet: '', slab: '', melt: '', part: '', batch: '', alloyCode: '', dateFrom: '', dateTo: '',
  });
  const [applied, setApplied] = useState({
    sheet: '', slab: '', melt: '', part: '', batch: '', alloyCode: '', dateFrom: '', dateTo: '',
  });

  const fetchSessions = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await furnaceApi.getSessions({
        page: 1,
        pageSize: 10000,
        sheet: filters.sheet || undefined,       // ✅ Передаем лист
        slab: filters.slab || undefined,
        melt: filters.melt || undefined,
        part: filters.part || undefined,
        batch: filters.batch || undefined,
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

  useEffect(() => {
    fetchSessions(applied);
  }, [applied, fetchSessions]);

  const handleApplyFilter = () => {
    setPage(0);
    setApplied({ ...draft });
    setColumnFilters({});
    setGlobalSearch('');
  };

  const handleResetFilters = () => {
    setDraft({ sheet: '', slab: '', melt: '', part: '', batch: '', alloyCode: '', dateFrom: '', dateTo: '' });
    setApplied({ sheet: '', slab: '', melt: '', part: '', batch: '', alloyCode: '', dateFrom: '', dateTo: '' });
    setColumnFilters({});
    setGlobalSearch('');
    setPage(0);
  };

  // ============ КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ ============
  const filteredSessions = useMemo(() => {
    let result = [...allSessions];

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
            const itemDate = new Date(itemValue).toLocaleDateString('ru-RU');
            return itemDate.includes(filterValue);
          case 'string':
          default:
            return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
        }
      });
    });

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

  const paginatedSessions = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedSessions.slice(start, start + rowsPerPage);
  }, [sortedSessions, page, rowsPerPage]);

  const totalFiltered = sortedSessions.length;

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
      setColumnFilters(prev => ({ ...prev, [activeFilterColumn]: filterTempValue }));
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

  const getSortIcon = (columnId) => {
    if (sortBy !== columnId) return null;
    return sortOrder === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  const isFilterActive = (columnId) => columnFilters[columnId] && columnFilters[columnId] !== '';
  const hasActiveClientFilters = Object.keys(columnFilters).length > 0 || globalSearch;

  return (
    <PageContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight={600}>Сессии нагрева листов</Typography>
        <Tooltip title="Обновить">
          <IconButton size="small" onClick={handleRefresh} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Всего: {allSessions.length} | Отфильтровано: {totalFiltered}
        </Typography>
      </Box>

      {/* СЕРВЕРНЫЕ ФИЛЬТРЫ */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Grid container spacing={1.5} alignItems="flex-end">
          {/* ✅ ДОБАВЛЕНО: Лист */}
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Лист" size="small" fullWidth
              value={draft.sheet}
              onChange={(e) => setDraft(d => ({ ...d, sheet: e.target.value.replace(/\D/g, '') }))}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Сляб" size="small" fullWidth
              value={draft.slab}
              onChange={(e) => setDraft(d => ({ ...d, slab: e.target.value.replace(/\D/g, '') }))}
              onBlur={(e) => {
                if (e.target.value) setDraft(d => ({ ...d, slab: e.target.value.padStart(5, '0') }));
              }}
              inputProps={{ maxLength: 5, inputMode: 'numeric' }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Плавка" size="small" fullWidth
              value={draft.melt}
              onChange={(e) => setDraft(d => ({ ...d, melt: e.target.value.replace(/\D/g, '') }))}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Партия" size="small" fullWidth
              value={draft.part}
              onChange={(e) => setDraft(d => ({ ...d, part: e.target.value.replace(/\D/g, '') }))}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Пачка" size="small" fullWidth
              value={draft.batch}
              onChange={(e) => setDraft(d => ({ ...d, batch: e.target.value.replace(/\D/g, '') }))}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Марка стали" size="small" fullWidth
              value={draft.alloyCode}
              onChange={(e) => setDraft(d => ({ ...d, alloyCode: e.target.value }))}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Дата с" type="datetime-local" size="small" fullWidth
              value={draft.dateFrom}
              onChange={(e) => setDraft(d => ({ ...d, dateFrom: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Дата по" type="datetime-local" size="small" fullWidth
              value={draft.dateTo}
              onChange={(e) => setDraft(d => ({ ...d, dateTo: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Button variant="contained" onClick={handleApplyFilter} fullWidth>Применить</Button>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Button variant="outlined" onClick={handleResetFilters} fullWidth>Сбросить</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#f8f9fa' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth size="small" placeholder="Глобальный поиск по таблице..."
              value={globalSearch} onChange={handleGlobalSearchChange}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                endAdornment: globalSearch && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setGlobalSearch('')}><Close fontSize="small" /></IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">Фильтр по столбцам:</Typography>
              {hasActiveClientFilters && (
                <Button size="small" onClick={handleClearAllClientFilters} startIcon={<Clear />}>Сбросить все фильтры</Button>
              )}
              {Object.entries(columnFilters).map(([key, value]) => {
                const column = columns.find(c => c.id === key);
                return (
                  <Chip key={key} label={`${column?.label}: ${value}`} onDelete={() => handleClearColumnFilter(key)} size="small" color="primary" variant="outlined" />
                );
              })}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto', maxWidth: '100%' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id} sx={{ fontWeight: 600, backgroundColor: '#fafafa', whiteSpace: 'nowrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Button size="small" onClick={() => handleSort(col.id)} sx={{ minWidth: 'auto', p: 0.5, fontWeight: 600, textTransform: 'none', color: 'text.primary', '&:hover': { backgroundColor: 'transparent' } }}>
                      {col.label}{getSortIcon(col.id)}
                    </Button>
                    <Tooltip title="Фильтр по столбцу">
                      <IconButton size="small" onClick={(e) => handleOpenFilter(e, col.id)} sx={{ p: 0.5, color: isFilterActive(col.id) ? 'primary.main' : 'action.active' }}>
                        <FilterList fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 600, backgroundColor: '#fafafa', whiteSpace: 'nowrap' }} align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4 }}><CircularProgress size={32} /></TableCell></TableRow>
            ) : paginatedSessions.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4, color: 'text.secondary' }}>Нет данных</TableCell></TableRow>
            ) : (
              paginatedSessions.map(s => (
                <TableRow key={s.businessKey ?? s.id} hover sx={{ bgcolor: s.reheatNum > 0 ? '#fff8e1' : 'inherit' }}>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.sheet}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{formatSlab(s.slab)}</TableCell>
                  <TableCell>{s.melt ?? '—'}</TableCell>
                  <TableCell>{s.partNo ?? '—'}</TableCell>
                  <TableCell>{s.pack ?? '—'}</TableCell>
                  <TableCell>
                    {s.reheatNum > 0 ? <Chip label={`Повтор ${s.reheatNum}`} size="small" color="warning" /> : <Chip label="Первый" size="small" color="success" variant="outlined" />}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{fmtDate(s.enteredAt)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{fmtDate(s.exitedAt)}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'warning.dark' }}>{fmtMin(s.totalMin)}</TableCell>
                  <TableCell><Chip label={s.zonesPath ?? '—'} size="small" variant="outlined" color="primary" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }} /></TableCell>
                  <TableCell>{s.alloyCodeText || s.alloyCode || '—'}</TableCell>
                  <TableCell>{s.hadAlarm && <Chip label="АВАРИЯ" size="small" color="error" />}</TableCell>
                  <TableCell align="center" sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                      <Tooltip title="Сводный отчёт по листу">
                        <IconButton size="small" color="secondary" onClick={() => {
                          const furnaceKey = `${s.melt}-${s.partNo}-${s.pack}-${s.sheet}-${s.reheatNum ?? 0}`;
                          const quenchingKey = `${s.sheet}|${s.melt}|${s.partNo}|${s.pack}|${s.reheatNum ?? 0}`;
                          window.open(`/sheet-report?furnaceKey=${encodeURIComponent(furnaceKey)}&quenchingKey=${encodeURIComponent(quenchingKey)}`, '_blank');
                        }} sx={{ p: 0.75 }}><Assessment fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Открыть отчёт по нагреву">
                        <IconButton size="small" color="primary" onClick={() => { if (s.businessKey) window.open(`/furnace/report?key=${encodeURIComponent(s.businessKey)}`, '_blank'); }} disabled={!s.businessKey} sx={{ p: 0.75 }}><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Отчёт по закалке">
                        <IconButton size="small" color="info" disabled={!s.businessKey} onClick={() => {
                          if (!s.businessKey) return;
                          quenchingApi.getSessionsBySheet(s.sheet).then(res => {
                            const sessions = res.data || [];
                            const matched = sessions.find(qs => qs.melt === s.melt && qs.partNo === s.partNo && qs.pack === s.pack && qs.reheatNum === (s.reheatNum ?? 0));
                            const key = matched?.businessKey || sessions[0]?.businessKey;
                            if (key) window.open(`/quenching/report?key=${encodeURIComponent(key)}`, '_blank');
                          }).catch(err => console.error("Ошибка поиска отчета по закалке: ", err));
                        }} sx={{ p: 0.75 }}><WaterDrop fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Отчёт по отпуску">
                        <IconButton size="small" color="warning" onClick={async () => {
                          try {
                            const response = await api.get(`/tempering/cassette-key-by-sheet?sheet=${encodeURIComponent(s.sheet)}&melt=${encodeURIComponent(s.melt)}&partNo=${encodeURIComponent(s.partNo)}&pack=${encodeURIComponent(s.pack)}`);
                            if (response.data.cassetteBusinessKey) {
                              window.open(`/tempering/report?key=${encodeURIComponent(response.data.cassetteBusinessKey)}`, '_blank');
                            } else {
                              alert("Лист не найден в кассетах отпуска");
                            }
                          } catch (err) {
                            alert(err.response?.data?.error || "Ошибка при поиске данных по отпуску");
                          }
                        }} sx={{ p: 0.75 }}><Thermostat fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 20, 50, 100]} component="div" count={totalFiltered}
          rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage} labelRowsPerPage="Строк на странице: "
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
        />
      </TableContainer>

      <Popover open={Boolean(filterAnchorEl)} anchorEl={filterAnchorEl} onClose={handleCloseFilter}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}>
        <Box sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="subtitle2" gutterBottom>Фильтр: {columns.find(c => c.id === activeFilterColumn)?.label}</Typography>
          <TextField fullWidth size="small" placeholder="Введите значение..." value={filterTempValue}
            onChange={(e) => setFilterTempValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleApplyColumnFilter()} autoFocus />
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={handleCloseFilter}>Отмена</Button>
            <Button size="small" variant="contained" onClick={handleApplyColumnFilter}>Применить</Button>
          </Box>
        </Box>
      </Popover>
    </PageContainer>
  );
};

export default FurnaceSessionsList;