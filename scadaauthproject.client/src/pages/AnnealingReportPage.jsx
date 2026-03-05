// Файл: AnnealingReportPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Typography, Box, Button, Grid, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, IconButton
} from '@mui/material';
import { Print as PrintIcon, FileDownload as PdfIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../api';
import dayjs from 'dayjs';

const AnnealingReportPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState([]);
  
  // Состояния фильтров
  const [filters, setFilters] = useState({
    dateFrom: dayjs().startOf('month').format('YYYY-MM-DD'),
    dateTo: dayjs().format('YYYY-MM-DD'),
    statusFilter: '',
    furnaceNumberFilter: ''
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
      setError('Ошибка загрузки данных отчета');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const statuses = ['Создан', 'Готов к запуску', 'В работе', 'Завершён', 'Прерван', 'Отменён'];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Стили для печати */}
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4 landscape; }
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .MuiPaper-root { box-shadow: none !important; border: none !important; }
          .MuiTableContainer-root { overflow: visible !important; }
          table { width: 100%; font-size: 10pt; }
          th, td { border: 1px solid #ddd !important; padding: 4px !important; }
        }
        .print-only { display: none; }
      `}</style>

      <Paper sx={{ p: 3 }} ref={componentRef}>
        {/* Заголовок (виден всегда, но стилизуется при печати) */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} className="print-header">
          <Typography variant="h4" component="h1">
            Отчет по графику проката и закалки
          </Typography>
          <Box className="no-print">
            <IconButton onClick={fetchReport} color="primary" title="Обновить">
              <RefreshIcon />
            </IconButton>
            <Button 
              variant="contained" 
              startIcon={<PrintIcon />} 
              onClick={handlePrint}
              sx={{ ml: 1 }}
            >
              Печать / PDF
            </Button>
          </Box>
        </Box>

        {/* Фильтры (скрываются при печати) */}
        <Box className="no-print" sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Grid container spacing={2} alignItems="end">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Дата с"
                type="date"
                name="dateFrom"
                value={filters.dateFrom}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Дата по"
                type="date"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Статус"
                name="statusFilter"
                value={filters.statusFilter}
                onChange={handleFilterChange}
                fullWidth
                size="small"
              >
                <MenuItem value="">Все</MenuItem>
                {statuses.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Печь №"
                name="furnaceNumberFilter"
                value={filters.furnaceNumberFilter}
                onChange={handleFilterChange}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={12} textAlign="right">
              <Button variant="outlined" onClick={fetchReport} disabled={loading}>
                Применить фильтры
              </Button>
            </Grid>
          </Grid>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={5}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Информация об отчете для печати */}
            <Box className="print-only" sx={{ mb: 2, fontSize: '0.9rem' }}>
              <strong>Период:</strong> {filters.dateFrom} — {filters.dateTo} | 
              <strong> Сформирован:</strong> {new Date().toLocaleString()}
            </Box>

            <TableContainer>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Название плана</TableCell>
                    <TableCell>Печь</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Заплан. Начало</TableCell>
                    <TableCell>Заплан. Конец</TableCell>
                    <TableCell>Факт. Начало</TableCell>
                    <TableCell>Факт. Конец</TableCell>
                    <TableCell align="right">Листов</TableCell>
                    <TableCell align="right">Вес (кг)</TableCell>
                    <TableCell>Примечание / Листы</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center">Нет данных за выбранный период</TableCell>
                    </TableRow>
                  ) : (
                    reportData.map((row) => (
                      <TableRow key={row.planId} hover>
                        <TableCell>{row.planId}</TableCell>
                        <TableCell>{row.planName}</TableCell>
                        <TableCell>{row.furnaceNumber}</TableCell>
                        <TableCell>
                          {/* Можно добавить цветовой индикатор статуса, если нужно */}
                          {row.status}
                        </TableCell>
                        <TableCell>
                          {row.scheduledStartTime ? new Date(row.scheduledStartTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }) : '-'}
                        </TableCell>
                        <TableCell>
                          {row.scheduledEndTime ? new Date(row.scheduledEndTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }) : '-'}
                        </TableCell>
                        <TableCell>
                          {row.actualStartTime ? new Date(row.actualStartTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }) : '-'}
                        </TableCell>
                        <TableCell>
                          {row.actualEndTime ? new Date(row.actualEndTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }) : '-'}
                        </TableCell>
                        <TableCell align="right">{row.sheetsCount}</TableCell>
                        <TableCell align="right">{row.totalWeightKg.toFixed(2)}</TableCell>
                        <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.notes || row.sheetDetails}
                        </TableCell>
                      </TableRow>
                    ))
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