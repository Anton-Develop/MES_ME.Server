// src/pages/TemperingHMI.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Grid, Paper, Typography, Stack, Chip,
    CircularProgress, LinearProgress, Divider,
    Button, FormControl, InputLabel, Select, MenuItem,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Alert, Snackbar, IconButton, Tooltip
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    LocalFireDepartment as LocalFireDepartmentIcon,
    PauseCircle as PauseCircleIcon,
    PlayArrow as PlayArrowIcon,
    Print as PrintIcon,
    Refresh as RefreshIcon,
    Stop as StopIcon
} from '@mui/icons-material';
import api from '../api';

// ─── Константы ────────────────────────────────────────────────────────────────
const FURNACES = [1, 2, 3, 4];

// ─── Тема / токены ─────────────────────────────────────────────────────────────
const T = {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceAlt: '#1c2330',
    border: '#30363d',
    borderSoft: '#21262d',

    textPrimary: '#e6edf3',
    textSecondary: '#8b949e',
    textMuted: '#484f58',

    accent: '#58a6ff',
    success: '#3fb950',
    warning: '#d29922',
    danger: '#f85149',

    monoFont: "'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace",
    sansFont: "'Inter', 'Roboto', sans-serif",
};

// ─── Вспомогательные функции ───────────────────────────────────────────────────
const fmtTemp = (v) => v != null ? `${Number(v).toFixed(1)}°` : '—';
const fmtMin = (v) => v != null ? `${Number(v).toFixed(0)} мин` : '—';
const fmtBar = (v) => v != null ? `${Number(v).toFixed(3)}` : '—';
const formatTime = (dt) => dt ? new Date(dt).toLocaleTimeString('ru-RU') : '';
const formatDateTime = (dt) => dt ? new Date(dt).toLocaleString('ru-RU') : '—';

// ─── Статус-чип ────────────────────────────────────────────────────────────────
function StatusChip({ run, end, fault }) {
    const styles = {
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        height: 24,
        fontFamily: T.sansFont,
    };
    if (fault) return <Chip icon={<ErrorIcon sx={{ fontSize: '0.85rem !important' }} />}
        label="АВАРИЯ" size="small"
        sx={{ ...styles, bgcolor: '#3d1a1a', color: T.danger, border: `1px solid ${T.danger}44` }} />;
    if (run) return <Chip icon={<LocalFireDepartmentIcon sx={{ fontSize: '0.85rem !important' }} />}
        label="РАБОТАЕТ" size="small"
        sx={{ ...styles, bgcolor: '#2d2200', color: '#e3a008', border: '1px solid #d2990244' }} />;
    if (end) return <Chip icon={<CheckCircleIcon sx={{ fontSize: '0.85rem !important' }} />}
        label="ГОТОВО" size="small"
        sx={{ ...styles, bgcolor: '#0f2a1a', color: T.success, border: `1px solid ${T.success}44` }} />;
    return <Chip icon={<PauseCircleIcon sx={{ fontSize: '0.85rem !important' }} />}
        label="СТОП" size="small"
        sx={{ ...styles, bgcolor: T.surfaceAlt, color: T.textSecondary, border: `1px solid ${T.border}` }} />;
}

// ─── Метрика ──────────────────────────────────────────────────────────────────
function Metric({ label, value, unit = '', size = 'md', highlight }) {
    const sizes = {
        xl: { val: '2rem', lbl: '0.6rem' },
        md: { val: '0.85rem', lbl: '0.6rem' },
        sm: { val: '0.75rem', lbl: '0.58rem' },
    };
    const sz = sizes[size] || sizes.md;
    return (
        <Box>
            <Typography sx={{
                color: T.textMuted, fontSize: sz.lbl,
                fontFamily: T.sansFont, fontWeight: 500,
                letterSpacing: '0.05em', textTransform: 'uppercase',
                mb: 0.25, lineHeight: 1
            }}>
                {label}
            </Typography>
            <Typography sx={{
                fontFamily: T.monoFont,
                fontSize: sz.val,
                fontWeight: size === 'xl' ? 600 : 400,
                lineHeight: 1.2,
                color: highlight || T.textPrimary,
            }}>
                {value != null && value !== '—' ? `${value}${unit}` : '—'}
            </Typography>
        </Box>
    );
}

