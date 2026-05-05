// src/components/Furnace/FurnaceReport.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Chip, Divider, Button,
  CircularProgress, Alert, Stack,
} from '@mui/material';
import { Print, GetApp, ArrowBack } from '@mui/icons-material';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import Exporting from 'highcharts/modules/exporting';
import ExportData from 'highcharts/modules/export-data';
import FullScreen from 'highcharts/modules/full-screen';
import { furnaceApi } from '../../api/furnaceApi'; // Инициализируем модули 
// Безопасная инициализация: вызываем только если это функция
if (typeof Exporting === 'function') Exporting(Highcharts);
if (typeof ExportData === 'function') ExportData(Highcharts);
if (typeof FullScreen === 'function') FullScreen(Highcharts);


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

const safeJson = (val) => {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
};

const normalizeKeys = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])
  );
};

const getTimestamps = (tempsObj) => {
  if (!tempsObj?.times?.length) return [];
  return tempsObj.times.map(t => new Date(t).getTime());
};

// Стандартный конфиг экспорта — используем во всех графиках
const EXPORT_BUTTONS = {
  contextButton: {
    menuItems: [
      'viewFullscreen',
      'separator',
      'downloadPNG',
      'downloadSVG',
      'separator',
      'downloadCSV',
      'separator',
      'printChart',
    ],
  },
};

// ---------------------------------------------------------------------------
// Определения серий для каждой зоны — строчные ключи
// ---------------------------------------------------------------------------
const SERIES = {
  Z1: [
    { key: 'z1_1', name: 'З1.1',        color: '#1565c0' },
    { key: 'z1_2', name: 'З1.2',        color: '#1976d2' },
    { key: 'z1_3', name: 'З1.3',        color: '#42a5f5' },
    { key: 'z1_4', name: 'З1.4',        color: '#90caf9' },
  ],
  Z2: [
    { key: 'z2_1', name: 'З2.1',        color: '#00695c' },
    { key: 'z2_2', name: 'З2.2',        color: '#00897b' },
    { key: 'z2_3', name: 'З2.3',        color: '#26a69a' },
    { key: 'z2_4', name: 'З2.4',        color: '#80cbc4' },
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

const REF_KEYS = {
  Z1: 'z1_1_ref',
  Z2: 'z2_1_ref',
  Z3: 'z3_1_ref',
  Z4: 'z4_1_ref',
};

// Цвет зоны для UI-элементов
const ZONE_COLORS = {
  Z1: '#1565c0',
  Z2: '#00695c',
  Z3: '#bf360c',
  Z4: '#b71c1c',
};

// ---------------------------------------------------------------------------
// Вычисление среднего по термопарам в каждой точке времени
// ---------------------------------------------------------------------------
const computeZoneAvg = (normalized, seriesDef) => {
  const timestamps = getTimestamps(normalized);
  if (!timestamps.length) return null;

  const arrays = seriesDef
    .filter(s => normalized[s.key]?.length)
    .map(s => normalized[s.key]);

  if (!arrays.length) return null;

  const avgData = timestamps.map((ts, i) => {
    const vals = arrays.map(arr => arr[i]).filter(v => v != null);
    return [ts, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null];
  });

  return avgData;
};

// ---------------------------------------------------------------------------
// График одной зоны
// ---------------------------------------------------------------------------
const ZoneChart = ({ title, tempsObj, seriesDef, refKey, height = 260 }) => {
  const normalized = useMemo(() => normalizeKeys(tempsObj), [tempsObj]);

  const options = useMemo(() => {
    if (!normalized) return null;
    const timestamps = getTimestamps(normalized);
    if (!timestamps.length) return null;

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

    const refData = normalized[refKey];
    const refSeries = refData?.length ? [{
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
        marginTop:       36,
      },
      title:   { text: null },
      credits: { enabled: false },
      xAxis: {
        type:       'datetime',
        crosshair:  true,
        labels:     { format: '{value:%H:%M}', style: { fontSize: '10px' } },
      },
      yAxis: {
        title:         { text: '°C', style: { color: '#555', fontSize: '10px' } },
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
        margin:    4,
      },
      plotOptions: {
        series: {
          boostThreshold: 300,
          turboThreshold:  0,
          animation:       false,
          connectNulls:    false,
        },
      },
      boost:     { enabled: true, useGPUTranslations: true, seriesThreshold: 1 },
      exporting: { enabled: true, buttons: EXPORT_BUTTONS },
      series,
    };
  }, [normalized, seriesDef, refKey, height]);

  if (!options) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Нет данных
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
// Общий нижний график — среднее по каждой зоне + задание
// ---------------------------------------------------------------------------
const CombinedChart = ({ zones }) => {
  const options = useMemo(() => {
    const series = [];

    for (const { zKey, label, color, tempsObj, seriesDef, refKey } of zones) {
      const normalized = normalizeKeys(tempsObj);
      if (!normalized) continue;
      const avgData = computeZoneAvg(normalized, seriesDef);
      if (!avgData) continue;

      series.push({
        name:      label,
        color,
        lineWidth: 2,
        dashStyle: 'Solid',
        data:      avgData,
        marker:    { enabled: false },
        tooltip:   { valueSuffix: ' °C', valueDecimals: 1 },
        zIndex:    5,
      });

      // Добавляем задание только один раз (от первой доступной зоны)
   //   if (!series.find(s => s.name === 'Задание')) {
        const timestamps = getTimestamps(normalized);
        const refData = normalized[refKey];
        if (refData?.length) {
          series.push({
            name:      'Задание',
            color:     '#212121',
            lineWidth: 2,
            dashStyle: 'ShortDash',
            zIndex:    10,
            data:      timestamps.map((ts, i) => [ts, refData[i] ?? null]),
            marker:    { enabled: false },
            tooltip:   { valueSuffix: ' °C', valueDecimals: 0 },
            linkedTo: ':previos',
          });
        }
     // }
    }

    if (!series.length) return null;

    return {
      chart: {
        type:            'line',
        height:          320,
        zoomType:        'x',
        animation:       false,
        backgroundColor: '#fff',
        style:           { fontFamily: '"Roboto","Helvetica","Arial",sans-serif' },
      },
      title:   { text: null },
      credits: { enabled: false },
      xAxis: {
        type:       'datetime',
        crosshair:  true,
        labels:     { format: '{value:%H:%M}', style: { fontSize: '11px' } },
      },
      yAxis: {
        title:         { text: '°C', style: { color: '#555' } },
        gridLineColor: '#e0e0e0',
        labels:        { style: { fontSize: '11px' } },
      },
      tooltip: {
        shared:      true,
        xDateFormat: '%d.%m.%Y %H:%M:%S',
        style:       { fontSize: '12px' },
      },
      legend: {
        enabled:   true,
        itemStyle: { fontSize: '12px', color: '#333' },
      },
      plotOptions: {
        series: {
          boostThreshold: 300,
          turboThreshold:  0,
          animation:       false,
          connectNulls:    false,
        },
      },
      boost:     { enabled: true, useGPUTranslations: true, seriesThreshold: 1 },
      exporting: { enabled: true, buttons: EXPORT_BUTTONS },
      series,
    };
  }, [zones]);

  if (!options) return null;

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { height: '320px' } }}
    />
  );
};

