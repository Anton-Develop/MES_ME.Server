// src/components/Furnace/FurnaceSessionsList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Button,
  Typography, Chip, CircularProgress, Grid, IconButton,
  Tooltip, Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Visibility, Print, Refresh } from '@mui/icons-material';
import { furnaceApi } from '../../api/furnaceApi';

const fmtDate = (d) => d
  ? new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  : '—';

const fmtMin = (v) => v != null ? `${Number(v).toFixed(1)} мин` : '—';

const FurnaceSessionsList = () => {
  const navigate = useNavigate();

  // Данные
  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [total,       setTotal]       = useState(0);

  // Пагинация (MUI TablePagination — 0-based)
  const [page,        setPage]        = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Фильтры — черновик (до нажатия «Применить»)
  const [draft, setDraft] = useState({
    slab: '', melt: '', alloyCode: '', dateFrom: '', dateTo: '',
  });

  // Применённые фильтры (то что реально передаётся в запрос)
  const [applied, setApplied] = useState({
    slab: '', melt: '', alloyCode: '', dateFrom: '', dateTo: '',
  });

  const fetchSessions = useCallback(async (pg, rpp, filters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await furnaceApi.getSessions({
        page:      pg + 1,         // backend 1-based
        pageSize:  rpp,
        slab:      filters.slab      || undefined,
        melt:      filters.melt      || undefined,
        alloyCode: filters.alloyCode || undefined,
        from:      filters.dateFrom  || undefined,
        to:        filters.dateTo    || undefined,
      });
      setSessions(res.data.items  ?? []);
      setTotal(res.data.total     ?? 0);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем при монтировании и при смене страницы/rowsPerPage
  useEffect(() => {
    fetchSessions(page, rowsPerPage, applied);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage]);

  const handleApplyFilter = () => {
    setPage(0);
    setApplied({ ...draft });
    fetchSessions(0, rowsPerPage, draft);
  };

  const handleRefresh = () => fetchSessions(page, rowsPerPage, applied);

  const handleChangePage = (_, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleViewReport = (key) =>
    navigate(`/furnace/report/${encodeURIComponent(key)}`);

  const handlePrint = (key) => {
    const w = window.open(
      `/furnace/report/${encodeURIComponent(key)}?print=true`,
      '_blank'
    );
    w?.focus();
  };

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
          Всего: {total}
        </Typography>
      </Box>

      {/* Фильтры */}
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
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Таблица */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><b>Лист</b></TableCell>
              <TableCell><b>Сляб</b></TableCell>
              <TableCell><b>Плавка</b></TableCell>
              <TableCell><b>Партия</b></TableCell>
              <TableCell><b>Пачка</b></TableCell>
              <TableCell><b>№ нагрева</b></TableCell>
              <TableCell><b>Вход</b></TableCell>
              <TableCell><b>Выход</b></TableCell>
              <TableCell><b>Время</b></TableCell>
              <TableCell><b>F1</b></TableCell>
              <TableCell><b>F2</b></TableCell>
              <TableCell><b>F3</b></TableCell>
              <TableCell><b>F4</b></TableCell>
              <TableCell><b>Маршрут</b></TableCell>
              <TableCell><b>Сплав</b></TableCell>
              <TableCell><b>Авария</b></TableCell>
              <TableCell align="center"><b>Действия</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={17} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              sessions.map(s => (
                <TableRow
                  key={s.businessKey ?? s.id}
                  hover
                  sx={{
                    // Повторный нагрев — лёгкий жёлтый фон
                    bgcolor: s.reheatNum > 0 ? 'warning.50' : 'inherit',
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
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Строк на странице:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
        />
      </TableContainer>
    </Box>
  );
};

export default FurnaceSessionsList;