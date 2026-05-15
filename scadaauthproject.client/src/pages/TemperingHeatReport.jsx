// src/pages/TemperingHeatReport.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Grid, Paper, Typography, Stack, Chip, Button,
    CircularProgress, Divider, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TextField, MenuItem,
    FormControl, InputLabel, Select, Alert, Tab, Tabs,
    Card, CardContent, IconButton, Tooltip
} from '@mui/material';
import {
    Download as DownloadIcon,
    History as HistoryIcon,
    ShowChart as ChartIcon,
    TableChart as TableIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { furnaceApi } from '../api/furnaceApi';
import {
    LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip as RechartsTooltip, Legend,
    ResponsiveContainer, ReferenceLine
} from 'recharts';

const fmtTemp = (v) => v != null ? `${Number(v).toFixed(1)}°C` : '—';
const fmtMin = (v) => v != null ? `${Number(v).toFixed(0)} мин` : '—';
const fmtDateTime = (v) => v ? new Date(v).toLocaleString('ru-RU') : '—';

function TabPanel({ children, value, index }) {
    return (
        <div role="tabpanel" hidden={value !== index} style={{ paddingTop: 16 }}>
            {value === index && children}
        </div>
    );
}

function SessionCard({ session, onClick }) {
    // Поля из DTO: cassetteNo, cass1No, cass2No и т.д.
    const isDouble = session.cass1No && session.cass1No > 0;
    const cassetteInfo = isDouble 
        ? `Кассеты: ${session.cass1No} / ${session.cass2No}`
        : `Кассета: ${session.cassetteNo || '—'}`;
    
    return (
        <Card 
            sx={{ mb: 1, cursor: 'pointer', '&:hover': { bgcolor: '#1a2a3a' }, bgcolor: '#1e1e1e' }}
            onClick={() => onClick(session.id)}   // передаём id сессии
        >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="body2" color="primary" sx={{ fontFamily: 'monospace' }}>
                            {fmtDateTime(session.startedAt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {cassetteInfo}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {fmtTemp(session.tempAvg)} ∅
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: session.tempMax > session.targetTemp ? '#ffa726' : '#81c784' }}>
                            ↑ {fmtTemp(session.tempMax)}
                        </Typography>
                        <Chip 
                            label={fmtMin(session.targetTime)} 
                            size="small" 
                            variant="outlined"
                        />
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

export default function TemperingHeatReport() {
    const [furnaceNo, setFurnaceNo] = useState(1);
    const [fromDate, setFromDate] = useState(new Date(Date.now() - 7 * 24 * 3600 * 1000));
    const [toDate, setToDate] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [detailsData, setDetailsData] = useState([]);
    const [tabValue, setTabValue] = useState(0);
    const [error, setError] = useState(null);

    const loadSessions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Используем новый метод с пагинацией (пока page=1, pageSize=100)
            const result = await furnaceApi.getTemperingSessions({
                furnaceNo,
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
                page: 1,
                pageSize: 100
            });
            // result = { items, total, page, pageSize }
            setSessions(result.items || []);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [furnaceNo, fromDate, toDate]);

    const loadSessionDetails = useCallback(async (sessionId) => {
        setLoading(true);
        try {
            const data = await furnaceApi.getTemperingSessionById(sessionId);
            // data = { session, details }
            setSelectedSession(data.session);
            setDetailsData(data.details || []);
            setTabValue(1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleExportCSV = (data, filename) => {
        if (!data.length) return;
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const chartData = detailsData.map(d => ({
        time: new Date(d.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        temp_act: d.tempAct,
        temp_ref: d.tempRef,
        t1: d.t1,
        t2: d.t2,
        t_average_furn: d.tAverageFurn,
        act_time_total: d.actTimeTotal,
        progress: d.actTimeTotal && selectedSession?.targetTime ? (d.actTimeTotal / selectedSession.targetTime) * 100 : 0
    }));

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
            <Box sx={{ p: 3, bgcolor: '#0f1419', minHeight: '100vh' }}>
                <Typography variant="h5" sx={{ color: '#64b5f6', fontWeight: 600, mb: 2 }}>
                    ОТЧЁТ ПО НАГРЕВУ ОТПУСКНЫХ ПЕЧЕЙ
                </Typography>

                {/* Фильтры */}
                <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1e23' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Печь</InputLabel>
                                <Select value={furnaceNo} label="Печь" onChange={(e) => setFurnaceNo(e.target.value)}>
                                    <MenuItem value={1}>Печь №1</MenuItem>
                                    <MenuItem value={2}>Печь №2</MenuItem>
                                    <MenuItem value={3}>Печь №3</MenuItem>
                                    <MenuItem value={4}>Печь №4</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <DatePicker
                                label="Дата от"
                                value={fromDate}
                                onChange={setFromDate}
                                slotProps={{ textField: { size: 'small', fullWidth: true } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <DatePicker
                                label="Дата до"
                                value={toDate}
                                onChange={setToDate}
                                slotProps={{ textField: { size: 'small', fullWidth: true } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <Button 
                                variant="contained" 
                                onClick={loadSessions}
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={20} /> : <HistoryIcon />}
                                fullWidth
                            >
                                Показать
                            </Button>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <Button 
                                variant="outlined" 
                                onClick={() => handleExportCSV(sessions, `tempering_f${furnaceNo}_sessions`)}
                                disabled={!sessions.length}
                                startIcon={<DownloadIcon />}
                                fullWidth
                            >
                                Экспорт
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={2}>
                    {/* Левая колонка - список сессий */}
                    <Grid item xs={12} md={selectedSession ? 4 : 12}>
                        <Paper sx={{ p: 2, bgcolor: '#1a1e23', height: 'calc(100vh - 280px)', overflow: 'auto' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    Циклы нагрева
                                </Typography>
                                <Chip label={`${sessions.length} циклов`} size="small" />
                            </Stack>
                            <Divider sx={{ mb: 2 }} />
                            {loading && !sessions.length ? (
                                <Box display="flex" justifyContent="center" py={4}>
                                    <CircularProgress size={32} />
                                </Box>
                            ) : sessions.length === 0 ? (
                                <Typography color="text.secondary" textAlign="center" py={4}>
                                    Нет данных за выбранный период
                                </Typography>
                            ) : (
                                sessions.map((s) => (
                                    <SessionCard 
                                        key={s.id} 
                                        session={s} 
                                        onClick={loadSessionDetails}
                                    />
                                ))
                            )}
                        </Paper>
                    </Grid>

                    {/* Правая колонка - детали сессии */}
                    {selectedSession && (
                        <Grid item xs={12} md={8}>
                            <Paper sx={{ p: 2, bgcolor: '#1a1e23', height: 'calc(100vh - 280px)', overflow: 'auto' }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        Детали цикла от {fmtDateTime(selectedSession.startedAt)}
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        <Tooltip title="Экспорт CSV">
                                            <IconButton size="small" onClick={() => handleExportCSV(detailsData, `tempering_f${furnaceNo}_details`)}>
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Закрыть">
                                            <IconButton size="small" onClick={() => setSelectedSession(null)}>
                                                ✕
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Stack>

                                {/* Сводка по сессии */}
                                <Grid container spacing={1} sx={{ mb: 2 }}>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" color="text.secondary">Целевая T</Typography>
                                        <Typography variant="body2" fontFamily="monospace">{fmtTemp(selectedSession.targetTemp)}</Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" color="text.secondary">Средняя T</Typography>
                                        <Typography variant="body2" fontFamily="monospace">{fmtTemp(selectedSession.tempAvg)}</Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" color="text.secondary">Макс. T</Typography>
                                        <Typography variant="body2" fontFamily="monospace" color="#ffa726">{fmtTemp(selectedSession.tempMax)}</Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" color="text.secondary">Время цикла</Typography>
                                        <Typography variant="body2" fontFamily="monospace">{fmtMin(selectedSession.targetTime)}</Typography>
                                    </Grid>
                                </Grid>

                                <Divider sx={{ mb: 2 }} />

                                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
                                    <Tab icon={<ChartIcon />} label="График" />
                                    <Tab icon={<TableIcon />} label="Таблица" />
                                </Tabs>

                                <TabPanel value={tabValue} index={0}>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3540" />
                                            <XAxis dataKey="time" stroke="#8a99a8" fontSize={10} interval="preserveStartEnd" />
                                            <YAxis yAxisId="temp" label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#8a99a8' }} stroke="#8a99a8" />
                                            <YAxis yAxisId="progress" orientation="right" label={{ value: '%', angle: 90, position: 'insideRight', fill: '#8a99a8' }} stroke="#8a99a8" />
                                            <RechartsTooltip contentStyle={{ backgroundColor: '#1a1e23', borderColor: '#37474f' }} />
                                            <Legend />
                                            <ReferenceLine y={selectedSession.targetTemp} stroke="#64b5f6" strokeDasharray="3 3" yAxisId="temp" label="Цель" />
                                            <Line yAxisId="temp" type="monotone" dataKey="temp_act" stroke="#ffa726" strokeWidth={2} dot={false} name="Температура факт" />
                                            <Line yAxisId="temp" type="monotone" dataKey="temp_ref" stroke="#42a5f5" strokeWidth={1.5} dot={false} name="Задание" strokeDasharray="4 4" />
                                            <Line yAxisId="progress" type="monotone" dataKey="progress" stroke="#66bb6a" strokeWidth={1.5} dot={false} name="Прогресс" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </TabPanel>

                                <TabPanel value={tabValue} index={1}>
                                    <TableContainer sx={{ maxHeight: 400 }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Время</TableCell>
                                                    <TableCell align="right">T факт</TableCell>
                                                    <TableCell align="right">T зад</TableCell>
                                                    <TableCell align="right">T1</TableCell>
                                                    <TableCell align="right">T2</TableCell>
                                                    <TableCell align="right">Прогресс</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {detailsData.map((row, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                                            {new Date(row.time).toLocaleTimeString('ru-RU')}
                                                        </TableCell>
                                                        <TableCell align="right">{fmtTemp(row.tempAct)}</TableCell>
                                                        <TableCell align="right">{fmtTemp(row.tempRef)}</TableCell>
                                                        <TableCell align="right">{fmtTemp(row.t1)}</TableCell>
                                                        <TableCell align="right">{fmtTemp(row.t2)}</TableCell>
                                                        <TableCell align="right">
                                                            {row.actTimeTotal && selectedSession?.targetTime 
                                                                ? ((row.actTimeTotal / selectedSession.targetTime) * 100).toFixed(0) 
                                                                : 0}%
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </TabPanel>
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            </Box>
        </LocalizationProvider>
    );
}