// src/components/Furnace/FurnaceReport.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Chip, Divider, Button,
  CircularProgress, Table, TableBody, TableCell,
  TableContainer, TableRow, Alert, IconButton, Tooltip,
  Stack,
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

// Безопасный парсинг — данные могут прийти как строка или уже объект
const safeJson = (val) => {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
};

// ---------------------------------------------------------------------------
// График одной группы зон
// ---------------------------------------------------------------------------
const ZoneChart = ({ title, tempsObj, timestamps, series: seriesDef, height = 280 }) => {
  const options = useMemo(() => {
    // ✅ Добавлена проверка на undefined
    if (!tempsObj || !timestamps?.length || !seriesDef) return null;

    const series = seriesDef
      .filter(s => tempsObj[s.key]?.length)
      .map(s => ({
        name:      s.name,
        color:     s.color,
        lineWidth: 1.5,
        data:      timestamps.map((ts, i) => [ts, tempsObj[s.key]?.[i] ?? null]),
        marker:    { enabled: false },
        tooltip:   { valueSuffix: ' °C', valueDecimals: 1 },
      }));


    if (!series.length) return null;

    return {
      chart: {
        type: 'line',
        height,
        zoomType: 'x',
        animation: false,
        backgroundColor: '#fff',
        style: { fontFamily: '"Roboto","Helvetica","Arial",sans-serif' },
      },
      title:   { text: title, style: { fontSize: '13px', fontWeight: '600' } },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime',
        labels: { format: '{value:%H:%M}', style: { color: '#555', fontSize: '10px' } },
        crosshair: true,
      },
      yAxis: {
        title:         { text: '°C', style: { color: '#555' } },
        gridLineColor: '#e0e0e0',
        labels:        { style: { color: '#555', fontSize: '10px' } },
      },
      tooltip: {
        shared:      true,
        xDateFormat: '%d.%m.%Y %H:%M:%S',
        style:       { fontSize: '11px' },
      },
      legend: {
        enabled: true,
        itemStyle: { fontSize: '10px', color: '#333' },
      },
      plotOptions: {
        series: {
          boostThreshold: 300,
          turboThreshold: 0,
          animation: false,
          connectNulls: false,
        },
      },
      boost: { enabled: true, useGPUTranslations: true, seriesThreshold: 1 },
      series,
    };
  }, [tempsObj, timestamps, seriesDef, title, height]);

  if (!options) return null;

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { height: `${height}px` } }}
    />
  );
};

// Определения серий для каждой группы зон
const SERIES = {
  Z1: [
    { key: 'z1_1', name: 'З1.1', color: '#42a5f5' },
    { key: 'z1_2', name: 'З1.2', color: '#64b5f6' },
    { key: 'z1_3', name: 'З1.3', color: '#90caf9' },
    { key: 'z1_4', name: 'З1.4', color: '#bbdefb' },
  ],
  Z2: [
    { key: 'z2_1', name: 'З2.1', color: '#26a69a' },
    { key: 'z2_2', name: 'З2.2', color: '#4db6ac' },
    { key: 'z2_3', name: 'З2.3', color: '#80cbc4' },
    { key: 'z2_4', name: 'З2.4', color: '#b2dfdb' },
  ],
  Z3: [
    { key: 'z3_1', name: 'З3.1 (верх)',     color: '#ff7043' },
    { key: 'z3_2', name: 'З3.2',            color: '#ff8a65' },
    { key: 'z3_3', name: 'З3.3',            color: '#ffab91' },
    { key: 'z3_4', name: 'З3.4 (низ)',      color: '#ffccbc' },
  ],
  Z4: [
    { key: 'z4_1', name: 'З4.1 (верх)',     color: '#ef5350' },
    { key: 'z4_2', name: 'З4.2',            color: '#e57373' },
    { key: 'z4_3', name: 'З4.3',            color: '#ef9a9a' },
    { key: 'z4_4', name: 'З4.4 (низ)',      color: '#ffcdd2' },
  ],
};

// ---------------------------------------------------------------------------
// Функция преобразования данных температур из API в формат для графиков
// ---------------------------------------------------------------------------
const transformTemperatures = (temperatureData) => {
  if (!temperatureData || !Array.isArray(temperatureData) || temperatureData.length === 0) {
    return { tempsZ1: null, tempsZ2: null, tempsZ3: null, tempsZ4: null, timestamps: [] };
  }

  const tempsZ1 = { z1_1: [], z1_2: [], z1_3: [], z1_4: [] };
  const tempsZ2 = { z2_1: [], z2_2: [], z2_3: [], z2_4: [] };
  const tempsZ3 = { z3_1: [], z3_2: [], z3_3: [], z3_4: [] };
  const tempsZ4 = { z4_1: [], z4_2: [], z4_3: [], z4_4: [] };
  const timestamps = [];

  temperatureData.forEach(point => {
    timestamps.push(new Date(point.time).getTime());
    
    tempsZ1.z1_1.push(point.z1_1_te);
    tempsZ1.z1_2.push(point.z1_2_te);
    tempsZ1.z1_3.push(point.z1_3_te);
    tempsZ1.z1_4.push(point.z1_4_te);
    
    tempsZ2.z2_1.push(point.z2_1_te);
    tempsZ2.z2_2.push(point.z2_2_te);
    tempsZ2.z2_3.push(point.z2_3_te);
    tempsZ2.z2_4.push(point.z2_4_te);
    
    tempsZ3.z3_1.push(point.z3_1_te);
    tempsZ3.z3_2.push(point.z3_2_te);
    tempsZ3.z3_3.push(point.z3_3_te);
    tempsZ3.z3_4.push(point.z3_4_te);
    
    tempsZ4.z4_1.push(point.z4_1_te);
    tempsZ4.z4_2.push(point.z4_2_te);
    tempsZ4.z4_3.push(point.z4_3_te);
    tempsZ4.z4_4.push(point.z4_4_te);
  });

  return { tempsZ1, tempsZ2, tempsZ3, tempsZ4, timestamps };
};

