// src/pages/TemperingHMI.jsx - улучшенная версия

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Grid, Paper, Typography, Stack, Chip,
    CircularProgress, LinearProgress, Divider,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import { furnaceApi } from '../api/furnaceApi';

const fmtTemp = (v) => v != null ? `${Number(v).toFixed(1)}°C` : '—';
const fmtMin = (v) => v != null ? `${Number(v).toFixed(0)} мин` : '—';

function StatusChip({ run, end, fault }) {
    if (fault) return <Chip icon={<ErrorIcon />} label="АВАРИЯ" color="error" size="small" sx={{ fontWeight: 500 }} />;
    if (run) return <Chip icon={<LocalFireDepartmentIcon />} label="РАБОТАЕТ" color="warning" size="small" sx={{ fontWeight: 500 }} />;
    if (end) return <Chip icon={<CheckCircleIcon />} label="ГОТОВО" color="success" size="small" sx={{ fontWeight: 500 }} />;
    return <Chip icon={<PauseCircleIcon />} label="СТОП" color="default" size="small" sx={{ fontWeight: 500 }} />;
}

function ProgressBar({ value, max }) {
    if (!max || value == null) return null;
    const pct = Math.min((value / max) * 100, 100);
    return (
        <Box sx={{ mt: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#9aa9b7', fontSize: '0.7rem' }}>Прогресс</Typography>
                <Typography variant="caption" sx={{ color: '#9aa9b7', fontSize: '0.7rem' }}>{pct.toFixed(0)}%</Typography>
            </Stack>
            <LinearProgress
                variant="determinate" value={pct}
                color={pct > 90 ? 'success' : 'primary'}
                sx={{ height: 4, borderRadius: 2 }}
            />
        </Box>
    );
}

function CassetteLabel({ label, no, day, month, year, hour }) {
    if (!no && !day) return <Typography variant="body2" sx={{ color: '#6b7a86', fontSize: '0.75rem' }}>—</Typography>;
    const hourStr = hour != null && hour !== 99 ? `${hour}ч` : '';
    const dateStr = day && month && year ? `${day}.${String(month).padStart(2, '0')}.${year}` : '';
    const parts = [dateStr, hourStr, no ? `№${no}` : ''].filter(Boolean);
    return (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#bdc4cc' }}>
            {parts.join(' / ')}
        </Typography>
    );
}

function FurnaceCard({ data }) {
    if (!data) return (
        <Paper sx={{ p: 2, bgcolor: '#1a2630', borderRadius: 2 }}>
            <Typography sx={{ color: '#6b7a86', textAlign: 'center' }}>Нет данных</Typography>
        </Paper>
    );

    const n = data.furnace_no;
    const hasBurner = n === 3 || n === 4;
    const hasTwoSlots = n === 3 || n === 4;

    const bgColor = data.proc_fault ? '#3d1f1f'
        : data.proc_run ? '#1a2a1f'
        : data.proc_end ? '#1a2535'
        : '#1a1e23';

    const borderColor = data.proc_fault ? '#e57373'
        : data.proc_run ? '#66bb6a'
        : data.proc_end ? '#42a5f5'
        : '#37474f';

    return (
        <Paper
            elevation={2}
            sx={{
                bgcolor: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 2.5,
                p: 2.5,
                transition: 'all 0.2s',
            }}
        >
            {/* Заголовок */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography sx={{ color: '#e8edf2', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.3px' }}>
                    Печь отпуска №{n}
                </Typography>
                <StatusChip run={data.proc_run} end={data.proc_end} fault={data.proc_fault} />
            </Stack>

            <Divider sx={{ borderColor: '#2a3540', mb: 1.5 }} />

            {/* Основные температуры */}
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>Факт</Typography>
                    <Typography
                        sx={{
                            fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.2,
                            color: data.proc_fault ? '#e57373' : data.proc_run ? '#ffb74d' : '#e8edf2',
                        }}
                    >
                        {fmtTemp(data.temp_act)}
                    </Typography>
                </Grid>
                <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>Задание</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.2, color: '#64b5f6' }}>
                        {fmtTemp(data.temp_ref)}
                    </Typography>
                </Grid>
            </Grid>

            {/* Доп. температуры */}
            <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                    <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>T1</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#bdc4cc' }}>{fmtTemp(data.t1)}</Typography>
                </Box>
                <Box>
                    <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>T2</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#bdc4cc' }}>{fmtTemp(data.t2)}</Typography>
                </Box>
                {data.t_average_furn != null && (
                    <Box>
                        <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>Ср. по печи</Typography>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#bdc4cc' }}>{fmtTemp(data.t_average_furn)}</Typography>
                    </Box>
                )}
            </Stack>

            {/* Таймеры в строку */}
            <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid item xs={3}>
                    <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem', display: 'block' }}>Уст. время</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#e8edf2' }}>{fmtMin(data.time_proc_set)}</Typography>
                </Grid>
                <Grid item xs={3}>
                    <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem', display: 'block' }}>До конца</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: data.time_to_proc_end < 10 ? '#ffb74d' : '#e8edf2', fontWeight: data.time_to_proc_end < 10 ? 600 : 400 }}>
                        {fmtMin(data.time_to_proc_end)}
                    </Typography>
                </Grid>
                <Grid item xs={3}>
                    <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem', display: 'block' }}>Нагрев</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#bdc4cc' }}>{fmtMin(data.act_time_heat_acc)}</Typography>
                </Grid>
                <Grid item xs={3}>
                    <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem', display: 'block' }}>Выдержка</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#bdc4cc' }}>{fmtMin(data.act_time_heat_wait)}</Typography>
                </Grid>
            </Grid>

            <ProgressBar value={data.act_time_total} max={data.time_proc_set} />

            {/* Горелки (для 3 и 4) */}
            {hasBurner && (
                <>
                    <Divider sx={{ borderColor: '#2a3540', my: 1.5 }} />
                    <Grid container spacing={1}>
                        <Grid item xs={6}>
                            <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>TE нижн.</Typography>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#bdc4cc' }}>{fmtTemp(data.burn1_te_lower)}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>TE верхн.</Typography>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#bdc4cc' }}>{fmtTemp(data.burn1_te_upper)}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>Давл. возд.</Typography>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#bdc4cc' }}>
                                {data.burn1_air_prs != null ? `${Number(data.burn1_air_prs).toFixed(3)} bar` : '—'}
                            </Typography>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem' }}>Давл. газа</Typography>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#bdc4cc' }}>
                                {data.burn1_gas_prs != null ? `${Number(data.burn1_gas_prs).toFixed(3)} bar` : '—'}
                            </Typography>
                        </Grid>
                    </Grid>
                </>
            )}

            <Divider sx={{ borderColor: '#2a3540', my: 1.5 }} />

            {/* Программа */}
            <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
                    Программа нагрева
                </Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9aa9b7' }}>
                    T1={fmtTemp(data.point_ref_1)} / t1={fmtMin(data.point_time_1)} / dt2={fmtMin(data.point_dtime_2)}
                </Typography>
            </Box>

            {/* Кассеты */}
            <Box>
                <Typography variant="caption" sx={{ color: '#8a99a8', fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
                    Кассеты
                </Typography>
                {hasTwoSlots ? (
                    <Stack spacing={0.5}>
                        <CassetteLabel label="Кассета 1"
                            no={data.cass1_no} day={data.cass1_day} month={data.cass1_month}
                            year={data.cass1_year} hour={data.cass1_hour} />
                        <CassetteLabel label="Кассета 2"
                            no={data.cass2_no} day={data.cass2_day} month={data.cass2_month}
                            year={data.cass2_year} hour={data.cass2_hour} />
                    </Stack>
                ) : (
                    <CassetteLabel label=""
                        no={data.cassette_no} day={data.cass_day} month={data.cass_month}
                        year={data.cass_year} hour={data.cass_hour} />
                )}
            </Box>

            <Typography variant="caption" sx={{ color: '#5a6874', fontSize: '0.6rem', display: 'block', mt: 1.5, textAlign: 'right' }}>
                {data.time ? new Date(data.time).toLocaleTimeString('ru-RU') : ''}
            </Typography>
        </Paper>
    );
}

export default function TemperingHMI() {
    const [furnaces, setFurnaces] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await furnaceApi.getTemperingCurrent();
            setFurnaces(data);
        } catch (err) {
            console.error('Ошибка загрузки:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, [load]);

    const getByNo = (n) => furnaces.find(f => f.furnace_no === n) ?? null;

    return (
        <Box sx={{ p: 3, bgcolor: '#0f1419', minHeight: '100vh' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                <Typography sx={{ color: '#64b5f6', fontWeight: 600, fontSize: '1.25rem', letterSpacing: '0.5px' }}>
                    ПЕЧИ ОТПУСКА
                </Typography>
                {loading && <CircularProgress size={18} sx={{ color: '#64b5f6' }} />}
            </Stack>

            {/* Карточки в один ряд - горизонтальный скролл на маленьких экранах */}
            <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
                {[1, 2, 3, 4].map(n => (
                    <Box key={n} sx={{ minWidth: { xs: '280px', sm: '320px', md: '340px' }, maxWidth: '360px', flex: '1 1 auto' }}>
                        <FurnaceCard data={getByNo(n)} />
                    </Box>
                ))}
            </Box>
        </Box>
    );
}