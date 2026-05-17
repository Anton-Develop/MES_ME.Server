// src/pages/TemperingHeatReport.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Grid, Paper, Typography, Stack, Chip, Button,
    CircularProgress, Divider, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TextField, MenuItem,
    Alert, IconButton, Tooltip, LinearProgress,
} from '@mui/material';
import {
    Download      as DownloadIcon,
    Close         as CloseIcon,
    ShowChart     as ChartIcon,
    GridOn        as TableIcon,
    Warning       as WarnIcon,
    LocalFireDepartment as FireIcon,
    CheckCircle   as OkIcon,
} from '@mui/icons-material';
import Highcharts      from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { furnaceApi }  from '../api/furnaceApi';

// ---------------------------------------------------------------------------
// Константы и утилиты
// ---------------------------------------------------------------------------
const BG       = '#0d1117';
const SURFACE  = '#161b22';
const BORDER   = '#21262d';
const MUTED    = '#8b949e';
const PRIMARY  = '#58a6ff';
const SUCCESS  = '#3fb950';
const WARNING  = '#d29922';
const DANGER   = '#f85149';
const ACCENT   = '#f0883e';

const fmtTemp = (v) => v != null ? `${Number(v).toFixed(1)} °C` : '—';
const fmtMin  = (v) => v != null ? `${Number(v).toFixed(0)} мин` : '—';
const fmtDt   = (v) => v
    ? new Date(v).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
    })
    : '—';

const toIso = (s) => {
    try { return new Date(s).toISOString(); }
    catch { return s; }
};

// ---------------------------------------------------------------------------
// Маленький блок метрики
// ---------------------------------------------------------------------------
function Metric({ label, value, color, mono = true }) {
    return (
        <Box>
            <Typography sx={{ fontSize: '0.65rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
            </Typography>
            <Typography sx={{
                fontFamily: mono ? '"JetBrains Mono", "Fira Code", monospace' : 'inherit',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: color ?? '#e6edf3',
                lineHeight: 1.3,
            }}>
                {value ?? '—'}
            </Typography>
        </Box>
    );
}

// ---------------------------------------------------------------------------
// Строка сессии в списке
// ---------------------------------------------------------------------------
function SessionRow({ session, selected, onClick }) {
    const isDouble  = session.cass1No > 0;
    const cassette  = isDouble
        ? `К: ${session.cass1No} / ${session.cass2No}`
        : session.cassetteNo ? `К: ${session.cassetteNo}` : '';

    const overTemp  = session.tempMax > (session.targetTemp ?? 999);
    const pct = session.targetTime && session.durationMin
        ? Math.min((session.durationMin / session.targetTime) * 100, 100)
        : null;

    return (
        <Box
            onClick={() => onClick(session.id)}
            sx={{
                display: 'flex', alignItems: 'stretch',
                mb: '1px', cursor: 'pointer',
                borderLeft: `3px solid ${selected ? PRIMARY : 'transparent'}`,
                bgcolor: selected ? 'rgba(88,166,255,0.06)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(88,166,255,0.04)', borderLeftColor: selected ? PRIMARY : 'rgba(88,166,255,0.4)' },
                transition: 'all 0.12s',
            }}
        >
            <Box sx={{ flex: 1, px: 1.5, py: 1 }}>
                {/* Верхняя строка */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.3}>
                    <Typography sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.78rem', color: PRIMARY, fontWeight: 500,
                    }}>
                        {fmtDt(session.startedAt)}
                    </Typography>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                        {session.hadFault && (
                            <WarnIcon sx={{ fontSize: 13, color: DANGER }} />
                        )}
                        <Typography sx={{
                            fontFamily: 'monospace', fontSize: '0.75rem',
                            color: overTemp ? WARNING : SUCCESS,
                        }}>
                            {fmtTemp(session.tempMax)}
                        </Typography>
                        <Box sx={{
                            px: 0.8, py: 0.1,
                            border: `1px solid ${BORDER}`,
                            borderRadius: '3px',
                            fontSize: '0.68rem',
                            fontFamily: 'monospace',
                            color: MUTED,
                            lineHeight: 1.6,
                        }}>
                            {fmtMin(session.durationMin)}
                        </Box>
                    </Stack>
                </Stack>

                {/* Нижняя строка */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: '0.68rem', color: MUTED }}>
                        {cassette || 'нет кассеты'}
                        {session.targetTemp ? ` · Цель: ${fmtTemp(session.targetTemp)}` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: MUTED, fontFamily: 'monospace' }}>
                        ∅ {fmtTemp(session.tempAvg)}
                    </Typography>
                </Stack>

                {/* Прогресс-полоска */}
                {pct != null && (
                    <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                            mt: 0.6, height: 2, borderRadius: 1,
                            bgcolor: 'rgba(255,255,255,0.05)',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: pct > 95 ? SUCCESS : PRIMARY,
                            },
                        }}
                    />
                )}
            </Box>
        </Box>
    );
}

