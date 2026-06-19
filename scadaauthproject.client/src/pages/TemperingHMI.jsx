// src/pages/TemperingHMI.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Grid, Paper, Typography, Stack, Chip,
  CircularProgress, Divider, Button, FormControl, InputLabel,
  Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
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
  Stop as StopIcon,
  SignalCellularAlt as SignalIcon
} from '@mui/icons-material';
import api from '../api';
import { useAuth } from  '../context/AuthContext';
import { useOpcUa } from '../hooks/useOpcUa';

// ─── Константы ────────────────────────────────────────────────────────────────
const FURNACES = [1, 2, 3, 4];
const DUAL_SLOT_FURNACES = [3, 4];


// ─── Алиасы OPC UA для всех печей ─────────────────────────────────────────────
const OPC_ALIASES = [
  // Печь 1
  'RelFurn12.RelFurn1.TempAct', 'RelFurn12.RelFurn1.TempRef',
  'RelFurn12.RelFurn1.T1', 'RelFurn12.RelFurn1.T2', 'RelFurn12.RelFurn1.T_Average_Furn',
  'RelFurn12.RelFurn1.TimeProcSet', 'RelFurn12.RelFurn1.TimeToProcEnd',
  'RelFurn12.RelFurn1.ActTimeHeatAcc', 'RelFurn12.RelFurn1.ActTimeHeatWait', 'RelFurn12.RelFurn1.ActTimeTotal',
  'RelFurn12.RelFurn1.ProcFault', 'RelFurn12.RelFurn1.ProcRun', 'RelFurn12.RelFurn1.ProcEnd',
  'RelFurn12.RelFurn1.PointRef_1', 'RelFurn12.RelFurn1.PointTime_1', 'RelFurn12.RelFurn1.PointDTime_2',
  'RelFurn12.RelFurn1.CaasetteNo', 'RelFurn12.RelFurn1.Day', 'RelFurn12.RelFurn1.Month',
  'RelFurn12.RelFurn1.Year', 'RelFurn12.RelFurn1.Hour',
  // Печь 2
  'RelFurn12.RelFurn2.TempAct', 'RelFurn12.RelFurn2.TempRef',
  'RelFurn12.RelFurn2.T1', 'RelFurn12.RelFurn2.T2', 'RelFurn12.RelFurn2.T_Average_Furn',
  'RelFurn12.RelFurn2.TimeProcSet', 'RelFurn12.RelFurn2.TimeToProcEnd',
  'RelFurn12.RelFurn2.ActTimeHeatAcc', 'RelFurn12.RelFurn2.ActTimeHeatWait', 'RelFurn12.RelFurn2.ActTimeTotal',
  'RelFurn12.RelFurn2.ProcFault', 'RelFurn12.RelFurn2.ProcRun', 'RelFurn12.RelFurn2.ProcEnd',
  'RelFurn12.RelFurn2.PointRef_1', 'RelFurn12.RelFurn2.PointTime_1', 'RelFurn12.RelFurn2.PointDTime_2',
  'RelFurn12.RelFurn2.CaasetteNo', 'RelFurn12.RelFurn2.Day', 'RelFurn12.RelFurn2.Month',
  'RelFurn12.RelFurn2.Year', 'RelFurn12.RelFurn2.Hour',
  // Печь 3
  'RelFurn3.TempAct', 'RelFurn3.TempRef', 'RelFurn3.TactBurn1', 'RelFurn3.TactBurn2',
  'RelFurn3.ActTimeHeatAcc', 'RelFurn3.ActTimeHeatWait', 'RelFurn3.ActTimeTotal',
  'RelFurn3.ProcFault', 'RelFurn3.ProcRun', 'RelFurn3.ProcEnd',
  'RelFurn3.TimeProcSet', 'RelFurn3.TimeToProcEnd',
  'RelFurn3.PointRef_1', 'RelFurn3.PointTime_1', 'RelFurn3.PointDTime_2',
  'RelFurn3.Cassette1_CaasetteNo1', 'RelFurn3.Cassette1_Day', 'RelFurn3.Cassette1_Month',
  'RelFurn3.Cassette1_Year', 'RelFurn3.Cassette1_Hour',
  'RelFurn3.Cassette2_CaasetteNo2', 'RelFurn3.Cassette2_Day', 'RelFurn3.Cassette2_Month',
  'RelFurn3.Cassette2_Year', 'RelFurn3.Cassette2_Hour',
  'RelFurn3.Burn1_AI.TE_Lower', 'RelFurn3.Burn1_AI.TE_Upper',
  'RelFurn3.Burn1_AI.AirPrs', 'RelFurn3.Burn1_AI.GasPrs',
  // Печь 4
  'RelFurn4.TempAct', 'RelFurn4.TempRef', 'RelFurn4.TactBurn1', 'RelFurn4.TactBurn2',
  'RelFurn4.ActTimeHeatAcc', 'RelFurn4.ActTimeHeatWait', 'RelFurn4.ActTimeTotal',
  'RelFurn4.ProcFault', 'RelFurn4.ProcRun', 'RelFurn4.ProcEnd',
  'RelFurn4.TimeProcSet', 'RelFurn4.TimeToProcEnd',
  'RelFurn4.PointRef_1', 'RelFurn4.PointTime_1', 'RelFurn4.PointDTime_2',
  'RelFurn4.Cassette1_CaasetteNo1', 'RelFurn4.Cassette1_Day', 'RelFurn4.Cassette1_Month',
  'RelFurn4.Cassette1_Year', 'RelFurn4.Cassette1_Hour',
  'RelFurn4.Cassette2_CaasetteNo2', 'RelFurn4.Cassette2_Day', 'RelFurn4.Cassette2_Month',
  'RelFurn4.Cassette2_Year', 'RelFurn4.Cassette2_Hour',
  'RelFurn4.Burn1_AI.TE_Lower', 'RelFurn4.Burn1_AI.TE_Upper',
  'RelFurn4.Burn1_AI.AirPrs', 'RelFurn4.Burn1_AI.GasPrs',
];

