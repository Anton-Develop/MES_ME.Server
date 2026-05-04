// src/components/Furnace/FurnaceReport.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Chip, Divider, Button,
  CircularProgress, Table, TableBody, TableCell,
  TableContainer, TableRow, Alert, Stack,
} from '@mui/material';
import { Print, GetApp, ArrowBack } from '@mui/icons-material';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { furnaceApi } from '../../api/furnaceApi';

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
const fmtDate = (d) => d
  ? new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  : '—';

const fmtMin  = (v) => v != null ? `${Number(v).toFixed(1)} мин` : '—';
const fmtTemp = (v) => v != null ? `${Number(v).toFixed(1)} °C`  : '—';

// Безопасный парсинг
const safeJson = (val) => {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
};

// Нормализуем ключи объекта к нижнему регистру — решает проблему Z3_1 vs z3_1
const normalizeKeys = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])
  );
};

// Извлекаем timestamps из объекта зоны (поле "times")
const getTimestamps = (tempsObj) => {
  if (!tempsObj?.times?.length) return [];
  return tempsObj.times.map(t => new Date(t).getTime());
};

// ---------------------------------------------------------------------------
// Определения серий для каждой группы зон — строчные ключи
// ---------------------------------------------------------------------------
const SERIES = {
  Z1: [
    { key: 'z1_1', name: 'З1.1',       color: '#1565c0' },
    { key: 'z1_2', name: 'З1.2',       color: '#1976d2' },
    { key: 'z1_3', name: 'З1.3',       color: '#42a5f5' },
    { key: 'z1_4', name: 'З1.4',       color: '#90caf9' },
  ],
  Z2: [
    { key: 'z2_1', name: 'З2.1',       color: '#00695c' },
    { key: 'z2_2', name: 'З2.2',       color: '#00897b' },
    { key: 'z2_3', name: 'З2.3',       color: '#26a69a' },
    { key: 'z2_4', name: 'З2.4',       color: '#80cbc4' },
  ],
  Z3: [
    { key: 'z3_1', name: 'З3.1 (верх)', color: '#bf360c' },
    { key: 'z3_2', name: 'З3.2',        color: '#e64a19' },
    { key: 'z3_3', name: 'З3.3',        color: '#ff7043' },
    { key: 'z3_4', name: 'З3.4 (низ)', color: '#ffab91' },
  ],
  Z4: [
    { key: 'z4_1', name: 'З4.1 (верх)', color: '#b71c1c' },
    { key: 'z4_2', name: 'З4.2',        color: '#c62828' },
    { key: 'z4_3', name: 'З4.3',        color: '#ef5350' },
    { key: 'z4_4', name: 'З4.4 (низ)', color: '#ef9a9a' },
  ],
};

// Ключи заданий для каждой зоны
const REF_KEYS = {
  Z1: 'z1_1_ref',
  Z2: 'z2_1_ref',
  Z3: 'z3_1_ref',
  Z4: 'z4_1_ref',
};

// ---------------------------------------------------------------------------
// График одной группы зон
// ---------------------------------------------------------------------------
const ZoneChart = ({ title, tempsObj, seriesDef, refKey, height = 280 }) => {
  // Нормализуем ключи к нижнему регистру (z3_1 вместо Z3_1)
  const normalized = useMemo(() => normalizeKeys(tempsObj), [tempsObj]);

  const options = useMemo(() => {
    if (!normalized) return null;

    const timestamps = getTimestamps(normalized);
    if (!timestamps.length) return null;

    // Серии факт
    const factSeries = seriesDef
      .filter(s => normalized[s.key]?.length)
      .map(s => ({
        name:      s.name,
        color:     s.color,
        lineWidth: 1.5,
        dashStyle: 'Solid',
        data:      timestamps.map((ts, i) => [ts, normalized[s.key]?.[i] ?? null]),
        marker:    { enabled: false },
        tooltip:   { valueSuffix: ' °C', valueDecimals: 1 },
      }));

    // Серия задания — пунктир чёрный
    const refData = normalized[refKey];
    const refSeries = (refData?.length) ? [{
      name:      'Задание',
      color:     '#212121',
      lineWidth: 2,
      dashStyle: 'ShortDash',
      zIndex:    10,
      data:      timestamps.map((ts, i) => [ts, refData[i] ?? null]),
      marker:    { enabled: false },
      tooltip:   { valueSuffix: ' °C', valueDecimals: 0 },
    }] : [];

    const series = [...factSeries, ...refSeries];
    if (!series.length) return null;

    return {
      chart: {
        type:            'line',
        height,
        zoomType:        'x',
        animation:       false,
        backgroundColor: '#fff',
        style:           { fontFamily: '"Roboto","Helvetica","Arial",sans-serif' },
      },
      title:   { text: title, style: { fontSize: '13px', fontWeight: '600' } },
      credits: { enabled: false },
      xAxis: {
        type:       'datetime',
        crosshair:  true,
        labels:     { format: '{value:%H:%M}', style: { fontSize: '10px' } },
      },
      yAxis: {
        title:         { text: '°C', style: { color: '#555' } },
        gridLineColor: '#e0e0e0',
        labels:        { style: { fontSize: '10px' } },
      },
      tooltip: {
        shared:      true,
        xDateFormat: '%d.%m.%Y %H:%M:%S',
        style:       { fontSize: '11px' },
      },
      legend: {
        enabled:   true,
        itemStyle: { fontSize: '10px', color: '#333' },
      },
      plotOptions: {
        series: {
          boostThreshold: 300,
          turboThreshold:  0,
          animation:       false,
          connectNulls:    false,
        },
      },
      boost:  { enabled: true, useGPUTranslations: true, seriesThreshold: 1 },
      exporting: {
        enabled: true,
        buttons: {
          contextButton: {
            menuItems: ['downloadPNG', 'downloadCSV', 'separator', 'printChart'],
          },
        },
      },
      series,
    };
  }, [normalized, seriesDef, refKey, title, height]);

  if (!options) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Лист не проходил через эту зону или данные отсутствуют
        </Typography>
      </Box>
    );
  }

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { height: `${height}px` } }}
    />
  );
};