// ---------------------------------------------------------------------------
// Highcharts опции для графика деталей
// ---------------------------------------------------------------------------
function buildChartOptions(details, targetTemp) {
    if (!details?.length) return null;

    const ts   = details.map(d => new Date(d.time).getTime());
    const maxT = Math.max(...details.map(d => d.tempAct ?? 0));
    const yMax = Math.max(maxT * 1.05, (targetTemp ?? 0) * 1.05, 50);

    return {
        chart: {
            type: 'line', height: 340, animation: false,
            backgroundColor: SURFACE,
            style: { fontFamily: '"JetBrains Mono", "Fira Code", monospace' },
            zoomType: 'x',
            marginRight: 60,
        },
        title:   { text: null },
        credits: { enabled: false },
        xAxis: {
            type: 'datetime',
            labels: { format: '{value:%H:%M}', style: { color: MUTED, fontSize: '10px' } },
            gridLineColor: 'rgba(255,255,255,0.04)',
            lineColor: BORDER, tickColor: BORDER,
            crosshair: { color: 'rgba(88,166,255,0.3)', width: 1 },
        },
        yAxis: [
            // Левая: температура
            {
                title: { text: '°C', style: { color: MUTED }, rotation: 0, margin: 8 },
                gridLineColor: 'rgba(255,255,255,0.05)',
                labels: { style: { color: MUTED, fontSize: '10px' } },
                min: 0, max: yMax,
                plotLines: targetTemp ? [{
                    value: targetTemp, color: PRIMARY,
                    dashStyle: 'ShortDash', width: 1, zIndex: 5,
                    label: {
                        text: `Цель ${fmtTemp(targetTemp)}`,
                        style: { color: PRIMARY, fontSize: '9px' },
                        align: 'right', x: -4,
                    },
                }] : [],
            },
            // Правая: прогресс %
            {
                title: { text: '%', style: { color: MUTED }, rotation: 0, margin: 8 },
                labels: { format: '{value}%', style: { color: MUTED, fontSize: '10px' } },
                opposite: true,
                min: 0, max: 110,
                gridLineWidth: 0,
            },
        ],
        tooltip: {
            shared: true,
            backgroundColor: '#1c2128',
            borderColor: BORDER,
            borderRadius: 6,
            padding: 10,
            style: { color: '#e6edf3', fontSize: '11px' },
            xDateFormat: '%d.%m.%Y %H:%M',
        },
        legend: {
            enabled: true,
            itemStyle: { color: MUTED, fontSize: '10px', fontWeight: 'normal' },
            itemHoverStyle: { color: '#e6edf3' },
        },
        plotOptions: {
            series: {
                boostThreshold: 200, turboThreshold: 0,
                animation: false, marker: { enabled: false },
                connectNulls: false,
            },
        },
        boost: { enabled: true, useGPUTranslations: true, seriesThreshold: 1 },
        exporting: {
            enabled: true,
            buttons: { contextButton: { menuItems: ['downloadPNG', 'downloadCSV', 'separator', 'printChart'] } },
        },
        series: [
            {
                name: 'T факт', yAxis: 0,
                color: ACCENT, lineWidth: 2,
                data: ts.map((t, i) => [t, details[i].tempAct ?? null]),
                tooltip: { valueSuffix: ' °C', valueDecimals: 1 },
            },
            {
                name: 'T задание', yAxis: 0,
                color: PRIMARY, lineWidth: 1.5, dashStyle: 'ShortDash',
                data: ts.map((t, i) => [t, details[i].tempRef ?? null]),
                tooltip: { valueSuffix: ' °C', valueDecimals: 1 },
            },
            {
                name: 'T1', yAxis: 0,
                color: SUCCESS, lineWidth: 1, opacity: 0.8,
                data: ts.map((t, i) => [t, details[i].t1 ?? null]),
                tooltip: { valueSuffix: ' °C', valueDecimals: 1 },
            },
            {
                name: 'T2', yAxis: 0,
                color: '#79c0ff', lineWidth: 1, opacity: 0.8,
                data: ts.map((t, i) => [t, details[i].t2 ?? null]),
                tooltip: { valueSuffix: ' °C', valueDecimals: 1 },
            },
            {
                name: 'Прогресс', yAxis: 1,
                color: '#30363d', lineWidth: 1.5,
                data: ts.map((t, i) => {
                    const d = details[i];
                    if (!d.actTimeTotal || !d.timeProcSet) return [t, null];
                    return [t, Math.min((d.actTimeTotal / d.timeProcSet) * 100, 100)];
                }),
                tooltip: { valueSuffix: '%', valueDecimals: 0 },
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Панель деталей выбранной сессии
// ---------------------------------------------------------------------------
function SessionDetail({ session, details, loading, onClose, furnaceNo }) {
    const [view, setView] = useState('chart'); // 'chart' | 'table'

    const chartOpts = useMemo(
        () => buildChartOptions(details, session?.targetTemp),
        [details, session?.targetTemp]
    );

    const exportCsv = () => {
        if (!details.length) return;
        const keys = Object.keys(details[0]);
        const csv  = [keys.join(','), ...details.map(r => keys.map(k => r[k] ?? '').join(','))].join('\n');
        const a = Object.assign(document.createElement('a'), {
            href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
            download: `tempering_f${furnaceNo}_${session?.startedAt?.slice(0, 10)}.csv`,
        });
        a.click();
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Заголовок панели */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <FireIcon sx={{ fontSize: 16, color: ACCENT }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#e6edf3' }}>
                        Цикл от {fmtDt(session?.startedAt)}
                    </Typography>
                    {session?.hadFault && (
                        <Chip
                            icon={<WarnIcon sx={{ fontSize: '12px !important' }} />}
                            label="Была авария"
                            size="small"
                            sx={{ bgcolor: 'rgba(248,81,73,0.15)', color: DANGER, border: `1px solid ${DANGER}`, height: 20, fontSize: '0.65rem' }}
                        />
                    )}
                </Stack>
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Скачать CSV">
                        <IconButton size="small" onClick={exportCsv} disabled={!details.length} sx={{ color: MUTED, '&:hover': { color: PRIMARY } }}>
                            <DownloadIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={onClose} sx={{ color: MUTED, '&:hover': { color: '#e6edf3' } }}>
                        <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Stack>
            </Stack>

            {/* Метрики сессии */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
                <Grid container spacing={2}>
                    {[
                        { label: 'Начало',       value: fmtDt(session?.startedAt) },
                        { label: 'Конец',         value: fmtDt(session?.endedAt) },
                        { label: 'Длительность',  value: fmtMin(session?.durationMin) },
                        { label: 'Целевая T',     value: fmtTemp(session?.targetTemp), color: PRIMARY },
                        { label: 'Уст. время',    value: fmtMin(session?.targetTime) },
                        { label: 'T средняя',     value: fmtTemp(session?.tempAvg) },
                        { label: 'T минимум',     value: fmtTemp(session?.tempMin) },
                        { label: 'T максимум',    value: fmtTemp(session?.tempMax), color: ACCENT },
                    ].map(({ label, value, color }) => (
                        <Grid item key={label}>
                            <Metric label={label} value={value} color={color} />
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* Переключатель вид */}
            <Stack direction="row" spacing={0} sx={{ px: 2, pt: 1.5, pb: 1 }}>
                {[
                    { id: 'chart', icon: <ChartIcon sx={{ fontSize: 14 }} />, label: 'График' },
                    { id: 'table', icon: <TableIcon sx={{ fontSize: 14 }} />, label: 'Таблица' },
                ].map(({ id, icon, label }) => (
                    <Button
                        key={id}
                        size="small"
                        startIcon={icon}
                        onClick={() => setView(id)}
                        sx={{
                            mr: 0.5,
                            fontSize: '0.72rem',
                            color:   view === id ? PRIMARY : MUTED,
                            bgcolor: view === id ? 'rgba(88,166,255,0.1)' : 'transparent',
                            border: `1px solid ${view === id ? PRIMARY : BORDER}`,
                            borderRadius: '4px',
                            textTransform: 'none',
                            minWidth: 0, px: 1.2, py: 0.4,
                            '&:hover': { bgcolor: 'rgba(88,166,255,0.08)' },
                        }}
                    >
                        {label}
                    </Button>
                ))}
            </Stack>

            {/* Контент */}
            <Box sx={{ flex: 1, overflow: 'auto', px: view === 'chart' ? 1 : 0, pb: 2 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
                        <CircularProgress size={28} sx={{ color: PRIMARY }} />
                    </Box>
                ) : view === 'chart' ? (
                    chartOpts
                        ? <HighchartsReact highcharts={Highcharts} options={chartOpts} />
                        : <Typography sx={{ color: MUTED, textAlign: 'center', pt: 6 }}>Нет данных</Typography>
                ) : (
                    <TableContainer>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    {['Время', 'T факт', 'T зад', 'T1', 'T2', 'Прогресс'].map(h => (
                                        <TableCell key={h} sx={{ bgcolor: '#161b22', color: MUTED, fontSize: '0.68rem', py: 0.8, borderBottom: `1px solid ${BORDER}` }}>
                                            {h}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {details.map((row, idx) => {
                                    const pct = row.actTimeTotal && row.timeProcSet
                                        ? ((row.actTimeTotal / row.timeProcSet) * 100).toFixed(0)
                                        : '—';
                                    return (
                                        <TableRow key={idx} sx={{ '&:hover': { bgcolor: 'rgba(88,166,255,0.04)' } }}>
                                            <TableCell sx={{ color: MUTED, fontSize: '0.68rem', fontFamily: 'monospace', py: 0.5, borderBottom: `1px solid ${BORDER}` }}>
                                                {new Date(row.time).toLocaleTimeString('ru-RU')}
                                            </TableCell>
                                            {[
                                                { v: row.tempAct,  c: ACCENT },
                                                { v: row.tempRef,  c: PRIMARY },
                                                { v: row.t1,       c: SUCCESS },
                                                { v: row.t2,       c: '#79c0ff' },
                                            ].map(({ v, c }, i) => (
                                                <TableCell key={i} align="right" sx={{ color: c, fontSize: '0.72rem', fontFamily: 'monospace', py: 0.5, borderBottom: `1px solid ${BORDER}` }}>
                                                    {v != null ? `${Number(v).toFixed(1)} °C` : '—'}
                                                </TableCell>
                                            ))}
                                            <TableCell align="right" sx={{ color: MUTED, fontSize: '0.72rem', fontFamily: 'monospace', py: 0.5, borderBottom: `1px solid ${BORDER}` }}>
                                                {pct === '—' ? pct : `${pct}%`}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Box>
    );
}

// ---------------------------------------------------------------------------
// Главная страница
// ---------------------------------------------------------------------------
export default function TemperingHeatReport() {
    const [furnaceNo,  setFurnaceNo]  = useState(1);
    const [fromDate,   setFromDate]   = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
    });
    const [toDate,     setToDate]     = useState(() => new Date().toISOString().slice(0, 10));

    const [sessions,   setSessions]   = useState([]);
    const [total,      setTotal]      = useState(0);
    const [selId,      setSelId]      = useState(null);
    const [selSession, setSelSession] = useState(null);
    const [details,    setDetails]    = useState([]);

    const [listLoading, setListLoading] = useState(false);
    const [detLoading,  setDetLoading]  = useState(false);
    const [error,       setError]       = useState(null);

    // -----------------------------------------------------------------------
    const loadSessions = useCallback(async () => {
        setListLoading(true);
        setError(null);
        setSelId(null);
        setSelSession(null);
        setDetails([]);
        try {
            const res = await furnaceApi.getTemperingSessions({
                furnaceNo,
                from: toIso(fromDate),
                to:   toIso(toDate + 'T23:59:59'),
                page: 1, pageSize: 200,
            });
            // Контроллер возвращает { items, total } или массив
            const body = res.data ?? res;
            if (Array.isArray(body)) {
                setSessions(body);
                setTotal(body.length);
            } else {
                setSessions(body.items ?? []);
                setTotal(body.total   ?? 0);
            }
        } catch (e) {
            setError(e.response?.data?.error ?? e.message);
        } finally {
            setListLoading(false);
        }
    }, [furnaceNo, fromDate, toDate]);

    const loadDetails = useCallback(async (id) => {
        setSelId(id);
        const s = sessions.find(x => x.id === id);
        setSelSession(s ?? null);
        setDetails([]);
        setDetLoading(true);
        try {
            const res  = await furnaceApi.getTemperingSessionById(id);
            const body = res.data ?? res;
            setSelSession(body.session ?? s);
            setDetails(body.details ?? []);
        } catch (e) {
            console.error(e);
        } finally {
            setDetLoading(false);
        }
    }, [sessions]);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    const exportSessions = () => {
        if (!sessions.length) return;
        const keys = Object.keys(sessions[0]);
        const csv  = [keys.join(','), ...sessions.map(r => keys.map(k => r[k] ?? '').join(','))].join('\n');
        const a = Object.assign(document.createElement('a'), {
            href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
            download: `tempering_f${furnaceNo}_sessions.csv`,
        });
        a.click();
    };

    // -----------------------------------------------------------------------
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: BG, overflow: 'hidden' }}>

            {/* ── Шапка ──────────────────────────────────────────────── */}
            <Box sx={{
                px: 2.5, py: 1.5,
                borderBottom: `1px solid ${BORDER}`,
                bgcolor: SURFACE,
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            }}>
                {/* Заголовок */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 1 }}>
                    <FireIcon sx={{ color: ACCENT, fontSize: 18 }} />
                    <Typography sx={{ color: '#e6edf3', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Отчёт по отпуску
                    </Typography>
                </Stack>

                <Divider orientation="vertical" flexItem sx={{ borderColor: BORDER }} />

                {/* Печь */}
                <TextField
                    select value={furnaceNo}
                    onChange={e => setFurnaceNo(Number(e.target.value))}
                    size="small"
                    sx={{
                        width: 100,
                        '& .MuiOutlinedInput-root': {
                            bgcolor: BG, color: '#e6edf3', fontSize: '0.8rem',
                            '& fieldset': { borderColor: BORDER },
                            '&:hover fieldset': { borderColor: '#30363d' },
                            '&.Mui-focused fieldset': { borderColor: PRIMARY },
                        },
                        '& .MuiSelect-icon': { color: MUTED },
                    }}
                >
                    {[1,2,3,4].map(n => (
                        <MenuItem key={n} value={n} sx={{ fontSize: '0.8rem' }}>Печь №{n}</MenuItem>
                    ))}
                </TextField>

                {/* Даты */}
                {[
                    { label: 'с', value: fromDate, set: setFromDate },
                    { label: 'по', value: toDate,  set: setToDate  },
                ].map(({ label, value, set }) => (
                    <Stack key={label} direction="row" alignItems="center" spacing={0.5}>
                        <Typography sx={{ fontSize: '0.72rem', color: MUTED }}>{label}</Typography>
                        <TextField
                            type="date" value={value}
                            onChange={e => set(e.target.value)}
                            size="small"
                            InputProps={{ sx: { fontSize: '0.8rem' } }}
                            sx={{
                                width: 140,
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: BG, color: '#e6edf3',
                                    '& fieldset': { borderColor: BORDER },
                                    '&:hover fieldset': { borderColor: '#30363d' },
                                    '&.Mui-focused fieldset': { borderColor: PRIMARY },
                                },
                                '& input[type="date"]::-webkit-calendar-picker-indicator': { filter: 'invert(0.6)' },
                            }}
                        />
                    </Stack>
                ))}

                {/* Кнопки */}
                <Button
                    variant="contained" size="small"
                    onClick={loadSessions}
                    disabled={listLoading}
                    sx={{
                        bgcolor: PRIMARY, color: '#0d1117', fontWeight: 700,
                        fontSize: '0.78rem', textTransform: 'none', px: 2,
                        '&:hover': { bgcolor: '#79c0ff' },
                        '&.Mui-disabled': { bgcolor: '#30363d', color: MUTED },
                    }}
                >
                    {listLoading ? <CircularProgress size={14} sx={{ color: '#0d1117' }} /> : 'Показать'}
                </Button>

                <Tooltip title="Экспорт списка CSV">
                    <span>
                        <IconButton
                            size="small"
                            onClick={exportSessions}
                            disabled={!sessions.length}
                            sx={{ color: MUTED, '&:hover': { color: SUCCESS }, border: `1px solid ${BORDER}`, borderRadius: '4px', p: 0.5 }}
                        >
                            <DownloadIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </span>
                </Tooltip>

                {/* Счётчик */}
                <Box sx={{ ml: 'auto' }}>
                    {total > 0 && (
                        <Typography sx={{ fontSize: '0.72rem', color: MUTED, fontFamily: 'monospace' }}>
                            {sessions.length} / {total} циклов
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* ── Ошибка ─────────────────────────────────────────────── */}
            {error && (
                <Alert
                    severity="error"
                    onClose={() => setError(null)}
                    sx={{ m: 1, bgcolor: 'rgba(248,81,73,0.1)', color: DANGER, border: `1px solid rgba(248,81,73,0.3)`, '& .MuiAlert-icon': { color: DANGER } }}
                >
                    {error}
                </Alert>
            )}

            {/* ── Основной контент ────────────────────────────────────── */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Список сессий */}
                <Box
                    sx={{
                        width: selId ? 300 : '100%',
                        minWidth: selId ? 260 : undefined,
                        borderRight: selId ? `1px solid ${BORDER}` : 'none',
                        display: 'flex', flexDirection: 'column',
                        transition: 'width 0.2s ease',
                        overflow: 'hidden',
                    }}
                >
                    {/* Заголовок колонки */}
                    <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${BORDER}` }}>
                        <Typography sx={{ fontSize: '0.7rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Циклы нагрева
                        </Typography>
                    </Box>

                    <Box sx={{ flex: 1, overflowY: 'auto' }}>
                        {listLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
                                <CircularProgress size={24} sx={{ color: PRIMARY }} />
                            </Box>
                        ) : sessions.length === 0 ? (
                            <Box sx={{ textAlign: 'center', pt: 6 }}>
                                <Typography sx={{ color: MUTED, fontSize: '0.82rem' }}>
                                    Нет данных за выбранный период
                                </Typography>
                            </Box>
                        ) : (
                            sessions.map(s => (
                                <SessionRow
                                    key={s.id}
                                    session={s}
                                    selected={s.id === selId}
                                    onClick={loadDetails}
                                />
                            ))
                        )}
                    </Box>
                </Box>

                {/* Детали */}
                {selId && (
                    <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <SessionDetail
                            session={selSession}
                            details={details}
                            loading={detLoading}
                            onClose={() => { setSelId(null); setSelSession(null); setDetails([]); }}
                            furnaceNo={furnaceNo}
                        />
                    </Box>
                )}

                {/* Заглушка когда не выбрана сессия и список не пустой */}
                {!selId && !listLoading && sessions.length > 0 && (
                    <Box sx={{
                        position: 'absolute', right: '30%', top: '50%', transform: 'translateY(-50%)',
                        textAlign: 'center', pointerEvents: 'none', display: { xs: 'none', md: 'block' },
                    }}>
                        <ChartIcon sx={{ fontSize: 48, color: 'rgba(88,166,255,0.1)', mb: 1 }} />
                        <Typography sx={{ color: 'rgba(88,166,255,0.3)', fontSize: '0.8rem' }}>
                            Выберите цикл для просмотра деталей
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}