// ─── Прогресс ─────────────────────────────────────────────────────────────────
function ProgressBar({ value, max }) {
    if (!max || value == null) return null;
    const pct = Math.min((value / max) * 100, 100);
    const color = pct >= 100 ? T.success : pct > 70 ? T.accent : '#3d6b9e';
    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography sx={{ color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Прогресс
                </Typography>
                <Typography sx={{ color: pct >= 100 ? T.success : T.textSecondary, fontSize: '0.65rem', fontFamily: T.monoFont, fontWeight: 600 }}>
                    {pct.toFixed(0)}%
                </Typography>
            </Stack>
            <Box sx={{ height: 5, borderRadius: 99, bgcolor: T.surfaceAlt, overflow: 'hidden' }}>
                <Box sx={{
                    height: '100%', width: `${pct}%`,
                    bgcolor: color,
                    borderRadius: 99,
                    transition: 'width 0.6s ease',
                    boxShadow: `0 0 8px ${color}66`,
                }} />
            </Box>
        </Box>
    );
}

// ─── Метка кассеты ────────────────────────────────────────────────────────────
function CassetteLabel({ no, day, month, year, hour }) {
    if (!no && !day) return (
        <Typography sx={{ color: T.textMuted, fontSize: '0.75rem', fontFamily: T.monoFont }}>—</Typography>
    );
    const hourStr = hour != null && hour !== 99 ? `${hour}ч` : '';
    const dateStr = day && month && year ? `${day}.${String(month).padStart(2, '0')}.${year}` : '';
    const parts = [dateStr, hourStr, no ? `№${no}` : ''].filter(Boolean);
    return (
        <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.75rem', color: T.textSecondary }}>
            {parts.join(' · ')}
        </Typography>
    );
}

// ─── Разделитель ──────────────────────────────────────────────────────────────
const HRule = () => <Divider sx={{ borderColor: T.borderSoft, my: 1.5 }} />;

// ─── Секция: управление кассетой ──────────────────────────────────────────────
function CassetteControl({ furnaceNo, activeSession, availableCassettes, loading, onLoadClick, onUnloadClick }) {
    const [selected, setSelected] = useState('');

    if (activeSession) {
        return (
            <Box sx={{
                bgcolor: '#0d1f30',
                border: `1px solid ${T.accent}33`,
                borderRadius: 1.5,
                p: 1.5,
            }}>
                <Typography sx={{
                    color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1,
                }}>
                    Активная кассета
                </Typography>

                <Typography sx={{
                    fontFamily: T.monoFont, fontSize: '1rem', fontWeight: 600,
                    color: T.accent, lineHeight: 1.2, mb: 0.5,
                }}>
                    {activeSession.cassetteId}
                </Typography>

                <Typography sx={{ color: T.textSecondary, fontSize: '0.72rem', fontFamily: T.sansFont, mb: 0.25 }}>
                    Загружена: {formatDateTime(activeSession.loadedAt)}
                </Typography>
                {activeSession.loadedBy && (
                    <Typography sx={{ color: T.textMuted, fontSize: '0.7rem', fontFamily: T.sansFont, mb: 1 }}>
                        Оператор: {activeSession.loadedBy}
                    </Typography>
                )}

                <Button
                    fullWidth variant="outlined" size="small"
                    onClick={onUnloadClick}
                    disabled={loading}
                    startIcon={<StopIcon sx={{ fontSize: '0.9rem !important' }} />}
                    sx={{
                        color: T.danger,
                        borderColor: `${T.danger}66`,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        fontFamily: T.sansFont,
                        py: 0.75,
                        '&:hover': {
                            borderColor: T.danger,
                            bgcolor: `${T.danger}11`,
                        },
                    }}
                >
                    Выгрузить кассету
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel sx={{
                    color: T.textMuted,
                    fontSize: '0.78rem',
                    fontFamily: T.sansFont,
                    '&.Mui-focused': { color: T.accent },
                }}>
                    Выбрать кассету
                </InputLabel>
                <Select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    label="Выбрать кассету"
                    sx={{
                        color: T.textPrimary,
                        fontSize: '0.8rem',
                        fontFamily: T.monoFont,
                        bgcolor: T.surfaceAlt,
                        borderRadius: 1,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4a5568' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.accent },
                        '& .MuiSvgIcon-root': { color: T.textSecondary },
                    }}
                    MenuProps={{
                        PaperProps: {
                            sx: {
                                bgcolor: '#1a2330',
                                border: `1px solid ${T.border}`,
                                borderRadius: 1.5,
                                '& .MuiMenuItem-root': {
                                    fontSize: '0.8rem',
                                    fontFamily: T.monoFont,
                                    color: T.textPrimary,
                                    py: 0.75,
                                    '&:hover': { bgcolor: T.surfaceAlt },
                                    '&.Mui-selected': { bgcolor: `${T.accent}22` },
                                },
                            },
                        },
                    }}
                >
                    <MenuItem value="">
                        <Typography sx={{ color: T.textMuted, fontSize: '0.78rem', fontFamily: T.sansFont }}>
                            — Выберите кассету —
                        </Typography>
                    </MenuItem>
                    {availableCassettes.map(c => (
                        <MenuItem key={c.cassetteId} value={c.cassetteNumber}>
                            <Stack direction="row" spacing={1.5} alignItems="baseline">
                                <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.8rem', color: T.accent, fontWeight: 600 }}>
                                    {c.cassetteId}
                                </Typography>
                                <Typography sx={{ fontFamily: T.sansFont, fontSize: '0.68rem', color: T.textSecondary }}>
                                    {c.sheetsCount} л · {c.totalWeight} кг
                                </Typography>
                            </Stack>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Button
                fullWidth variant="contained" size="small"
                onClick={() => { if (selected) onLoadClick(selected); setSelected(''); }}
                disabled={loading || !selected}
                startIcon={<PlayArrowIcon sx={{ fontSize: '0.9rem !important' }} />}
                sx={{
                    bgcolor: selected ? T.accent : T.surfaceAlt,
                    color: selected ? '#0d1117' : T.textMuted,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: '0.06em',
                    fontFamily: T.sansFont,
                    py: 0.85,
                    borderRadius: 1,
                    boxShadow: selected ? `0 0 12px ${T.accent}55` : 'none',
                    transition: 'all 0.2s',
                    '&:hover': {
                        bgcolor: selected ? '#79c0ff' : T.surfaceAlt,
                        boxShadow: selected ? `0 0 20px ${T.accent}88` : 'none',
                    },
                    '&.Mui-disabled': {
                        bgcolor: T.surfaceAlt,
                        color: T.textMuted,
                    },
                }}
            >
                Загрузить в печь
            </Button>
        </Box>
    );
}

// ─── Карточка печи ────────────────────────────────────────────────────────────
function FurnaceCard({ furnaceNo, plcData, activeSession, availableCassettes, onLoad, onUnload }) {
    const [loading, setLoading] = useState(false);
    const [pendingCassette, setPendingCassette] = useState(null);
    const [openConfirm, setOpenConfirm] = useState(false);
    const [actionType, setActionType] = useState(null);

    const hasTwoSlots = furnaceNo === 3 || furnaceNo === 4;
    const isFault = plcData?.proc_fault;
    const isRun = plcData?.proc_run;
    const isEnd = plcData?.proc_end;

    const borderColor = isFault ? T.danger : isRun ? '#d29922' : isEnd ? T.success : T.border;
    const bgColor = isFault ? '#1a0d0d' : isRun ? '#1a1600' : isEnd ? '#0d1a10' : T.surface;

    const handleLoadClick = (cassetteNumber) => {
        setPendingCassette(cassetteNumber);
        setActionType('load');
        setOpenConfirm(true);
    };
    const handleUnloadClick = () => {
        setActionType('unload');
        setOpenConfirm(true);
    };
    const confirmAction = async () => {
        setLoading(true);
        try {
            if (actionType === 'load') await onLoad(furnaceNo, parseInt(pendingCassette));
            else await onUnload(furnaceNo);
            setOpenConfirm(false);
        } catch { /* parent handles error */ }
        finally { setLoading(false); }
    };

    const actColor = isFault ? T.danger : isRun ? '#f0a500' : T.textPrimary;

    return (
        <Paper elevation={0} sx={{
            bgcolor: bgColor,
            border: `1px solid ${borderColor}`,
            borderRadius: 2,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            transition: 'border-color 0.3s, background-color 0.3s',
            boxShadow: isRun ? `0 0 20px ${T.warning}22` : isEnd ? `0 0 20px ${T.success}18` : 'none',
        }}>

            {/* ── Заголовок */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography sx={{
                    color: T.textPrimary, fontWeight: 700,
                    fontSize: '0.88rem', letterSpacing: '0.02em',
                    fontFamily: T.sansFont,
                }}>
                    Печь отпуска №{furnaceNo}
                </Typography>
                <StatusChip run={isRun} end={isEnd} fault={isFault} />
            </Stack>

            <HRule />

            {/* ── Температуры факт / задание */}
            <Grid container spacing={1} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                    <Metric label="Факт" value={fmtTemp(plcData?.temp_act)} size="xl" highlight={actColor} />
                </Grid>
                <Grid item xs={6}>
                    <Metric label="Задание" value={fmtTemp(plcData?.temp_ref)} size="xl" highlight={T.accent} />
                </Grid>
            </Grid>

            {/* ── Доп. температуры */}
            <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
                <Metric label="T1" value={fmtTemp(plcData?.t1)} size="sm" />
                <Metric label="T2" value={fmtTemp(plcData?.t2)} size="sm" />
                {plcData?.t_average_furn != null && (
                    <Metric label="Ср. по печи" value={fmtTemp(plcData.t_average_furn)} size="sm" />
                )}
            </Stack>

            {/* ── Таймеры */}
            <Grid container spacing={1} sx={{ mb: 1.5 }}>
                {[
                    { label: 'Уст. время', val: fmtMin(plcData?.time_proc_set) },
                    {
                        label: 'До конца', val: fmtMin(plcData?.time_to_proc_end),
                        highlight: (plcData?.time_to_proc_end || 0) < 10 ? '#f0a500' : T.textPrimary
                    },
                    { label: 'Нагрев', val: fmtMin(plcData?.act_time_heat_acc) },
                    { label: 'Выдержка', val: fmtMin(plcData?.act_time_heat_wait) },
                ].map(({ label, val, highlight }) => (
                    <Grid item xs={3} key={label}>
                        <Metric label={label} value={val} size="sm" highlight={highlight} />
                    </Grid>
                ))}
            </Grid>

            <ProgressBar value={plcData?.act_time_total} max={plcData?.time_proc_set} />

            {/* ── Горелки (печи 3 и 4) */}
            {hasTwoSlots && (
                <>
                    <HRule />
                    <Typography sx={{
                        color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
                        fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1,
                    }}>
                        Горелка
                    </Typography>
                    <Grid container spacing={1}>
                        {[
                            { label: 'TE нижн.', value: fmtTemp(plcData?.burn1_te_lower) },
                            { label: 'TE верхн.', value: fmtTemp(plcData?.burn1_te_upper) },
                            { label: 'Возд., bar', value: fmtBar(plcData?.burn1_air_prs) },
                            { label: 'Газ, bar', value: fmtBar(plcData?.burn1_gas_prs) },
                        ].map(({ label, value }) => (
                            <Grid item xs={6} key={label}>
                                <Metric label={label} value={value} size="sm" />
                            </Grid>
                        ))}
                    </Grid>
                </>
            )}

            <HRule />

            {/* ── Программа нагрева */}
            <Box sx={{ mb: 1.5 }}>
                <Typography sx={{
                    color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5,
                }}>
                    Программа нагрева
                </Typography>
                <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.72rem', color: T.textSecondary, lineHeight: 1.6 }}>
                    T1={fmtTemp(plcData?.point_ref_1)} · t1={fmtMin(plcData?.point_time_1)} · Δt2={fmtMin(plcData?.point_dtime_2)}
                </Typography>
            </Box>

            {/* ── Кассеты в ПЛК */}
            <Box sx={{ mb: 1.5 }}>
                <Typography sx={{
                    color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5,
                }}>
                    Кассеты в ПЛК
                </Typography>
                {hasTwoSlots ? (
                    <Stack spacing={0.25}>
                        <CassetteLabel no={plcData?.cass1_no} day={plcData?.cass1_day} month={plcData?.cass1_month} year={plcData?.cass1_year} hour={plcData?.cass1_hour} />
                        <CassetteLabel no={plcData?.cass2_no} day={plcData?.cass2_day} month={plcData?.cass2_month} year={plcData?.cass2_year} hour={plcData?.cass2_hour} />
                    </Stack>
                ) : (
                    <CassetteLabel no={plcData?.cassette_no} day={plcData?.cass_day} month={plcData?.cass_month} year={plcData?.cass_year} hour={plcData?.cass_hour} />
                )}
            </Box>

            <HRule />

            {/* ── Управление кассетой */}
            <Box sx={{ mt: 'auto' }}>
                <Typography sx={{
                    color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1,
                }}>
                    Управление кассетой
                </Typography>

                <CassetteControl
                    furnaceNo={furnaceNo}
                    activeSession={activeSession}
                    availableCassettes={availableCassettes}
                    loading={loading}
                    onLoadClick={handleLoadClick}
                    onUnloadClick={handleUnloadClick}
                />
            </Box>

            {/* ── Время опроса */}
            <Typography sx={{
                color: T.textMuted, fontSize: '0.62rem', fontFamily: T.monoFont,
                textAlign: 'right', mt: 1.5, opacity: 0.7,
            }}>
                {plcData?.time ? formatTime(plcData.time) : ''}
            </Typography>

            {/* ── Диалог подтверждения */}
            <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { bgcolor: '#1a2330', border: `1px solid ${T.border}`, borderRadius: 2 } }}
            >
                <DialogTitle sx={{ color: T.textPrimary, fontFamily: T.sansFont, fontSize: '0.95rem', fontWeight: 600 }}>
                    {actionType === 'load' ? 'Подтверждение загрузки' : 'Подтверждение выгрузки'}
                </DialogTitle>
                <DialogContent dividers sx={{ borderColor: T.borderSoft }}>
                    <Typography variant="body2" sx={{ color: T.textSecondary, fontFamily: T.sansFont, fontSize: '0.85rem' }}>
                        {actionType === 'load'
                            ? `Загрузить кассету №${pendingCassette} в печь №${furnaceNo}?`
                            : `Выгрузить кассету ${activeSession?.cassetteId} из печи №${furnaceNo}?`}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 2, py: 1.5 }}>
                    <Button onClick={() => setOpenConfirm(false)} sx={{ color: T.textSecondary, fontSize: '0.8rem' }}>
                        Отмена
                    </Button>
                    <Button
                        onClick={confirmAction}
                        variant="contained"
                        sx={{
                            bgcolor: actionType === 'load' ? T.accent : T.danger,
                            color: '#0d1117', fontWeight: 700, fontSize: '0.8rem',
                            '&:hover': { bgcolor: actionType === 'load' ? '#79c0ff' : '#ff6b6b' },
                        }}
                    >
                        Подтвердить
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}

// ─── Основная страница ────────────────────────────────────────────────────────
export default function TemperingHMI() {
    const [plcDataList, setPlcDataList] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [availableCassettes, setAvailableCassettes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const showMessage = (msg, severity = 'success') => {
        setSnackbar({ open: true, message: msg, severity });
        setTimeout(() => setSnackbar(p => ({ ...p, open: false })), 5000);
    };

    const loadPlcData = useCallback(async () => {
        try {
            const r = await api.get('/tempering/current');
            setPlcDataList(r.data);
        } catch {
            setError('Ошибка соединения с PLC');
        }
    }, []);

    const loadActiveSessions = useCallback(async () => {
        try {
            const r = await api.get('/tempering/active-sessions');
            setActiveSessions(r.data);
        } catch { /* silent */ }
    }, []);

    const loadReadyCassettes = useCallback(async () => {
        try {
            const [casR, sesR] = await Promise.all([
                api.get('/cassette'),
                api.get('/tempering/active-sessions'),
            ]);
            const activeCasIds = sesR.data.map(s => s.cassetteId);
            const ready = casR.data.filter(c => c.status === 'Готова к отправке' && !activeCasIds.includes(c.cassetteId));
            const withSheets = await Promise.all(ready.map(async (c) => {
                try {
                    const sr = await api.get(`/cassette/${c.cassetteId}/sheets`);
                    return {
                        cassetteId: c.cassetteId,
                        cassetteNumber: parseInt(c.cassetteId.substring(3)),
                        status: c.status,
                        sheetsCount: sr.data.length,
                        totalWeight: sr.data.reduce((s, x) => s + (x.actualNetWeightKg || 0), 0),
                    };
                } catch {
                    return { cassetteId: c.cassetteId, cassetteNumber: parseInt(c.cassetteId.substring(3)), status: c.status, sheetsCount: 0, totalWeight: 0 };
                }
            }));
            setAvailableCassettes(withSheets);
        } catch { /* silent */ }
    }, []);

    const loadAllData = useCallback(async () => {
        setRefreshing(true);
        try { await Promise.all([loadPlcData(), loadActiveSessions()]); }
        catch { /* silent */ }
        finally { setLoading(false); setRefreshing(false); }
    }, [loadPlcData, loadActiveSessions]);

    useEffect(() => { if (!loading) loadReadyCassettes(); }, [activeSessions, loading, loadReadyCassettes]);

    useEffect(() => {
        loadAllData();
        const iv = setInterval(loadAllData, 5000);
        return () => clearInterval(iv);
    }, [loadAllData]);

    const handleLoadCassette = async (furnaceNo, cassetteNumber) => {
        try {
            await api.post('/tempering/load', { furnaceNo, cassetteNumber });
            showMessage(`Кассета CAS${String(cassetteNumber).padStart(7, '0')} → Печь №${furnaceNo}`, 'success');
            await loadAllData();
        } catch (err) {
            showMessage(err.response?.data?.message || 'Ошибка при загрузке кассеты', 'error');
            throw err;
        }
    };

    const handleUnloadCassette = async (furnaceNo) => {
        try {
            await api.post('/tempering/unload', { furnaceNo });
            showMessage(`Кассета выгружена из печи №${furnaceNo}`, 'success');
            await loadAllData();
        } catch (err) {
            showMessage(err.response?.data?.message || 'Ошибка при выгрузке кассеты', 'error');
            throw err;
        }
    };

    const getActiveSession = (n) => activeSessions.find(s => s.furnaceNumber === n);
    const getPlcData = (n) => plcDataList.find(f => f.furnace_no === n);

    return (
        <Box sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: T.bg, minHeight: '100vh' }}>

            {/* ── Шапка */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <LocalFireDepartmentIcon sx={{ color: T.accent, fontSize: '1.1rem' }} />
                    <Typography sx={{
                        color: T.textPrimary, fontWeight: 700,
                        fontSize: '1rem', letterSpacing: '0.08em',
                        textTransform: 'uppercase', fontFamily: T.sansFont,
                    }}>
                        Печи отпуска
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={0.5} alignItems="center">
                    {(loading || refreshing) && <CircularProgress size={14} sx={{ color: T.accent }} />}
                    <Tooltip title="Обновить">
                        <IconButton size="small" onClick={loadAllData} disabled={refreshing}
                            sx={{ color: T.textSecondary, '&:hover': { color: T.accent } }}>
                            <RefreshIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Печать">
                        <IconButton size="small" onClick={() => window.print()}
                            sx={{ color: T.textSecondary, '&:hover': { color: T.accent } }}>
                            <PrintIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>

            {/* ── Ошибка */}
            {error && (
                <Alert severity="error" sx={{ mb: 2, bgcolor: '#2d1515', color: T.danger }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* ── Карточки */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 2,
                '@media (max-width:1100px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
                '@media (max-width:600px)': { gridTemplateColumns: '1fr' },
            }}>
                {FURNACES.map(no => (
                    <FurnaceCard
                        key={no}
                        furnaceNo={no}
                        plcData={getPlcData(no)}
                        activeSession={getActiveSession(no)}
                        availableCassettes={availableCassettes}
                        onLoad={handleLoadCassette}
                        onUnload={handleUnloadCassette}
                    />
                ))}
            </Box>

            {/* ── Панель доступных кассет */}
            <Paper elevation={0} sx={{
                mt: 2.5, p: 2,
                bgcolor: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 2,
            }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography sx={{
                        color: T.textSecondary, fontSize: '0.7rem', fontFamily: T.sansFont,
                        fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                        Доступные кассеты
                    </Typography>
                    <Typography sx={{ color: T.textMuted, fontSize: '0.65rem', fontFamily: T.monoFont }}>
                        {availableCassettes.length} шт.
                    </Typography>
                </Stack>

                {availableCassettes.length === 0 ? (
                    <Typography sx={{ color: T.textMuted, fontSize: '0.78rem', fontFamily: T.sansFont }}>
                        Нет кассет, готовых к отправке.
                    </Typography>
                ) : (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {availableCassettes.map(c => (
                            <Chip
                                key={c.cassetteId}
                                label={
                                    <Stack direction="row" spacing={0.75} alignItems="baseline">
                                        <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.72rem', fontWeight: 700, color: T.accent }}>
                                            {c.cassetteId}
                                        </Typography>
                                        <Typography sx={{ fontFamily: T.sansFont, fontSize: '0.65rem', color: T.textSecondary }}>
                                            {c.sheetsCount} л · {c.totalWeight} кг
                                        </Typography>
                                    </Stack>
                                }
                                size="small"
                                sx={{
                                    bgcolor: T.surfaceAlt,
                                    border: `1px solid ${T.border}`,
                                    height: 28,
                                    '& .MuiChip-label': { px: 1 },
                                }}
                            />
                        ))}
                    </Box>
                )}
            </Paper>

            {/* ── Уведомление */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={5000}
                onClose={() => setSnackbar(p => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar(p => ({ ...p, open: false }))}
                    sx={{
                        fontFamily: T.sansFont,
                        fontSize: '0.82rem',
                        bgcolor: snackbar.severity === 'success' ? '#0f2a1a' : '#2d1515',
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}