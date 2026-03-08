// src/pages/AnnealingReportPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Typography, Box, Button, Grid, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, IconButton, Chip,
} from '@mui/material';
import { Print as PrintIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../api';
import dayjs from 'dayjs';

// Константы вынесены за пределы компонента
const STATUSES = ['Создан', 'Готов к запуску', 'В работе', 'Завершён', 'Прерван', 'Отменён'];

const STATUS_COLORS = {
  'Создан': 'default', 'Готов к запуску': 'info', 'В работе': 'warning',
  'Завершён': 'success', 'Прерван': 'error', 'Отменён': 'secondary',
};

// ИСПРАВЛЕНО: вынесена вспомогательная функция форматирования дат
const fmtShort = (dt) =>
  dt ? new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

const AnnealingReportPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState([]);

  const [filters, setFilters] = useState({
    dateFrom: dayjs().startOf('month').format('YYYY-MM-DD'),
    dateTo: dayjs().format('YYYY-MM-DD'),
    statusFilter: '',
    furnaceNumberFilter: '',
  });

  const componentRef = useRef();

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      };
      if (filters.statusFilter) params.statusFilter = filters.statusFilter;
      if (filters.furnaceNumberFilter) params.furnaceNumberFilter = filters.furnaceNumberFilter;

      const response = await api.get('/annealingbatchplan/report', { params });
      setReportData(response.data);
    } catch (err) {
      console.error(err);
      setError('Ошибка загрузки данных отчёта');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const handlePrint = () => window.print();

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // ИСПРАВЛЕНО: итого — добавлено вычисление суммарных показателей для отчёта
  const totals = reportData.reduce(
    (acc, row) => ({
      sheets: acc.sheets + (row.sheetsCount ?? 0),
      weight: acc.weight + (row.totalWeightKg ?? 0),
    }),
    { sheets: 0, weight: 0 }
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4 landscape; }
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .MuiPaper-root { box-shadow: none !important; }
          .MuiTableContainer-root { overflow: visible !important; }
          table { width: 100%; font-size: 10pt; }
          th, td { border: 1px solid #ccc !important; padding: 4px !important; }
        }
        .print-only { display: none; }
      `}</style>

      <Paper sx={{ p: 3 }} ref={componentRef}>
        {/* Заголовок */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Отчёт по плану закалки
          </Typography>
          <Box className="no-print">
            <IconButton onClick={fetchReport} color="primary" title="Обновить" disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ ml: 1 }}>
              Печать / PDF
            </Button>
          </Box>
        </Box>

        {/* Фильтры */}
        <Box className="no-print" sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Дата с" type="date" name="dateFrom" value={filters.dateFrom}
                onChange={handleFilterChange} InputLabelProps={{ shrink: true }} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Дата по" type="date" name="dateTo" value={filters.dateTo}
                onChange={handleFilterChange} InputLabelProps={{ shrink: true }} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField select label="Статус" name="statusFilter" value={filters.statusFilter}
                onChange={handleFilterChange} fullWidth size="small">
                <MenuItem value="">Все</MenuItem>
                {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Печь №" name="furnaceNumberFilter" value={filters.furnaceNumberFilter}
                onChange={handleFilterChange} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} textAlign="right">
              <Button variant="outlined" onClick={fetchReport} disabled={loading}>
                Применить фильтры
              </Button>
            </Grid>
          </Grid>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Строка для печати */}
        <Box className="print-only" sx={{ mb: 2 }}>
          <strong>Период:</strong> {filters.dateFrom} — {filters.dateTo} &nbsp;|&nbsp;
          <strong>Сформирован:</strong> {new Date().toLocaleString('ru-RU')}
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={5}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Название плана</TableCell>
                    <TableCell>Печь</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Запл. начало</TableCell>
                    <TableCell>Запл. конец</TableCell>
                    <TableCell>Факт. начало</TableCell>
                    <TableCell>Факт. конец</TableCell>
                    <TableCell align="right">Листов</TableCell>
                    <TableCell align="right">Вес (кг)</TableCell>
                    <TableCell>Примечание</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center">Нет данных за выбранный период</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {reportData.map(row => (
                        <TableRow key={row.planId} hover>
                          <TableCell>{row.planId}</TableCell>
                          <TableCell>{row.planName}</TableCell>
                          <TableCell>{row.furnaceNumber}</TableCell>
                          <TableCell>
                            {/* ИСПРАВЛЕНО: добавлен Chip со цветом статуса вместо plain text */}
                            <Chip label={row.status} color={STATUS_COLORS[row.status] ?? 'default'} size="small" />
                          </TableCell>
                          <TableCell>{fmtShort(row.scheduledStartTime)}</TableCell>
                          <TableCell>{fmtShort(row.scheduledEndTime)}</TableCell>
                          <TableCell>{fmtShort(row.actualStartTime)}</TableCell>
                          <TableCell>{fmtShort(row.actualEndTime)}</TableCell>
                          <TableCell align="right">{row.sheetsCount}</TableCell>
                          {/* ИСПРАВЛЕНО: row.totalWeightKg может быть null — защищаем через ?? */}
                          <TableCell align="right">{(row.totalWeightKg ?? 0).toFixed(2)}</TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.notes || row.sheetDetails || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* ИСПРАВЛЕНО: добавлена строка итогов */}
                      <TableRow sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        <TableCell colSpan={8}><strong>Итого:</strong></TableCell>
                        <TableCell align="right"><strong>{totals.sheets}</strong></TableCell>
                        <TableCell align="right"><strong>{totals.weight.toFixed(2)}</strong></TableCell>
                        <TableCell />
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default AnnealingReportPage;