// ─── Тема ─────────────────────────────────────────────────────────────────────
const T = {
  bg: '#0d1117', surface: '#161b22', surfaceAlt: '#1c2330',
  border: '#30363d', borderSoft: '#21262d',
  textPrimary: '#e6edf3', textSecondary: '#8b949e', textMuted: '#484f58',
  accent: '#58a6ff', success: '#3fb950', warning: '#d29922', danger: '#f85149',
  monoFont: "'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace",
  sansFont: "'Inter', 'Roboto', sans-serif",
};

// ─── Безопасное извлечение значения из OPC UA ─────────────────────────────────
const extractValue = (entry) => {
  if (entry == null) return null;
  if (typeof entry !== 'object') return entry;
  if ('value' in entry) return entry.value;
  if ('Body' in entry) return entry.Body;
  if (Array.isArray(entry) && entry.length > 0) return entry[0];
  return entry;
};

const toBool = (v) => {
  const val = extractValue(v);
  if (val == null) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return Boolean(val);
};

const toNumber = (v) => {
  const val = extractValue(v);
  if (val == null) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};



// ─── Форматирование ───────────────────────────────────────────────────────────
const fmtTemp = (v) => v != null ? `${Number(v).toFixed(1)}°` : '—';
const fmtMin = (v) => v != null ? `${Number(v).toFixed(0)} мин` : '—';
const fmtBar = (v) => v != null ? `${Number(v).toFixed(3)}` : '—';
const formatTime = (dt) => dt ? new Date(dt).toLocaleTimeString('ru-RU') : '';
const formatDateTime = (dt) => dt ? new Date(dt).toLocaleString('ru-RU') : '—';

