// src/components/Reports/SheetCustomerReport.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Chip, Divider, Button,
  CircularProgress, Alert, Stack,
} from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import Exporting  from 'highcharts/modules/exporting';
import ExportData from 'highcharts/modules/export-data';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PrintStyles from '../PrintStyles';
import { furnaceApi }   from '../../api/furnaceApi';
import { quenchingApi } from '../../api/quenchingApi';
import api from '../../api';
import { generateSheetPdf } from '../../pdf/SheetPdfGenerator';

if (typeof Exporting  === 'function') Exporting(Highcharts);
if (typeof ExportData === 'function') ExportData(Highcharts);

// ---------------------------------------------------------------------------
// Утилиты — идентично FurnaceReport / QuenchingReport
// ---------------------------------------------------------------------------
const fmtDate = (d) => d
  ? new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  : '—';

const fmtMin  = (v) => v  != null ? `${Number(v).toFixed(1)} мин` : '—';
const fmtTemp = (v) => v  != null ? `${Number(v).toFixed(1)} °C`  : '—';
const fmtVal  = (v, dec = 2, unit = '') =>
  v != null ? `${Number(v).toFixed(dec)}${unit ? ' ' + unit : ''}` : null;

const fmtSec = (v) => {
  if (v == null) return '—';
  const s = Math.round(v);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} мин ${s % 60} с` : `${s} с`;
};

//const fmtVal = (v, dec = 2, unit = '') =>
//  v != null ? `${Number(v).toFixed(dec)}${unit ? ' ' + unit : ''}` : null;

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

// ---------------------------------------------------------------------------
// Константы зон — идентично FurnaceReport
// ---------------------------------------------------------------------------
const SERIES = {
  Z1: [
    { key: 'z1_1', name: 'З1.1', color: '#1565c0' },
    { key: 'z1_2', name: 'З1.2', color: '#1976d2' },
    { key: 'z1_3', name: 'З1.3', color: '#42a5f5' },
    { key: 'z1_4', name: 'З1.4', color: '#90caf9' },
  ],
  Z2: [
    { key: 'z2_1', name: 'З2.1', color: '#00695c' },
    { key: 'z2_2', name: 'З2.2', color: '#00897b' },
    { key: 'z2_3', name: 'З2.3', color: '#26a69a' },
    { key: 'z2_4', name: 'З2.4', color: '#80cbc4' },
  ],
  Z3: [
    { key: 'z3_1', name: 'З3.1 (верх)', color: '#bf360c' },
    { key: 'z3_2', name: 'З3.2',        color: '#e64a19' },
    { key: 'z3_3', name: 'З3.3',        color: '#ff7043' },
    { key: 'z3_4', name: 'З3.4 (низ)',  color: '#ffab91' },
  ],
  Z4: [
    { key: 'z4_1', name: 'З4.1 (верх)', color: '#b71c1c' },
    { key: 'z4_2', name: 'З4.2',        color: '#c62828' },
    { key: 'z4_3', name: 'З4.3',        color: '#ef5350' },
    { key: 'z4_4', name: 'З4.4 (низ)',  color: '#ef9a9a' },
  ],
};

const REF_KEYS = {
  Z1: 'z1_1_ref',
  Z2: 'z2_1_ref',
  Z3: 'z3_1_ref',
  Z4: 'z4_1_ref',
};

const ZONE_COLORS = {
  Z1: '#1565c0',
  Z2: '#00695c',
  Z3: '#bf360c',
  Z4: '#b71c1c',
};

const EXPORT_BUTTONS = {
  contextButton: {
    menuItems: [
      'viewFullscreen', 'separator',
      'downloadPNG', 'downloadSVG', 'separator',
      'downloadCSV', 'separator', 'printChart',
    ],
  },
};

// ---------------------------------------------------------------------------
// Чарт-утилиты — идентично FurnaceReport
// ---------------------------------------------------------------------------
const computeZoneAvg = (normalized, seriesDef) => {
  const timestamps = getTimestamps(normalized);
  if (!timestamps.length) return null;
  const arrays = seriesDef
    .filter(s => normalized[s.key]?.length)
    .map(s => normalized[s.key]);
  if (!arrays.length) return null;
  return timestamps.map((ts, i) => {
    const vals = arrays.map(arr => arr[i]).filter(v => v != null);
    return [ts, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null];
  });
};

const trimToRecovery = (avgData, minDropDeg = 5) => {
  if (!avgData || avgData.length < 4) return avgData;
  let minIdx = 0;
  for (let i = 1; i < avgData.length; i++) {
    if (avgData[i][1] != null && avgData[i][1] < avgData[minIdx][1]) minIdx = i;
  }
  const drop = (avgData[0][1] ?? 0) - (avgData[minIdx][1] ?? 0);
  return drop < minDropDeg ? avgData : avgData.slice(minIdx);
};

const buildContinuousSeries = (zonesDef) => {
  const allPoints = [];
  zonesDef.forEach(({ tempsObj, seriesDef, color }, zIdx) => {
    const normalized = normalizeKeys(tempsObj);
    if (!normalized) return;
    const avgData = computeZoneAvg(normalized, seriesDef);
    if (!avgData) return;
    const trimmed = trimToRecovery(avgData);
    trimmed?.forEach(([ts, val]) => {
      if (val != null) allPoints.push({ ts, val, color, zIdx });
    });
  });
  if (!allPoints.length) return null;

  const tsMap = new Map();
  for (const p of allPoints) {
    if (!tsMap.has(p.ts) || p.val > tsMap.get(p.ts).val) tsMap.set(p.ts, p);
  }
  const sorted = Array.from(tsMap.values()).sort((a, b) => a.ts - b.ts);
  const data   = sorted.map(p => [p.ts, p.val]);

  const hcZones = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].color !== sorted[i - 1].color)
      hcZones.push({ value: sorted[i].ts, color: sorted[i - 1].color });
  }
  return { data, hcZones, lastColor: sorted.at(-1)?.color };
};

// ---------------------------------------------------------------------------
// Сводный график нагрева — аналог CombinedChart из FurnaceReport
// ---------------------------------------------------------------------------
const HeatingCombinedChart = ({ zones, chartRef  }) => {
  const options = useMemo(() => {
    const profile = buildContinuousSeries(zones);
    if (!profile) return null;

    const series = [{
      name:      'Средняя температура',
      lineWidth: 2.5,
      color:     profile.lastColor,
      zones:     profile.hcZones,
      zoneAxis:  'x',
      data:      profile.data,
      marker:    { enabled: false },
      tooltip:   { valueSuffix: ' °C', valueDecimals: 1 },
      zIndex:    5,
    }];

    // Задание — из всех зон в единую карту, начиная с первой точки профиля
    const refMap = new Map();
    for (const { tempsObj, refKey } of zones) {
      const normalized = normalizeKeys(tempsObj);
      if (!normalized) continue;
      const timestamps = getTimestamps(normalized);
      const refData    = normalized[refKey];
      if (!refData?.length) continue;
      timestamps.forEach((ts, i) => { if (refData[i] != null) refMap.set(ts, refData[i]); });
    }
    if (refMap.size) {
      const profileStart = profile.data[0][0];
      const refSorted = Array.from(refMap.entries())
        .sort((a, b) => a[0] - b[0])
        .filter(([ts]) => ts >= profileStart);
      if (refSorted.length) {
        series.push({
          name:      'Задание',
          color:     '#212121',
          lineWidth: 2,
          dashStyle: 'ShortDash',
          zIndex:    10,
          data:      refSorted,
          marker:    { enabled: false },
          tooltip:   { valueSuffix: ' °C', valueDecimals: 0 },
        });
      }
    }

    return {
      time: {
      timezone: 'Asia/Yekaterinburg'
    },
      chart: {
        type: 'line', height: 320, zoomType: 'x', animation: false,
        backgroundColor: '#fff',
        style: { fontFamily: '"Roboto","Helvetica","Arial",sans-serif' },
      },
      title:   { text: null },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime', crosshair: true,
        labels: { format: '{value:%H:%M}', style: { fontSize: '11px' } },
      },
      yAxis: {
        title:         { text: '°C', style: { color: '#555' } },
        gridLineColor: '#e0e0e0',
        labels:        { style: { fontSize: '11px' } },
      },
      tooltip:  { shared: true, xDateFormat: '%d.%m.%Y %H:%M:%S', style: { fontSize: '12px' } },
      legend:   { enabled: true, itemStyle: { fontSize: '12px', color: '#333' } },
      plotOptions: {
        series: { boostThreshold: 300, turboThreshold: 0, animation: false, connectNulls: false },
      },
      boost:     { enabled: true, useGPUTranslations: true, seriesThreshold: 1 },
      exporting: { enabled: true, buttons: EXPORT_BUTTONS },
      series,
    };
  }, [zones]);

  if (!options) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">Нет данных</Typography>
      </Box>
    );
  }

  return (
    <HighchartsReact
      ref={chartRef}
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { height: '320px' } }}
    />
  );
};

// ---------------------------------------------------------------------------
// Строка значения в карточке — аналог паттерна из ZoneColumn
// ---------------------------------------------------------------------------
const ValueRow = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography
      variant="caption" fontWeight={700} fontFamily="monospace"
      sx={{ color: value != null ? (color ?? 'text.primary') : 'text.disabled' }}
    >
      {value ?? '—'}
    </Typography>
  </Box>
);


// ---------------------------------------------------------------------------
// График отпуска
// ---------------------------------------------------------------------------
const TemperingChart = ({ tempData, chartRef  }) => {
  const options = useMemo(() => {
    if (!tempData || tempData.length === 0) return null;

    const toChartData = (key) =>
      tempData.map(d => {
        const val = d[key];
        return [new Date(d.time).getTime(), val != null ? Number(val) : null];
      });

    return {
      time: { 
      timezone: 'Asia/Yekaterinburg'
    },
      chart: { type: 'spline', height: 320, zoomType: 'xy', animation: false, backgroundColor: '#fff' },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime', crosshair: true,
        dateTimeLabelFormats: {
          second: '%H:%M:%S', minute: '%H:%M', hour: '%H:%M',
          day: '%d.%m', week: '%d.%m', month: '%m.%Y', year: '%Y'
        },
        labels: { format: '{value:%H:%M}', style: { fontSize: '11px' } }
      },
      yAxis: {
        title: { text: '°C', style: { color: '#555' } }, min: 0,
        gridLineColor: '#e0e0e0', labels: { style: { fontSize: '11px' } }
      },
      tooltip: {
        shared: true, crosshairs: true, xDateFormat: '%d.%m.%Y %H:%M:%S',
        valueSuffix: ' °C', style: { fontSize: '12px' }
      },
      legend: { enabled: true, itemStyle: { fontSize: '12px', color: '#333' } },
      plotOptions: {
        series: { boostThreshold: 300, marker: { enabled: false }, animation: false, connectNulls: false }
      },
      boost: { enabled: true, useGPUTranslations: true },
      exporting: { enabled: true, buttons: EXPORT_BUTTONS }, // Кнопки экспорта как у нагрева
      series: [
        { name: 'Заданная', data: toChartData('tempRef'), color: '#1976d2', dashStyle: 'Dash', lineWidth: 2 },
        { name: 'Фактическая', data: toChartData('tempAct'), color: '#d29922', lineWidth: 2 }
      ]
    };
  }, [tempData]);

  if (!options) return <Alert severity="info" sx={{ m: 1 }}>Температурные данные отпуска отсутствуют</Alert>;

  return (
    <HighchartsReact
      ref={chartRef}
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { height: '320px' } }}
    />
  );
};
// ---------------------------------------------------------------------------
// Основной компонент
// ---------------------------------------------------------------------------
const SheetCustomerReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const reportRef = useRef(null);

  const heatingChartRef = useRef(null);
  const temperingChartRef = useRef(null);

  const searchParams   = new URLSearchParams(location.search);
  const furnaceKey     = searchParams.get('furnaceKey');
  const quenchingKey   = searchParams.get('quenchingKey');
  const isPrint        = searchParams.get('print') === 'true';


  // ── useState ──────────────────────────────────────────────
  const [furnaceSession,   setFurnaceSession]   = useState(null);
  const [quenchingSession, setQuenchingSession] = useState(null);
  const [temperingData, setTemperingData]       = useState(null);   
  const [loadingTempering, setLoadingTempering] = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);

  useEffect(() => {
    if (!furnaceKey && !quenchingKey) { setLoading(false); return; }
    const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, qRes] = await Promise.allSettled([
        furnaceKey   ? furnaceApi.getSessionByKey(furnaceKey)     : Promise.resolve(null),
        quenchingKey ? quenchingApi.getSessionByKey(quenchingKey) : Promise.resolve(null),
      ]);
      if (fRes.status === 'fulfilled' && fRes.value)
        setFurnaceSession(fRes.value.data ?? null);
      if (qRes.status === 'fulfilled' && qRes.value)
        setQuenchingSession(qRes.value.data ?? null);
    } catch {
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };
  load();
}, [furnaceKey, quenchingKey]);

  useEffect(() => {
    if (isPrint && !loading && (furnaceSession || quenchingSession)) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [isPrint, loading, furnaceSession, quenchingSession]);

// Обработчик: сохраняем PDF + открываем диалог печати
  /*const handlePrintAndSave = async () => {
    if (!reportRef.current) return;

    const element = reportRef.current;
    const fileName = `Отчет_лист_${meta.sheet}_${new Date().toISOString().slice(0, 10)}.pdf`;

    try {
      // 1. Генерируем PDF
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Первая страница
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Добавляем остальные страницы, если контент длинный
      while (heightLeft > 0) {
        position = -pdfHeight + (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      // 2. Скачиваем PDF
      pdf.save(fileName);

      // 3. Открываем диалог печати (с задержкой)
      setTimeout(() => {
        window.print();
      }, 500);

    } catch (err) {
      console.error('Ошибка генерации PDF:', err);
      // Если PDF не сгенерировался — хотя бы откроем печать
      window.print();
    }
  };*/

  const f = furnaceSession;
const q = quenchingSession;

const tempsZ1 = useMemo(() => safeJson(f?.tempsZ1), [f]);
const tempsZ2 = useMemo(() => safeJson(f?.tempsZ2), [f]);
const tempsZ3 = useMemo(() => safeJson(f?.tempsZ3), [f]);
const tempsZ4 = useMemo(() => safeJson(f?.tempsZ4), [f]);

const zones = [
  { zKey: 'Z1', tempsObj: tempsZ1, seriesDef: SERIES.Z1, refKey: REF_KEYS.Z1, color: ZONE_COLORS.Z1 },
  { zKey: 'Z2', tempsObj: tempsZ2, seriesDef: SERIES.Z2, refKey: REF_KEYS.Z2, color: ZONE_COLORS.Z2 },
  { zKey: 'Z3', tempsObj: tempsZ3, seriesDef: SERIES.Z3, refKey: REF_KEYS.Z3, color: ZONE_COLORS.Z3 },
  { zKey: 'Z4', tempsObj: tempsZ4, seriesDef: SERIES.Z4, refKey: REF_KEYS.Z4, color: ZONE_COLORS.Z4 },
];

const hasTemps = zones.some(({ tempsObj }) => {
  const n = normalizeKeys(tempsObj);
  return n?.times?.length > 0;
});


  // ── Загрузка данных отпуска ───────────────────────────────
useEffect(() => {
    const sheet = f?.sheet ?? q?.sheet;
    const melt = f?.melt ?? q?.melt;
    const partNo = f?.partNo ?? q?.partNo;
    const pack = f?.pack ?? q?.pack;

    if (!sheet || !melt || !partNo || !pack) {
        setTemperingData(null);
        return;
    }

    const controller = new AbortController(); // ← отмена при unmount

    const loadTempering = async () => {
        setLoadingTempering(true);
        try {
            // 1. Ищем ключ кассеты
            const reheatNum = f?.reheatNum ?? q?.reheatNum ?? 0;
            const keyRes = await api.get(
                `/tempering/cassette-key-by-sheet?sheet=${encodeURIComponent(sheet)}&melt=${encodeURIComponent(melt)}&partNo=${encodeURIComponent(partNo)}&pack=${encodeURIComponent(pack)}&reheatNum=${reheatNum}`,
                { signal: controller.signal }
            );

            if (controller.signal.aborted) return;

            if (keyRes.data.cassetteBusinessKey) {
                // 2. Загружаем сессию отпуска (увеличенный таймаут 120с)
                const sessionRes = await api.get(
                    `/tempering/session-by-key?key=${encodeURIComponent(keyRes.data.cassetteBusinessKey)}&coolingMinutes=60`,
                    {
                        signal: controller.signal,      // ← отмена
                        timeout: 120_000,               // ← 120 секунд
                    }
                );

                if (!controller.signal.aborted) {
                    setTemperingData(sessionRes.data);
                }
            } else {
                setTemperingData(null);
            }
        } catch (err) {
            if (controller.signal.aborted) return;      // ← не логируем отмену

            console.error("Ошибка поиска данных по отпуску:", err);

            if (err.code === 'ECONNABORTED') {
                // Таймаут axios
                setTemperingData({ error: 'Превышено время ожидания данных отпуска' });
            } else if (err.response?.status === 408 || err.response?.status === 504) {
                // Серверный таймаут
                setTemperingData({ error: 'Сервер не успел подготовить данные отпуска' });
            } else if (err.response?.status === 404) {
                setTemperingData(null); // Лист не в отпуске — нормально
            } else {
                setTemperingData({ error: 'Не удалось загрузить данные отпуска' });
            }
        } finally {
            if (!controller.signal.aborted) {
                setLoadingTempering(false);
            }
        }
    };

    loadTempering();
    return () => { controller.abort(); };              // ← отмена при unmount
}, [f, q]);

    const meta = {
        sheet: f?.sheet ?? q?.sheet ?? furnaceKey,
        slab: f?.slab ?? q?.slab,
        melt: f?.melt ?? q?.melt,
        partNo: f?.partNo ?? q?.partNo,
        pack: f?.pack ?? q?.pack,
        reheatNum: f?.reheatNum ?? q?.reheatNum ?? 0, // <-- ДОБАВЬТЕ ЭТО
        alloyCodeText: f?.alloyCodeText ?? q?.alloyCodeText ?? f?.alloyCode ?? q?.alloyCode,
        thickness: f?.thickness ?? q?.thickness,
    };
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

  if (!f && !q) {
    return <Alert severity="warning" sx={{ m: 3 }}>Данные для листа №{furnaceKey } не найдены</Alert>;
  }
  return (
     
            <>
            <PrintStyles /> 
    <Box
        ref={reportRef}
        className="report-container"
        sx={{
            p: 3,
        }}
    >
        {/* ── Кнопки (скрываются при печати) ── */}
        <Stack direction="row" spacing={2} mb={2} className="no-print">
            <Button
                variant="contained"
                onClick={async () => {
                    await generateSheetPdf({
                        meta,
                        furnaceSession: f,
                        quenchingSession: q,
                        temperingData,
                        heatingChartRef,
                        temperingChartRef,
                        
                    });
                }}
            >
                PDF
            </Button>
            <Button
                variant="outlined"
                startIcon={<Print />}
                onClick={() => window.print()}
            >
                Печать
            </Button>
        </Stack>

        {/* ══════════════════════════════════════════════
            СТРАНИЦА 1: Шапка + Нагрев
        ══════════════════════════════════════════════ */}
        <Box className="page-heating">
            {/* Шапка */}
            <Paper sx={{ p: 2.5, mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap">
                    <Typography variant="h5" fontWeight={700}>
                        Отчёт о листе №{meta.sheet}
                    </Typography>
                    {f?.hadAlarm && <Chip label="АВАРИЯ (нагрев)" color="error" size="small" />}
                    {q?.hadAlarm && <Chip label="АВАРИЯ (закалка)" color="error" size="small" />}
                </Stack>

                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    {[
                        { label: 'Лист', value: meta.sheet },
                        { label: 'Сляб', value: meta.slab ?? '—' },
                        { label: 'Плавка', value: meta.melt ?? '—' },
                        { label: 'Партия', value: meta.partNo ?? '—' },
                        { label: 'Пачка', value: meta.pack ?? '—' },
                        { label: 'Марка стали', value: meta.alloyCodeText ?? '—' },
                        { label: 'Толщина', value: meta.thickness != null ? `${Number(meta.thickness).toFixed(1)} мм` : '—' },
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

                <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Вход в печь</Typography>
                        <Typography variant="body2" fontWeight={600}>{fmtDate(f?.enteredAt)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Выход из печи</Typography>
                        <Typography variant="body2" fontWeight={600}>{fmtDate(f?.exitedAt)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Время нагрева</Typography>
                        <Typography variant="body2" fontWeight={700} color="warning.dark">
                            {fmtMin(f?.totalMin)}
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Время закалки</Typography>
                        <Typography variant="body2" fontWeight={700} color="info.dark">
                            {fmtSec(q?.totalSec)}
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Давление воды в коллекторе закалочной машины</Typography>
                        <Typography variant="body2" fontWeight={700} color="info.dark">
                            {fmtVal((((q?.pressTopZak)+(q?.pressBotZak))/2),2,'бар')}
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Температура закалочной жидкости</Typography>
                        <Typography variant="body2" fontWeight={700} color="info.dark">
                            {fmtTemp(q?.tempHaccum)}
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>

            {/* График нагрева */}
            <Paper sx={{ p: 0, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                        Нагрев — сводный график по зонам
                    </Typography>
                </Box>
                <Box sx={{ p: 1 }} className="chart-container">
                    {hasTemps ? (
                        <HeatingCombinedChart zones={zones} chartRef={heatingChartRef} />
                    ) : (
                        <Alert severity="info">Температурные данные нагрева отсутствуют</Alert>
                    )}
                </Box>
            </Paper>
        </Box>

        {/* ══════════════════════════════════════════════
            СТРАНИЦА 2: Отпуск
        ══════════════════════════════════════════════ */}
        {temperingData?.session && (
            <Box className="page-tempering">
    <Paper sx={{ p: 2.5, minHeight: 200 }}>
        <Typography variant="h5" fontWeight={700} mb={2}>
            Отпуск
        </Typography>

        {loadingTempering ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary">
                    Загрузка данных отпуска...
                </Typography>
            </Box>
        ) : temperingData?.error ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
                {temperingData.error}
            </Alert>
        ) : temperingData?.session ? (
            <>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={6} sm={4} md={2}>
                        <Typography variant="caption" color="text.secondary">Печь</Typography>
                        <Typography variant="body2" fontWeight={600}>
                            №{temperingData.session.furnaceNumber ?? '—'}
                        </Typography>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <Typography variant="caption" color="text.secondary">Загрузка</Typography>
                        <Typography variant="body2" fontWeight={600}>
                            {fmtDate(temperingData.session.loadedAt)}
                        </Typography>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <Typography variant="caption" color="text.secondary">Выгрузка</Typography>
                        <Typography variant="body2" fontWeight={600}>
                            {fmtDate(temperingData.session.unloadedAt)}
                        </Typography>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <Typography variant="caption" color="text.secondary">Время в печи</Typography>
                        <Typography variant="body2" fontWeight={700} color="warning.dark">
                            {fmtMin(temperingData.session.act_time_total)}
                        </Typography>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <Typography variant="caption" color="text.secondary">Температура</Typography>
                        <Typography variant="body2" fontWeight={700} color="primary">
                            {fmtTemp(temperingData.session.tempRef)}
                        </Typography>
                    </Grid>
                </Grid>
                <Box className="chart-container">
                    <TemperingChart
                        tempData={temperingData.tempData}
                        chartRef={temperingChartRef}
                    />
                </Box>
            </>
        ) : !loading && (f || q) ? (
            <Alert severity="info">
                Данные отпуска для этого листа не найдены (лист ещё не прошёл отпуск или не найден в кассете)
            </Alert>
        ) : null}
    </Paper>
</Box>
        )}

        {/* Футер (скрывается при печати — он уже в PDF) */}
        <Typography
            variant="caption"
            color="text.disabled"
            display="block"
            textAlign="right"
            mt={3}
            className="no-print"
        >
            Отчёт сформирован: {fmtDate(new Date())} | Лист: {meta.sheet}
        </Typography>
    </Box>
    </>
);
};

export default SheetCustomerReport;