// ---------------------------------------------------------------------------
// Таблица средних температур
// ---------------------------------------------------------------------------
const AvgTempsTable = ({ session }) => {
  const rows = [
    {
      label: 'Зона 1',
      color: '#1565c0',
      cells: [
        ['Термопара 1', session.avgZ1_1],
        ['Термопара 2', session.avgZ1_2],
        ['Термопара 3', session.avgZ1_3],
        ['Термопара 4', session.avgZ1_4],
      ],
    },
    {
      label: 'Зона 2',
      color: '#00695c',
      cells: [
        ['Термопара 1', session.avgZ2_1],
        ['Термопара 2', session.avgZ2_2],
        ['Термопара 3', session.avgZ2_3],
        ['Термопара 4', session.avgZ2_4],
      ],
    },
    {
      label: 'Зона 3',
      color: '#bf360c',
      cells: [
        ['Термопара 1', session.avgZ3_1],
        ['Термопара 2', session.avgZ3_2],
        ['Термопара 3', session.avgZ3_3],
        ['Термопара 4', session.avgZ3_4],
      ],
    },
    {
      label: 'Зона 4',
      color: '#b71c1c',
      cells: [
        ['Термопара 1', session.avgZ4_1],
        ['Термопара 2', session.avgZ4_2],
        ['Термопара 3', session.avgZ4_3],
        ['Термопара 4', session.avgZ4_4],
      ],
    },
  ];

  return (
    <TableContainer>
      <Table size="small">
        <TableBody>
          {rows.map(({ label, color, cells }) => (
            <TableRow key={label}>
              <TableCell sx={{ fontWeight: 600, color, width: 80, fontSize: '0.78rem' }}>
                {label}
              </TableCell>
              {cells.map(([name, val]) => (
                <React.Fragment key={name}>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                    {name}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {fmtTemp(val)}
                  </TableCell>
                </React.Fragment>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ---------------------------------------------------------------------------
// Основной компонент
// ---------------------------------------------------------------------------
const FurnaceReport = () => {
  const location  = useLocation();
  const navigate  = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const key     = searchParams.get('key');
  const isPrint = searchParams.get('print') === 'true';

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!key) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await furnaceApi.getSessionByKey(key);
        setSession(res.data);
      } catch (err) {
        setError(err.response?.data?.message ?? 'Ошибка загрузки отчёта');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [key]);

  // Авто-печать
  useEffect(() => {
    if (isPrint && session && !loading) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [isPrint, session, loading]);

  // Парсим JSONB — нормализация ключей происходит внутри ZoneChart
  const tempsZ1 = useMemo(() => safeJson(session?.tempsZ1), [session]);
  const tempsZ2 = useMemo(() => safeJson(session?.tempsZ2), [session]);
  const tempsZ3 = useMemo(() => safeJson(session?.tempsZ3), [session]);
  const tempsZ4 = useMemo(() => safeJson(session?.tempsZ4), [session]);

  // Есть ли хоть какие-то данные температур
  const hasTemps = useMemo(() => {
    const check = (obj) => {
      if (!obj) return false;
      const n = normalizeKeys(obj);
      return n?.times?.length > 0;
    };
    return check(tempsZ1) || check(tempsZ2) || check(tempsZ3) || check(tempsZ4);
  }, [tempsZ1, tempsZ2, tempsZ3, tempsZ4]);

  // Количество точек (из первой доступной зоны)
  const pointsCount = useMemo(() => {
    for (const obj of [tempsZ1, tempsZ2, tempsZ3, tempsZ4]) {
      const n = normalizeKeys(obj);
      if (n?.times?.length) return n.times.length;
    }
    return 0;
  }, [tempsZ1, tempsZ2, tempsZ3, tempsZ4]);

  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <Box sx={{ p: 5, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>Загрузка отчёта...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>Назад</Button>
      </Box>
    );
  }

  if (!session) {
    return <Alert severity="warning" sx={{ m: 3 }}>Сессия не найдена</Alert>;
  }

  const zones   = [
    { label: 'Зона 1 (F1)', obj: tempsZ1, def: SERIES.Z1, refKey: REF_KEYS.Z1 },
    { label: 'Зона 2 (F2)', obj: tempsZ2, def: SERIES.Z2, refKey: REF_KEYS.Z2 },
    { label: 'Зона 3 (F3)', obj: tempsZ3, def: SERIES.Z3, refKey: REF_KEYS.Z3 },
    { label: 'Зона 4 (F4)', obj: tempsZ4, def: SERIES.Z4, refKey: REF_KEYS.Z4 },
  ];

  return (
    <Box
      sx={{
        p: 3,
        '@media print': {
          p: 1,
          '& .no-print': { display: 'none !important' },
        },
      }}
    >
      {/* Кнопки */}
      <Box className="no-print" sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} variant="outlined">
          Назад
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
          Печать
        </Button>
        <Button
          variant="outlined" startIcon={<GetApp />}
          onClick={() => window.open(`/furnace/report?key=${encodeURIComponent(key)}&print=true`, '_blank')}
        >
          PDF (новая вкладка)
        </Button>
      </Box>

      {/* Заголовок */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap">
          <Typography variant="h5" fontWeight={700}>
            Отчёт о нагреве листа №{session.sheet}
          </Typography>
          {session.zonesPath && (
            <Chip label={session.zonesPath} color="primary" size="small" variant="outlined"
              sx={{ fontFamily: 'monospace', fontWeight: 600 }} />
          )}
          {session.reheatNum > 0 && (
            <Chip label={`Повторный нагрев №${session.reheatNum}`} color="warning" size="small" />
          )}
          {session.hadAlarm && <Chip label="АВАРИЯ" color="error" size="small" />}
        </Stack>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {[
            { label: 'Лист',        value: session.sheet },
            { label: 'Сляб',        value: session.slab    ?? '—' },
            { label: 'Плавка',      value: session.melt    ?? '—' },
            { label: 'Партия',      value: session.partNo  ?? '—' },
            { label: 'Пачка',       value: session.pack    ?? '—' },
            { label: 'Марка стали', value: session.alloyCodeText || session.alloyCode || '—' },
            { label: 'Толщина',     value: session.thickness != null ? `${Number(session.thickness).toFixed(1)} мм` : '—' },
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

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="caption" color="text.secondary">Вход в печь</Typography>
            <Typography variant="body2" fontWeight={600}>{fmtDate(session.enteredAt)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="caption" color="text.secondary">Выход из печи</Typography>
            <Typography variant="body2" fontWeight={600}>{fmtDate(session.exitedAt)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="caption" color="text.secondary">Общее время нагрева</Typography>
            <Typography variant="body2" fontWeight={700} color="warning.dark">
              {fmtMin(session.totalMin)}
            </Typography>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" gutterBottom>Время в зонах</Typography>
        <Grid container spacing={1}>
          {['F1','F2','F3','F4'].map((zone, i) => {
            const val = [session.f1Min, session.f2Min, session.f3Min, session.f4Min][i];
            return val != null ? (
              <Grid item key={zone}>
                <Paper variant="outlined" sx={{ px: 2, py: 1, textAlign: 'center', minWidth: 80 }}>
                  <Typography variant="caption" color="text.secondary">{zone}</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmtMin(val)}</Typography>
                </Paper>
              </Grid>
            ) : null;
          })}
        </Grid>
      </Paper>

      {/* Средние температуры */}
      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Средние температуры за нагрев
        </Typography>
        <AvgTempsTable session={session} />
      </Paper>

      {/* Графики */}
      {hasTemps ? (
        <>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Температуры по зонам ({pointsCount} точек)
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              — пунктир = задание
            </Typography>
          </Typography>
          <Grid container spacing={2}>
            {zones.map(({ label, obj, def, refKey }) => (
              <Grid item xs={12} md={6} key={label}>
                <Paper sx={{ p: 1.5, borderRadius: 2 }}>
                  <ZoneChart
                    title={label}
                    tempsObj={obj}
                    seriesDef={def}
                    refKey={refKey}
                    height={450}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      ) : (
        <Alert severity="info">
          Температуры не записаны для этой сессии. Используйте страницу «Горение печи»
          за период {fmtDate(session.enteredAt)} — {fmtDate(session.exitedAt)}.
        </Alert>
      )}

      <Typography variant="caption" color="text.disabled" display="block" textAlign="right" mt={3}>
        Отчёт сформирован: {fmtDate(new Date())} | business_key: {key}
      </Typography>
    </Box>
  );
};

export default FurnaceReport;