// ─── Преобразование OPC UA значений ──────────────────────────────────────────
const transformOpcToPlcData = (values, furnaceNo) => {
  let prefix;
  if (furnaceNo === 1) prefix = 'RelFurn12.RelFurn1';
  else if (furnaceNo === 2) prefix = 'RelFurn12.RelFurn2';
  else prefix = `RelFurn${furnaceNo}`;

  const getVal = (tag) => extractValue(values[`${prefix}.${tag}`]);

  const data = {
    furnace_no: furnaceNo,
    time: new Date().toISOString(),
    temp_act: toNumber(getVal('TempAct')),
    temp_ref: toNumber(getVal('TempRef')),
    t1: furnaceNo <= 2 ? toNumber(getVal('T1')) : toNumber(getVal('TactBurn1')),
    t2: furnaceNo <= 2 ? toNumber(getVal('T2')) : toNumber(getVal('TactBurn2')),
    t_average_furn: toNumber(getVal('T_Average_Furn')),
    time_proc_set: toNumber(getVal('TimeProcSet')),
    time_to_proc_end: toNumber(getVal('TimeToProcEnd')),
    act_time_heat_acc: toNumber(getVal('ActTimeHeatAcc')),
    act_time_heat_wait: toNumber(getVal('ActTimeHeatWait')),
    act_time_total: toNumber(getVal('ActTimeTotal')),
    proc_fault: toBool(getVal('ProcFault')),
    proc_run: toBool(getVal('ProcRun')),
    proc_end: toBool(getVal('ProcEnd')),
    point_ref_1: toNumber(getVal('PointRef_1')),
    point_time_1: toNumber(getVal('PointTime_1')),
    point_dtime_2: toNumber(getVal('PointDTime_2')),
  };

  if (furnaceNo <= 2) {
    data.cassette_no = toNumber(getVal('CaasetteNo'));
    data.cass_day = toNumber(getVal('Day'));
    data.cass_month = toNumber(getVal('Month'));
    data.cass_year = toNumber(getVal('Year'));
    data.cass_hour = toNumber(getVal('Hour'));
  } else {
    data.cass1_no = toNumber(getVal('Cassette1_CaasetteNo1'));
    data.cass1_day = toNumber(getVal('Cassette1_Day'));
    data.cass1_month = toNumber(getVal('Cassette1_Month'));
    data.cass1_year = toNumber(getVal('Cassette1_Year'));
    data.cass1_hour = toNumber(getVal('Cassette1_Hour'));
    data.cass2_no = toNumber(getVal('Cassette2_CaasetteNo2'));
    data.cass2_day = toNumber(getVal('Cassette2_Day'));
    data.cass2_month = toNumber(getVal('Cassette2_Month'));
    data.cass2_year = toNumber(getVal('Cassette2_Year'));
    data.cass2_hour = toNumber(getVal('Cassette2_Hour'));
    data.burn1_te_lower = toNumber(getVal('Burn1_AI.TE_Lower'));
    data.burn1_te_upper = toNumber(getVal('Burn1_AI.TE_Upper'));
    data.burn1_air_prs = toNumber(getVal('Burn1_AI.AirPrs'));
    data.burn1_gas_prs = toNumber(getVal('Burn1_AI.GasPrs'));
  }

  return data;
};

// ─── Компоненты UI ────────────────────────────────────────────────────────────

function StatusChip({ run, end, fault }) {
  const styles = {
    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', height: 24, fontFamily: T.sansFont,
  };
  if (fault) return <Chip icon={<ErrorIcon sx={{ fontSize: '0.85rem !important' }} />} label="АВАРИЯ" size="small" sx={{ ...styles, bgcolor: '#3d1a1a', color: T.danger, border: `1px solid ${T.danger}44` }} />;
  if (run) return <Chip icon={<LocalFireDepartmentIcon sx={{ fontSize: '0.85rem !important' }} />} label="РАБОТАЕТ" size="small" sx={{ ...styles, bgcolor: '#2d2200', color: '#e3a008', border: '1px solid #d2990244' }} />;
  if (end) return <Chip icon={<CheckCircleIcon sx={{ fontSize: '0.85rem !important' }} />} label="ГОТОВО" size="small" sx={{ ...styles, bgcolor: '#0f2a1a', color: T.success, border: `1px solid ${T.success}44` }} />;
  return <Chip icon={<PauseCircleIcon sx={{ fontSize: '0.85rem !important' }} />} label="СТОП" size="small" sx={{ ...styles, bgcolor: T.surfaceAlt, color: T.textSecondary, border: `1px solid ${T.border}` }} />;
}

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
        color: T.textMuted, fontSize: sz.lbl, fontFamily: T.sansFont,
        fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
        mb: 0.25, lineHeight: 1
      }}>{label}</Typography>
      <Typography sx={{
        fontFamily: T.monoFont, fontSize: sz.val,
        fontWeight: size === 'xl' ? 600 : 400, lineHeight: 1.2,
        color: highlight || T.textPrimary,
      }}>
        {value != null && value !== '—' ? `${value}${unit}` : '—'}
      </Typography>
    </Box>
  );
}

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
          height: '100%', width: `${pct}%`, bgcolor: color,
          borderRadius: 99, transition: 'width 0.6s ease',
          boxShadow: `0 0 8px ${color}66`,
        }} />
      </Box>
    </Box>
  );
}

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

const HRule = () => <Divider sx={{ borderColor: T.borderSoft, my: 1.5 }} />;