// ---------------------------------------------------------------------------
// Колонка одной зоны
// ---------------------------------------------------------------------------
const ZoneColumn = ({ zKey, label, fMin, avgCells, tempsObj, seriesDef, refKey }) => {
  const color = ZONE_COLORS[zKey];
  const hasData = useMemo(() => {
    const n = normalizeKeys(tempsObj);
    return n?.times?.length > 0;
  }, [tempsObj]);

  return (
    <Paper
      variant="outlined"
      sx={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflow:      'hidden',
        borderTop:     `3px solid ${color}`,
        borderRadius:  2,
        width :'100%',
      }}
    >
      {/* Заголовок зоны */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color }}>
          {label}
        </Typography>
      </Box>

      {/* Время в зоне */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Время в зоне
        </Typography>
        <Typography variant="body2" fontWeight={700} sx={{ color: fMin != null ? 'text.primary' : 'text.disabled' }}>
          {fMin != null ? fmtMin(fMin) : '—'}
        </Typography>
      </Box>

      {/* Средние температуры */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Средние температуры
        </Typography>
        {avgCells.map(([name, val]) => (
          <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
            <Typography variant="caption" color="text.secondary">{name}</Typography>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ color: val != null ? color : 'text.disabled', fontFamily: 'monospace' }}
            >
              {fmtTemp(val)}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* График */}
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        {hasData ? (
          <ZoneChart
            title={label}
            tempsObj={tempsObj}
            seriesDef={seriesDef}
            refKey={refKey}
            height={260}
          />
        ) : (
          <Box sx={{ p: 2, textAlign: 'center', mt: 2 }}>
            <Typography variant="caption" color="text.disabled">
              Лист не проходил через эту зону
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// Основной компонент
// ---------------------------------------------------------------------------
const FurnaceReport = () => {
  const location = useLocation();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (isPrint && session && !loading) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [isPrint, session, loading]);

  const tempsZ1 = useMemo(() => safeJson(session?.tempsZ1), [session]);
  const tempsZ2 = useMemo(() => safeJson(session?.tempsZ2), [session]);
  const tempsZ3 = useMemo(() => safeJson(session?.tempsZ3), [session]);
  const tempsZ4 = useMemo(() => safeJson(session?.tempsZ4), [session]);

  const hasTemps = useMemo(() => {
    return [tempsZ1, tempsZ2, tempsZ3, tempsZ4].some(obj => {
      const n = normalizeKeys(obj);
      return n?.times?.length > 0;
    });
  }, [tempsZ1, tempsZ2, tempsZ3, tempsZ4]);

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

  // Определение колонок
  const columns = [
    {
      zKey:      'Z1',
      label:     'Зона 1 (F1)',
      fMin:      session.f1Min,
      avgCells:  [
        ['Термопара 1', session.avgZ1_1],
        ['Термопара 2', session.avgZ1_2],
        ['Термопара 3', session.avgZ1_3],
        ['Термопара 4', session.avgZ1_4],
      ],
      tempsObj:  tempsZ1,
      seriesDef: SERIES.Z1,
      refKey:    REF_KEYS.Z1,
      color:     ZONE_COLORS.Z1,
    },
    {
      zKey:      'Z2',
      label:     'Зона 2 (F2)',
      fMin:      session.f2Min,
      avgCells:  [
        ['Термопара 1', session.avgZ2_1],
        ['Термопара 2', session.avgZ2_2],
        ['Термопара 3', session.avgZ2_3],
        ['Термопара 4', session.avgZ2_4],
      ],
      tempsObj:  tempsZ2,
      seriesDef: SERIES.Z2,
      refKey:    REF_KEYS.Z2,
      color:     ZONE_COLORS.Z2,
    },
    {
      zKey:      'Z3',
      label:     'Зона 3 (F3)',
      fMin:      session.f3Min,
      avgCells:  [
        ['Термопара 1', session.avgZ3_1],
        ['Термопара 2', session.avgZ3_2],
        ['Термопара 3', session.avgZ3_3],
        ['Термопара 4', session.avgZ3_4],
      ],
      tempsObj:  tempsZ3,
      seriesDef: SERIES.Z3,
      refKey:    REF_KEYS.Z3,
      color:     ZONE_COLORS.Z3,
    },
    {
      zKey:      'Z4',
      label:     'Зона 4 (F4)',
      fMin:      session.f4Min,
      avgCells:  [
        ['Термопара 1', session.avgZ4_1],
        ['Термопара 2', session.avgZ4_2],
        ['Термопара 3', session.avgZ4_3],
        ['Термопара 4', session.avgZ4_4],
      ],
      tempsObj:  tempsZ4,
      seriesDef: SERIES.Z4,
      refKey:    REF_KEYS.Z4,
      color:     ZONE_COLORS.Z4,
    },
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
      <Paper sx={{ p: 2.5, mb: 2 }}>
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

        {/* Мета-данные листа */}
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

        <Divider sx={{ my: 1.5 }} />

        {/* Время нагрева */}
        <Grid container spacing={1.5}>
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
      </Paper>

      {/* ── 4 колонки: Зона 1 / 2 / 3 / 4 ── */}
      {hasTemps ? (
        <>
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Температуры по зонам ({pointsCount} точек)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              — пунктир = задание
            </Typography>
          </Box>

          <Box sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'stretch',
            flexWrap: { xs: 'wrap', md: 'nowrap' },
          }}>
            {columns.map((col) => (
              <Box key={col.zKey} sx={{ flex: '1 1 0', minWidth: 0, display: 'flex' }}>
                <ZoneColumn {...col} />
              </Box>
            ))}
          </Box>

          {/* ── Общий сводный график ── */}
          <Paper sx={{ mt: 2, p: 0, overflow: 'hidden', borderRadius: 2 }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                Сводный график — среднее по зонам
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Каждая линия — среднее из 4 термопар зоны. Пунктир — задание.
              </Typography>
            </Box>
            <Box sx={{ p: 1 }}>
              <CombinedChart zones={columns} />
            </Box>
          </Paper>
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