// ---------------------------------------------------------------------------
// Основной компонент
// ---------------------------------------------------------------------------
const FurnaceReport = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const key = searchParams.get('key');
  const isPrint = searchParams.get('print') === 'true';

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [temperatureData, setTemperatureData] = useState(null);
  const [tempsLoading, setTempsLoading] = useState(false);

  useEffect(() => {
    if (!key) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await furnaceApi.getSessionByKey(key);
        setSession(res.data);
        
        // Проверяем, есть ли данные температур в сессии
        const hasTempsInSession = res.data.tempsZ1 || res.data.tempsZ2 || 
                                 res.data.tempsZ3 || res.data.tempsZ4;
        
        // Если температур нет в сессии, но есть даты входа/выхода - загружаем через API
        if (!hasTempsInSession && res.data.enteredAt && res.data.exitedAt) {
          setTempsLoading(true);
          try {
            const tempsRes = await furnaceApi.getTemperatures({
              from: res.data.enteredAt,
              to: res.data.exitedAt,
              intervalMin: 1  // Получаем данные с минутным интервалом
            });
            setTemperatureData(tempsRes.data);
          } catch (tempsErr) {
            console.error('Ошибка загрузки температур:', tempsErr);
            // Не показываем ошибку, просто не будет графиков
          } finally {
            setTempsLoading(false);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message ?? 'Ошибка загрузки отчёта');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [key]);

  // Авто-печать если открыт с ?print=true
  useEffect(() => {
    if (isPrint && session && !loading) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [isPrint, session, loading]);

  // Парсим JSONB данные температур из сессии
  const sessionTemps = useMemo(() => {
    if (!session) return null;
    
    // Проверяем, есть ли данные в сессии
    if (session.tempsZ1 || session.tempsZ2 || session.tempsZ3 || session.tempsZ4) {
      return {
        tempsZ1: safeJson(session.tempsZ1),
        tempsZ2: safeJson(session.tempsZ2),
        tempsZ3: safeJson(session.tempsZ3),
        tempsZ4: safeJson(session.tempsZ4),
        timestamps: (() => {
          const raw = safeJson(session.tempsTime);
          return Array.isArray(raw) ? raw.map(t => new Date(t).getTime()) : [];
        })()
      };
    }
    return null;
  }, [session]);

  // Если в сессии нет температур, используем загруженные через API
  const apiTemps = useMemo(() => {
    return temperatureData ? transformTemperatures(temperatureData) : null;
  }, [temperatureData]);

  // Выбираем источник данных для графиков: сначала сессия, потом API
  const tempsZ1 = sessionTemps?.tempsZ1 || apiTemps?.tempsZ1 || null;
  const tempsZ2 = sessionTemps?.tempsZ2 || apiTemps?.tempsZ2 || null;
  const tempsZ3 = sessionTemps?.tempsZ3 || apiTemps?.tempsZ3 || null;
  const tempsZ4 = sessionTemps?.tempsZ4 || apiTemps?.tempsZ4 || null;
  const timestamps = sessionTemps?.timestamps || apiTemps?.timestamps || [];

  const hasTemps = timestamps.length > 0;

  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <Box sx={{ p: 5, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Загрузка отчёта...
        </Typography>
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
      {/* Кнопки управления — скрываются при печати */}
      <Box className="no-print" sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} variant="outlined">
          Назад
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
          Печать
        </Button>
        <Tooltip title="Открыть для печати в новой вкладке">
          <Button
            variant="outlined"
            startIcon={<GetApp />}
            onClick={() => window.open(
              `/furnace/report?key=${encodeURIComponent(key)}&print=true`, '_blank'
            )}
          >
            PDF (новая вкладка)
          </Button>
        </Tooltip>
      </Box>

      {/* ------------------------------------------------------------------ */}
      {/* Заголовок отчёта                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap">
          <Typography variant="h5" fontWeight={700}>
            Отчёт о нагреве листа №{session.sheet}
          </Typography>
          {session.zonesPath && (
            <Chip
              label={session.zonesPath}
              color="primary" size="small" variant="outlined"
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            />
          )}
          {session.reheatNum > 0 && (
            <Chip label={`Повторный нагрев №${session.reheatNum}`} color="warning" size="small" />
          )}
          {session.hadAlarm && (
            <Chip label="АВАРИЯ" color="error" size="small" />
          )}
        </Stack>

        {/* Идентификация */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {[
            { label: 'Лист',    value: session.sheet },
            { label: 'Сляб',    value: session.slab   ?? '—' },
            { label: 'Плавка',  value: session.melt   ?? '—' },
            { label: 'Партия',  value: session.partNo ?? '—' },
            { label: 'Пачка',   value: session.pack   ?? '—' },
            { label: 'Марка стали',   value: session.alloyCodeText || session.alloyCode || '—' },
            { label: 'Толщина', value: session.thickness != null ? `${Number(session.thickness).toFixed(1)} мм` : '—' },
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

        {/* Времена */}
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

        {/* Время в зонах */}
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

      {/* ------------------------------------------------------------------ */}
      {/* Средние температуры                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Средние температуры за нагрев
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableBody>
              <TableRow>
                {[
                  ['Зона 1. Термопара 1', session.avgZ1_1], ['Зона 1. Термопара 2', session.avgZ1_2],
                  ['Зона 1. Термопара 3', session.avgZ1_3], ['Зона 1. Термопара 4', session.avgZ1_4],
                ].map(([label, val]) => (
                  <React.Fragment key={label}>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{label}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#ff7043' }}>{fmtTemp(val)}</TableCell>
                  </React.Fragment>
                ))}
              </TableRow>
              <TableRow>
                {[
                  ['Зона 2. Термопара 1', session.avgZ2_1], ['Зона 2. Термопара 2', session.avgZ2_2],
                  ['Зона 2. Термопара 3', session.avgZ2_3], ['Зона 2. Термопара 4', session.avgZ2_4],
                ].map(([label, val]) => (
                  <React.Fragment key={label}>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{label}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#ff7043' }}>{fmtTemp(val)}</TableCell>
                  </React.Fragment>
                ))}
              </TableRow>
              <TableRow>
                {[
                  ['Зона 3. Термопара 1', session.avgZ3_1], ['Зона 3. Термопара 2', session.avgZ3_2],
                  ['Зона 3. Термопара 3', session.avgZ3_3], ['Зона 3. Термопара 4', session.avgZ3_4],
                ].map(([label, val]) => (
                  <React.Fragment key={label}>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{label}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#ff7043' }}>{fmtTemp(val)}</TableCell>
                  </React.Fragment>
                ))}
              </TableRow>
              <TableRow>
                {[
                  ['Зона 4. Термопара 1', session.avgZ4_1], ['Зона 4. Термопара 2', session.avgZ4_2],
                  ['Зона 4. Термопара 3', session.avgZ4_3], ['Зона 4. Термопара 4', session.avgZ4_4],
                ].map(([label, val]) => (
                  <React.Fragment key={label}>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{label}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#ef5350' }}>{fmtTemp(val)}</TableCell>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

{/* ------------------------------------------------------------------ */}
{/* Графики температур                                                  */}
{/* ------------------------------------------------------------------ */}
{tempsLoading ? (
  <Box sx={{ textAlign: 'center', py: 3 }}>
    <CircularProgress size={24} />
    <Typography variant="body2" color="text.secondary" mt={1}>
      Загрузка температур...
    </Typography>
  </Box>
) : hasTemps ? (
  <>
    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
      Температуры по зонам ({timestamps.length} точек)
      {apiTemps && !sessionTemps && (
        <Chip 
          label="Загружены через API" 
          size="small" 
          variant="outlined" 
          sx={{ ml: 1 }} 
        />
      )}
    </Typography>
    <Grid container spacing={2}>
      {[
        { label: 'Зона 1', obj: tempsZ1, def: SERIES.Z1 },
        { label: 'Зона 2', obj: tempsZ2, def: SERIES.Z2 },
        { label: 'Зона 3', obj: tempsZ3, def: SERIES.Z3 },
        { label: 'Зона 4', obj: tempsZ4, def: SERIES.Z4 },
      ].map(({ label, obj, def }) => (
        obj ? ( // ✅ Добавлена проверка наличия данных для зоны
          <Grid item xs={12} md={6} key={label}>
            <Paper sx={{ p: 1.5, borderRadius: 2 }}>
              <ZoneChart
                title={label}
                tempsObj={obj}
                timestamps={timestamps}
                seriesDef={def}
                height={260}
              />
            </Paper>
          </Grid>
        ) : null
      ))}
    </Grid>
  </>
) : (
  <Alert severity="info">
    Температуры не записаны для этой сессии. Для просмотра используйте
    страницу «Горение печи» за период{' '}
    {fmtDate(session.enteredAt)} — {fmtDate(session.exitedAt)}.
  </Alert>
)}

      {/* Дата формирования отчёта */}
      <Typography
        variant="caption"
        color="text.disabled"
        display="block"
        textAlign="right"
        mt={3}
      >
        Отчёт сформирован: {fmtDate(new Date())} | business_key: {key}
      </Typography>
    </Box>
  );
};

export default FurnaceReport;