function ConnectionIndicator({ connected, connecting, error }) {
  if (error) return (
    <Tooltip title={`Ошибка: ${error}`}>
      <Chip icon={<ErrorIcon sx={{ fontSize: '0.75rem !important' }} />}
        label="ОТКЛ" size="small"
        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600,
          bgcolor: '#3d1a1a', color: T.danger, border: `1px solid ${T.danger}44`,
          '& .MuiChip-icon': { color: T.danger } }} />
    </Tooltip>
  );
  if (connecting) return (
    <Chip icon={<CircularProgress size={10} sx={{ color: T.warning }} />}
      label="ПОДКЛ..." size="small"
      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600,
        bgcolor: '#2d2200', color: T.warning, border: `1px solid ${T.warning}44` }} />
  );
  if (connected) return (
    <Tooltip title="SignalR подключён">
      <Chip icon={<SignalIcon sx={{ fontSize: '0.75rem !important' }} />}
        label="ONLINE" size="small"
        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600,
          bgcolor: '#0f2a1a', color: T.success, border: `1px solid ${T.success}44`,
          '& .MuiChip-icon': { color: T.success } }} />
    </Tooltip>
  );
  return null;
}

// ─── Секция: управление кассетой (с поддержкой слота) ─────────────────────────
function CassetteControl({ furnaceNo, slot, activeSession, availableCassettes, loading, onLoadClick, onUnloadClick, onCancelClick }) {
  const [selected, setSelected] = useState('');
  const slotLabel = slot != null ? `Слот ${slot}` : '';

  if (activeSession) {
    return (
      <Box sx={{
        bgcolor: '#0d1f30', border: `1px solid ${T.accent}33`,
        borderRadius: 1.5, p: 1.5,
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography sx={{
            color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
            fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {slotLabel ? `${slotLabel} · Активная кассета` : 'Активная кассета'}
          </Typography>
          {slotLabel && (
            <Chip label={slotLabel} size="small"
              sx={{ height: 18, fontSize: '0.58rem', fontWeight: 700,
                bgcolor: `${T.accent}22`, color: T.accent, border: `1px solid ${T.accent}44` }} />
          )}
        </Stack>

        <Typography sx={{
          fontFamily: T.monoFont, fontSize: '1.1rem', fontWeight: 700,
          color: T.accent, lineHeight: 1.2, mb: 0.3,
        }}>№{activeSession.cassetteNumber}</Typography>

        <Typography sx={{
          color: T.textSecondary, fontSize: '0.68rem', fontFamily: T.monoFont, mb: 0.5
        }}>{activeSession.businessKey}</Typography>

        <Typography sx={{ color: T.textSecondary, fontSize: '0.72rem', fontFamily: T.sansFont, mb: 0.25 }}>
          Загружена: {formatDateTime(activeSession.loadedAt)}
        </Typography>

        {activeSession.loadedBy && (
          <Typography sx={{ color: T.textMuted, fontSize: '0.7rem', fontFamily: T.sansFont, mb: 1 }}>
            Оператор: {activeSession.loadedBy}
          </Typography>
        )}

            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={() => onUnloadClick(slot)}
                    disabled={loading}
                    startIcon={<StopIcon sx={{ fontSize: '0.9rem !important' }} />}
                    sx={{
                        color: T.danger, borderColor: `${T.danger}66`,
                        fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em',
                        fontFamily: T.sansFont, py: 0.75,
                        '&:hover': { borderColor: T.danger, bgcolor: `${T.danger}11` },
                    }}>
                    Выгрузить
                </Button>
                <Tooltip title="Отменить загрузку и вернуть кассету в список активных">
                    <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        onClick={() => onCancelClick(slot)}
                        disabled={loading}
                        startIcon={<RefreshIcon sx={{ fontSize: '0.9rem !important' }} />}
                        sx={{
                            color: T.warning, borderColor: `${T.warning}66`,
                            fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em',
                            fontFamily: T.sansFont, py: 0.75,
                            '&:hover': { borderColor: T.warning, bgcolor: `${T.warning}11` },
                        }}>
                        Отменить
                    </Button>
                </Tooltip>
            </Stack>
      </Box>
    );
  }

  return (
    <Box>
      {slotLabel && (
        <Typography sx={{
          color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
          fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.75,
        }}>
          {slotLabel} · Свободен
        </Typography>
      )}

      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel sx={{
          color: T.textMuted, fontSize: '0.78rem', fontFamily: T.sansFont,
          '&.Mui-focused': { color: T.accent },
        }}>Выбрать кассету</InputLabel>
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}
          label="Выбрать кассету"
          sx={{
            color: T.textPrimary, fontSize: '0.8rem', fontFamily: T.monoFont,
            bgcolor: T.surfaceAlt, borderRadius: 1,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4a5568' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.accent },
            '& .MuiSvgIcon-root': { color: T.textSecondary },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: '#1a2330', border: `1px solid ${T.border}`, borderRadius: 1.5,
                '& .MuiMenuItem-root': {
                  fontSize: '0.8rem', fontFamily: T.monoFont, color: T.textPrimary,
                  py: 0.75, '&:hover': { bgcolor: T.surfaceAlt },
                  '&.Mui-selected': { bgcolor: `${T.accent}22` },
                },
              },
            },
          }}>
          <MenuItem value="">
            <Typography sx={{ color: T.textMuted, fontSize: '0.78rem', fontFamily: T.sansFont }}>
              — Выберите кассету —
            </Typography>
          </MenuItem>
          {availableCassettes.map(c => (
            <MenuItem key={c.cassetteId} value={c.cassetteNumber}>
              <Stack direction="row" spacing={1.5} alignItems="baseline">
                <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.8rem', color: T.accent, fontWeight: 600 }}>
                  №{c.cassetteNumber}
                </Typography>
                <Typography sx={{ fontFamily: T.sansFont, fontSize: '0.68rem', color: T.textSecondary }}>
                  {c.sheetsCount} л · {new Date(c.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button fullWidth variant="contained" size="small"
        onClick={() => { if (selected) onLoadClick(selected, slot); setSelected(''); }}
        disabled={loading || !selected}
        startIcon={<PlayArrowIcon sx={{ fontSize: '0.9rem !important' }} />}
        sx={{
          bgcolor: selected ? T.accent : T.surfaceAlt,
          color: selected ? '#0d1117' : T.textMuted,
          fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em',
          fontFamily: T.sansFont, py: 0.85, borderRadius: 1,
          boxShadow: selected ? `0 0 12px ${T.accent}55` : 'none',
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: selected ? '#79c0ff' : T.surfaceAlt,
            boxShadow: selected ? `0 0 20px ${T.accent}88` : 'none',
          },
          '&.Mui-disabled': { bgcolor: T.surfaceAlt, color: T.textMuted },
        }}>
        Загрузить в печь
      </Button>
    </Box>
  );
}

// ─── Карточка печи ────────────────────────────────────────────────────────────
function FurnaceCard({ furnaceNo, plcData, activeSessions, availableCassettes, onLoad, onUnload, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [pendingCassette, setPendingCassette] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [actionType, setActionType] = useState(null);

  const hasTwoSlots = DUAL_SLOT_FURNACES.includes(furnaceNo);
  const isFault = plcData?.proc_fault;
  const isRun = plcData?.proc_run;
  const isEnd = plcData?.proc_end;

  const sessionSlot1 = hasTwoSlots
    ? activeSessions.find(s => s.slotNumber === 1) || null
    : (activeSessions[0] || null);
  const sessionSlot2 = hasTwoSlots
    ? activeSessions.find(s => s.slotNumber === 2) || null
    : null;

  const activeCount = activeSessions.length;
  const borderColor = isFault ? T.danger : isRun ? '#d29922' : isEnd ? T.success : T.border;
  const bgColor = isFault ? '#1a0d0d' : isRun ? '#1a1600' : isEnd ? '#0d1a10' : T.surface;

  const handleLoadClick = (cassetteNumber, slot) => {
    setPendingCassette(cassetteNumber);
    setPendingSlot(slot);
    setActionType('load');
    setOpenConfirm(true);
  };

  const handleUnloadClick = (slot) => {
    setPendingSlot(slot);
    setActionType('unload');
    setOpenConfirm(true);
    };

  const handleCancelClick = (slot) => {
        setPendingSlot(slot);
        setActionType('cancel');
        setOpenConfirm(true);
    };

    const confirmAction = async () => {
        setLoading(true);
        try {
            if (actionType === 'load') {
                await onLoad(furnaceNo, parseInt(pendingCassette), pendingSlot);
            } else if (actionType === 'unload') {
                await onUnload(furnaceNo, pendingSlot);
            } else if (actionType === 'cancel') {
                await onCancel(furnaceNo, pendingSlot);
            }
            setOpenConfirm(false);
        } catch { /* parent handles error */ }
        finally { setLoading(false); }
    };

  const actColor = isFault ? T.danger : isRun ? '#f0a500' : T.textPrimary;

  const getConfirmText = () => {
    if (actionType === 'load') {
      const slotStr = pendingSlot != null ? ` (слот ${pendingSlot})` : '';
      return `Загрузить кассету №${pendingCassette} в печь №${furnaceNo}${slotStr}?`;
    } else {
      const session = pendingSlot != null
        ? (pendingSlot === 1 ? sessionSlot1 : sessionSlot2)
        : activeSessions[0];
      const slotStr = pendingSlot != null ? ` (слот ${pendingSlot})` : '';
      return `Выгрузить кассету ${session?.businessKey || ''}${slotStr} из печи №${furnaceNo}?`;
    }
  };

  return (
    <Paper elevation={0} sx={{
      bgcolor: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column',
      height: '100%', transition: 'border-color 0.3s, background-color 0.3s',
      boxShadow: isRun ? `0 0 20px ${T.warning}22` : isEnd ? `0 0 20px ${T.success}18` : 'none',
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{
          color: T.textPrimary, fontWeight: 700,
          fontSize: '0.88rem', letterSpacing: '0.02em', fontFamily: T.sansFont,
        }}>Печь отпуска №{furnaceNo}</Typography>
        <StatusChip run={isRun} end={isEnd} fault={isFault} />
      </Stack>

      <HRule />

      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={6}>
          <Metric label="Факт" value={fmtTemp(plcData?.temp_act)} size="xl" highlight={actColor} />
        </Grid>
        <Grid item xs={6}>
          <Metric label="Задание" value={fmtTemp(plcData?.temp_ref)} size="xl" highlight={T.accent} />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
        <Metric label="T1" value={fmtTemp(plcData?.t1)} size="sm" />
        <Metric label="T2" value={fmtTemp(plcData?.t2)} size="sm" />
        {plcData?.t_average_furn != null && (
          <Metric label="Ср. по печи" value={fmtTemp(plcData.t_average_furn)} size="sm" />
        )}
      </Stack>

      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        {[
          { label: 'Уст. время', val: fmtMin(plcData?.time_proc_set) },
          { label: 'До конца', val: fmtMin(plcData?.time_to_proc_end),
            highlight: (plcData?.time_to_proc_end || 0) < 10 ? '#f0a500' : T.textPrimary },
          { label: 'Нагрев', val: fmtMin(plcData?.act_time_heat_acc) },
          { label: 'Выдержка', val: fmtMin(plcData?.act_time_heat_wait) },
        ].map(({ label, val, highlight }) => (
          <Grid item xs={3} key={label}>
            <Metric label={label} value={val} size="sm" highlight={highlight} />
          </Grid>
        ))}
      </Grid>

      <ProgressBar value={plcData?.act_time_total} max={plcData?.time_proc_set} />

      {hasTwoSlots && (
        <>
          <HRule />
          <Typography sx={{
            color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
            fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1,
          }}>Горелка</Typography>
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

      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{
          color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
          fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5,
        }}>Программа нагрева</Typography>
        <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.72rem', color: T.textSecondary, lineHeight: 1.6 }}>
          T1={fmtTemp(plcData?.point_ref_1)} · t1={fmtMin(plcData?.point_time_1)} · Δt2={fmtMin(plcData?.point_dtime_2)}
        </Typography>
      </Box>

      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{
          color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
          fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5,
        }}>Кассеты в ПЛК</Typography>
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

      <Box sx={{ mt: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography sx={{
            color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont,
            fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Управление кассетой</Typography>
          {hasTwoSlots && (
            <Chip
              label={`${activeCount}/2`}
              size="small"
              sx={{
                height: 20, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: activeCount === 2 ? `${T.warning}22` : `${T.success}22`,
                color: activeCount === 2 ? T.warning : T.success,
                border: `1px solid ${activeCount === 2 ? T.warning : T.success}44`,
              }}
            />
          )}
        </Stack>

        {hasTwoSlots ? (
          <Stack spacing={1.5}>
            <CassetteControl
              furnaceNo={furnaceNo} slot={1}
              activeSession={sessionSlot1}
              availableCassettes={availableCassettes}
              loading={loading}
              onLoadClick={handleLoadClick}
              onUnloadClick={handleUnloadClick}
              onCancelClick={handleCancelClick}
            />
            <CassetteControl
              furnaceNo={furnaceNo} slot={2}
              activeSession={sessionSlot2}
              availableCassettes={availableCassettes}
              loading={loading}
              onLoadClick={handleLoadClick}
                          onUnloadClick={handleUnloadClick}
                          onCancelClick={handleCancelClick}
            />
          </Stack>
        ) : (
          <CassetteControl
            furnaceNo={furnaceNo} slot={null}
            activeSession={sessionSlot1}
            availableCassettes={availableCassettes}
            loading={loading}
            onLoadClick={handleLoadClick}
                          onUnloadClick={handleUnloadClick}
                          onCancelClick={handleCancelClick}
          />
        )}
      </Box>

      <Typography sx={{
        color: T.textMuted, fontSize: '0.62rem', fontFamily: T.monoFont,
        textAlign: 'right', mt: 1.5, opacity: 0.7,
      }}>
        {formatTime(new Date())}
      </Typography>

      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#1a2330', border: `1px solid ${T.border}`, borderRadius: 2 } }}>
              <DialogTitle sx={{ color: T.textPrimary, fontFamily: T.sansFont, fontSize: '0.95rem', fontWeight: 600 }}>
                  {actionType === 'load' ? 'Подтверждение загрузки' :
                      actionType === 'cancel' ? 'Отмена загрузки' :
                          'Подтверждение выгрузки'}
              </DialogTitle>
        <DialogContent dividers sx={{ borderColor: T.borderSoft }}>
          <Typography variant="body2" sx={{ color: T.textSecondary, fontFamily: T.sansFont, fontSize: '0.85rem' }}>
            {getConfirmText()}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={() => setOpenConfirm(false)} sx={{ color: T.textSecondary, fontSize: '0.8rem' }}>
            Отмена
          </Button>
                  <Button onClick={confirmAction} variant="contained"
                      sx={{
                          bgcolor: actionType === 'load' ? T.accent :
                              actionType === 'cancel' ? T.warning : T.danger,
                          color: '#0d1117', fontWeight: 700, fontSize: '0.8rem',
                          '&:hover': {
                              bgcolor: actionType === 'load' ? '#79c0ff' :
                                  actionType === 'cancel' ? '#e3b341' : '#ff6b6b'
                          },
                      }}>
                      Подтвердить
                  </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// ─── Основная страница ────────────────────────────────────────────────────────
export default function TemperingHMI() {
  const { values, connected, connecting, error: opcError } = useOpcUa(OPC_ALIASES);
  const [activeSessions, setActiveSessions] = useState([]);
  const [availableCassettes, setAvailableCassettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { user } = useAuth(); 
  const plcDataList = useMemo(() => {
    return FURNACES.map(no => transformOpcToPlcData(values, no));
  }, [values]);

  const showMessage = (msg, severity = 'success') => {
    setSnackbar({ open: true, message: msg, severity });
    setTimeout(() => setSnackbar(p => ({ ...p, open: false })), 5000);
  };

  const loadActiveSessions = useCallback(async () => {
    try {
      const r = await api.get('/tempering/active-sessions');
      setActiveSessions(r.data);
    } catch { /* silent */ }
  }, []);


  const loadReadyCassettes = useCallback(async () => {
    try {
      const [casR, sesR] = await Promise.all([
        api.get('/cassettenew/list'),
        api.get('/tempering/active-sessions'),
      ]);
      const activeCasKeys = sesR.data.map(s => s.businessKey || s.BusinessKey);
      const ready = casR.data.filter(c =>
        c.is_closed === true && !activeCasKeys.includes(c.business_key)
      );
      const withSheets = await Promise.all(ready.map(async (c) => {
        try {
          const sr = await api.get(`/cassettenew/${encodeURIComponent(c.business_key)}/sheets`);
          return {
            cassetteId: c.business_key,
            cassetteNumber: c.cassette_number,
            status: 'Готова к отправке',
            sheetsCount: sr.data.length,
            totalWeight: 0,
            createdAt: c.created_at,
          };
        } catch {
          return {
            cassetteId: c.business_key,
            cassetteNumber: c.cassette_number,
            status: 'Готова к отправке',
            sheetsCount: 0,
            totalWeight: 0,
            createdAt: c.created_at,
          };
        }
      }));
      setAvailableCassettes(withSheets);
    } catch (err) {
      console.error('Ошибка загрузки готовых кассет:', err);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setRefreshing(true);
    try { await loadActiveSessions(); }
    catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [loadActiveSessions]);

  useEffect(() => { if (!loading) loadReadyCassettes(); }, [activeSessions, loading, loadReadyCassettes]);

  useEffect(() => {
    loadAllData();
    const iv = setInterval(loadAllData, 10000);
    return () => clearInterval(iv);
  }, [loadAllData]);

  const getSessionsByFurnace = useCallback((n) => {
    return activeSessions.filter(s => s.furnaceNumber === n);
  }, [activeSessions]);

  const getPlcData = (n) => plcDataList.find(f => f.furnace_no === n);

  const handleLoadCassette = async (furnaceNo, cassetteNumber, slot) => {
    try {
      const operatorName = user.username;

      await api.post('/tempering/load', { furnaceNo, cassetteNumber, slot,operatorName });
      const slotStr = slot != null ? ` (слот ${slot})` : '';
      showMessage(`Кассета №${cassetteNumber} → Печь №${furnaceNo}${slotStr}`, 'success');
      await loadAllData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Ошибка при загрузке кассеты', 'error');
      throw err;
    }
  };

  const handleUnloadCassette = async (furnaceNo, slot) => {
    try {
      await api.post('/tempering/unload', { furnaceNo, slot });
      const slotStr = slot != null ? ` (слот ${slot})` : '';
      showMessage(`Кассета выгружена из печи №${furnaceNo}${slotStr}`, 'success');
      await loadAllData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Ошибка при выгрузке кассеты', 'error');
      throw err;
    }
  };
    const handleCancelLoad = async (furnaceNo, slot) => {
        try {
            const r = await api.post('/tempering/cancel-load', { furnaceNo, slot });
            const slotStr = slot != null ? ` (слот ${slot})` : '';
            showMessage(r.data?.message || `Загрузка отменена, кассета возвращена в активные${slotStr}`, 'success');
            await loadAllData();
        } catch (err) {
            showMessage(err.response?.data?.message || err.response?.data?.title || 'Ошибка при отмене загрузки', 'error');
            throw err;
        }
    };
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
          }}>Печи отпуска</Typography>
          <ConnectionIndicator connected={connected} connecting={connecting} error={opcError} />
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {(loading || refreshing) && <CircularProgress size={14} sx={{ color: T.accent }} />}
          <Tooltip title="Обновить сессии">
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

      {/* ── Ошибки */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, bgcolor: '#2d1515', color: T.danger }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {opcError && (
        <Alert severity="warning" sx={{ mb: 2, bgcolor: '#2d2200', color: T.warning }}>
          Нет подключения к OPC UA серверу. Данные могут быть устаревшими.
        </Alert>
      )}

      {/* ── Карточки печей */}
      <Box sx={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2,
        '@media (max-width:1100px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
        '@media (max-width:600px)': { gridTemplateColumns: '1fr' },
      }}>
              {FURNACES.map(no => (
                  <FurnaceCard key={no} furnaceNo={no} plcData={getPlcData(no)}
                      activeSessions={getSessionsByFurnace(no)}
                      availableCassettes={availableCassettes}
                      onLoad={handleLoadCassette}
                      onUnload={handleUnloadCassette}
                      onCancel={handleCancelLoad} />
              ))}
      </Box>

      {/* ── Панель доступных кассет */}
      <Paper elevation={0} sx={{
        mt: 2.5, p: 2, bgcolor: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 2,
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography sx={{
            color: T.textSecondary, fontSize: '0.7rem', fontFamily: T.sansFont,
            fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Доступные кассеты</Typography>
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
              <Chip key={c.cassetteId}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.75rem', color: T.accent, fontWeight: 600 }}>
                      №{c.cassetteNumber}
                    </Typography>
                    <Typography sx={{ fontFamily: T.sansFont, fontSize: '0.65rem', color: T.textSecondary }}>
                      {c.sheetsCount} л
                    </Typography>
                  </Stack>
                }
                sx={{
                  bgcolor: T.surfaceAlt, border: `1px solid ${T.border}`,
                  color: T.textPrimary, '&:hover': { bgcolor: `${T.accent}22` },
                }} />
            ))}
          </Box>
        )}
      </Paper>

      {/* ── Уведомление */}
      <Snackbar open={snackbar.open} autoHideDuration={5000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity}
          onClose={() => setSnackbar(p => ({ ...p, open: false }))}
          sx={{
            fontFamily: T.sansFont, fontSize: '0.82rem',
            bgcolor: snackbar.severity === 'success' ? '#0f2a1a' : '#2d1515',
          }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}