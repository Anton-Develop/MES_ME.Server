// src/components/Reports/TemperingReport.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Chip, Divider, Button,
  CircularProgress, Alert, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow
} from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import api from '../../api';

const fmtDate = (d) => d
  ? new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  : '—';

const fmtMin = (v) => v != null ? `${Number(v).toFixed(0)} мин` : '—';
const fmtTemp = (v) => v != null ? `${Number(v).toFixed(0)} °C` : '—';

const TemperingReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const businessKey = searchParams.get('key');
  const isPrint = searchParams.get('print') === 'true';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!businessKey) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/tempering/session-by-key?key=${encodeURIComponent(businessKey)}&coolingMinutes=60`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Ошибка загрузки данных отпуска');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [businessKey]);

  useEffect(() => {
    if (isPrint && !loading && data) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [isPrint, loading, data]);

  // ✅ Подготовка данных для графика Highcharts
  const chartOptions = useMemo(() => {
    if (!data?.tempData || data.tempData.length === 0) {
      return null;
    }

    // Функция для преобразования данных в формат [timestamp, value]
    // Это позволяет оси X корректно масштабироваться и показывать даты
    const toChartData = (key) =>
      data.tempData.map(d => {
        const val = d[key];
        // Если значение отсутствует, возвращаем null, Highcharts корректно обработает разрывы
        return [new Date(d.time).getTime(), val != null ? Number(val) : null];
      });


    const categories = data.tempData.map(d => {
      const date = new Date(d.time);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    });

    return {
      chart: {
        type: 'spline',
        height: 400,
        zoomType: 'xy'
      },
      title: {
        text: 'Температурный профиль отпуска'
      },
      xAxis: {
        type: 'datetime', // ⬅️ Ключевое изменение: используем datetime вместо категорий
        title: { text: 'Время' },
        crosshair: true,
        // Автоматический подбор формата меток оси X в зависимости от масштаба
        dateTimeLabelFormats: {
          second: '%H:%M:%S',
          minute: '%H:%M',
          hour: '%H:%M',
          day: '%d.%m',
          week: '%d.%m',
          month: '%m.%Y',
          year: '%Y'
        }
      },
      yAxis: {
        title: { text: 'Температура, °C' },
        min: 0
      },
      tooltip: {
        shared: true,
        crosshairs: true,
        useHTML: true,
        // ⬅️ Добавляем полную дату и время в заголовок тултипа
        headerFormat: '<span style="font-size: 13px; font-weight: bold;">{point.key:%d.%m.%Y %H:%M:%S}</span><br/>',
        valueSuffix: ' °C'
      },
      legend: {
        enabled: true
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          animation: false
        }
      },
      series: [
        {
          name: 'Заданная температура',
          data: toChartData('tempRef'),
          color: '#1976d2',
          dashStyle: 'Dash'
        },
        {
          name: 'Фактическая температура',
          data: toChartData('tempAct'),
          color: '#d29922'
        },
        {
          name: 'T1',
          data: toChartData('t1'),
          color: '#2e7d32',
          visible: false
        },
        {
          name: 'T2',
          data: toChartData('t2'),
          color: '#c62828',
          visible: false
        }
      ],
      credits: { enabled: false }
    };
  }, [data?.tempData]);

  if (loading) {
    return (
      <Box sx={{ p: 5, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Загрузка отчёта по отпуску...
        </Typography>
      </Box>
    );
  }

  if (error || !data?.session) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Данные не найдены'}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} variant="outlined">
          Назад
        </Button>
      </Box>
    );
  }

  const { session, sheets } = data;
  const firstSheet = sheets?.[0] || {};

  const getStatusChip = () => {
    if (session.status?.includes('Авария') || session.status?.includes('fault')) {
      return <Chip label="АВАРИЯ" color="error" size="small" />;
    }
    if (session.status?.includes('вручную')) {
      return <Chip label="ВЫГРУЖЕН ВРУЧНУЮ" color="warning" size="small" />;
    }
    return <Chip label="ЗАВЕРШЕН ШТАТНО" color="success" size="small" />;
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh', '@media print': { p: 1, bgcolor: '#fff', '& .no-print': { display: 'none !important' } } }}>
      {/* Кнопки управления */}
      <Box className="no-print" sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        {/*<Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} variant="outlined">
          Назад
        </Button>*/}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
          Печать
        </Button>
      </Box>

      {/* Шапка отчета */}
      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap">
          <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Отчёт по отпуску листа №{firstSheet.sheet || '—'}
        </Typography>
         {/*  {getStatusChip()}*/}
        </Stack>

        {/* Метаданные */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {[
          { label: 'Лист', value: firstSheet.sheet },
          { label: 'Сляб', value: firstSheet.slab ?? '—' },
          { label: 'Плавка', value: firstSheet.melt ?? '—' }, 
          { label: 'Партия', value: firstSheet.partNo ?? '—' },
          { label: 'Пачка', value: firstSheet.pack ?? '—' },
          { label: 'Марка стали', value: firstSheet.alloyCodeText  ?? '—' },
          { label: 'Толщина', value: firstSheet.thickness != null ? `${Number(firstSheet.thickness).toFixed(1)} мм` : '—' },
          { label: 'Кассета', value: session.cassetteNumber ? `№${session.cassetteNumber}` : '—' },
          { label: 'Печь', value: session.furnaceNumber ? `№${session.furnaceNumber}` : '—' },
          { label: 'Слот', value: session.slotNumber != null ? `№${session.slotNumber}` : '—' },
        ].map(({ label, value }) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={label}>
              <Box>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                  {value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 1.5 }} />

        {/* Временные метки и операторы */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary">Загружена в печь</Typography>
            <Typography variant="body2" fontWeight={600}>{fmtDate(session.loadedAt)}</Typography>
            <Typography variant="caption" color="text.secondary">Оператор: {session.loadedBy || '—'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary">Выгружена из печи</Typography>
            <Typography variant="body2" fontWeight={600}>{fmtDate(session.unloadedAt)}</Typography>
            <Typography variant="caption" color="text.secondary">Оператор: {session.unloadedBy || '—'}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Технологические параметры */}
      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2, borderTop: '4px solid #d29922' }}>
        <Typography variant="h6" fontWeight={600} mb={2}>Параметры процесса отпуска</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">Заданная t°</Typography>
            <Typography variant="h5" fontWeight={700} color="primary">
              {fmtTemp(session.tempRef)}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">Общее время</Typography>
            <Typography variant="h6" fontWeight={600}>
              {fmtMin(session.totalTimeMin)}
            </Typography>
          </Grid>
        </Grid>
        <Alert severity="info" sx={{ mt: 2, fontSize: '0.85rem' }}>
          * Точные температурные кривые формируются на основе данных ПЛК. 
        </Alert>
      </Paper>

      {/* ✅ График температур */}
      {chartOptions && (
        <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>График температур</Typography>
          <HighchartsReact
            highcharts={Highcharts}
            options={chartOptions}
          />
        </Paper>
      )}

      {/* Список листов в кассете */}
      <Paper sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Листы в кассете №{session.cassetteNumber} ({sheets.length} шт.)
        </Typography>
        <TableContainer sx={{ maxHeight: 400, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>Лист</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>Сляб</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>Плавка</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>Партия</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>Марка стали</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>Толщина</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>Статус</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sheets.map((s, idx) => (
                <TableRow key={s.matId || idx} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.sheet}</TableCell>
                  <TableCell>{s.slab ?? '—'}</TableCell>
                  <TableCell>{s.melt ?? '—'}</TableCell>
                  <TableCell>{s.partNo ?? '—'}</TableCell>
                  <TableCell>{s.alloyCodeText || s.alloyCode || '—'}</TableCell>
                  <TableCell>{s.thickness != null ? `${Number(s.thickness).toFixed(1)}` : '—'}</TableCell>
                  <TableCell>
                    <Chip label={s.status || 'Отпуск пройден'} size="small" color="success" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="caption" color="text.disabled" display="block" textAlign="right" mt={3}>
        Отчёт сформирован: {fmtDate(new Date())} | Ключ кассеты: {session.businessKey}
      </Typography>
    </Box>
  );
};

export default TemperingReport;