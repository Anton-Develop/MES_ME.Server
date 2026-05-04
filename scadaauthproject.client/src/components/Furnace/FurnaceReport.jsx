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
    if (!tempsObj || !timestamps?.length) return null;

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


 // const isPrint = new URLSearchParams(location.search).get('print') === 'true';

  useEffect(() => {
    if (!key) return;

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

  // Авто-печать если открыт с ?print=true
  useEffect(() => {
    if (isPrint && session && !loading) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [isPrint, session, loading]);

  // Парсим JSONB данные температур
  const tempsZ1   = useMemo(() => safeJson(session?.tempsZ1),   [session]);
  const tempsZ2   = useMemo(() => safeJson(session?.tempsZ2),   [session]);
  const tempsZ3   = useMemo(() => safeJson(session?.tempsZ3),   [session]);
  const tempsZ4   = useMemo(() => safeJson(session?.tempsZ4),   [session]);
  const timestamps = useMemo(() => {
    const raw = safeJson(session?.tempsTime);
    return Array.isArray(raw) ? raw.map(t => new Date(t).getTime()) : [];
  }, [session]);

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
              `/furnace/report/${encodeURIComponent(key)}?print=true`, '_blank'
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
      {hasTemps ? (
        <>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Температуры по зонам ({timestamps.length} точек)
          </Typography>
          <Grid container spacing={2}>
            {[
              { label: 'Зона 1', obj: tempsZ1, def: SERIES.Z1 },
              { label: 'Зона 2', obj: tempsZ2, def: SERIES.Z2 },
              { label: 'Зона 3', obj: tempsZ3, def: SERIES.Z3 },
              { label: 'Зона 4', obj: tempsZ4, def: SERIES.Z4 },
            ].map(({ label, obj, def }) => (
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