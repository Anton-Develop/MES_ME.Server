// src/pages/LineMonitoringHMI.jsx
// Единый экран МОНИТОРИНГА (только визуализация) линий закалки и отпуска.
// Управление полностью отключено.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Grid, Paper, Typography, Stack, Chip,
  CircularProgress, Divider, Tooltip, Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  LocalFireDepartment as LocalFireDepartmentIcon,
  PauseCircle as PauseCircleIcon,
  SignalCellularAlt as SignalIcon,
} from '@mui/icons-material';
import api from '../api';
import { useOpcUa } from '../hooks/useOpcUa';

// ═══════════════════════════════════════════════════════════════════════════
//  ОБЩИЕ КОНСТАНТЫ / ТЕМА
// ═══════════════════════════════════════════════════════════════════════════
const FURNACES = [1, 2, 3, 4];
const DUAL_SLOT_FURNACES = [3, 4];

const T = {
  bg: '#0d1117', surface: '#161b22', surfaceAlt: '#1c2330',
  border: '#30363d', borderSoft: '#21262d',
  textPrimary: '#e6edf3', textSecondary: '#8b949e', textMuted: '#484f58',
  accent: '#58a6ff', success: '#3fb950', warning: '#d29922', danger: '#f85149',
  monoFont: "'JetBrains Mono','Fira Code','Roboto Mono',monospace",
  sansFont: "'Inter','Roboto',sans-serif",
};

// Палитра SVG‑схемы закалки
const C = {
  bg: '#0d1117', panel: '#161b22', panelBd: '#30363d',
  text: '#e6edf3', dim: '#7d8590', accent: '#58a6ff',
  green: '#3fb950', red: '#f85149', yellow: '#d29922',
  water: '#2980b9', roller: '#3a3f47', rollerBd: '#555d68', display: '#010409',
};
const ZONE_FILL = ['#7f1d1d', '#7c2d12', '#713f12', '#3b3009'];
const ZONE_STROKE = ['#dc2626', '#ea580c', '#ca8a04', '#a16207'];
const ZONE_LABEL = ['#fca5a5', '#fdba74', '#fde68a', '#fef08a'];

// ═══════════════════════════════════════════════════════════════════════════
//  ОБЪЕДИНЁННЫЙ СПИСОК OPC UA ТЕГОВ (одно подключение на весь экран)
// ═══════════════════════════════════════════════════════════════════════════
const TEMPERING_TAGS = [
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

const QUENCHING_TAGS = [
  'PLC210.T_F1_MedAct', 'PLC210.T_F2_MedAct', 'PLC210.T_F3_MedAct', 'PLC210.T_F4_MedAct',
  'PLC210.E1_Ocp', 'PLC210.E1_Melt', 'PLC210.E1_PartNo', 'PLC210.E1_Pack', 'PLC210.E1_Sheet',
  'PLC210.F1_ZoneOccup', 'PLC210.F1_InArrow', 'PLC210.F1_OutArrow', 'PLC210.F1_Melt', 'PLC210.F1_PartNo', 'PLC210.F1_Pack', 'PLC210.F1_Sheet',
  'PLC210.F2_ZoneOccup', 'PLC210.F2_OutArrow', 'PLC210.F2_Melt', 'PLC210.F2_PartNo', 'PLC210.F2_Pack', 'PLC210.F2_Sheet',
  'PLC210.F3_ZoneOccup', 'PLC210.F3_OutArrow', 'PLC210.F3_Melt', 'PLC210.F3_PartNo', 'PLC210.F3_Pack', 'PLC210.F3_Sheet',
  'PLC210.F4_ZoneOccup', 'PLC210.F4_OutArrow', 'PLC210.F4_Melt', 'PLC210.F4_PartNo', 'PLC210.F4_Pack', 'PLC210.F4_Sheet', 'PLC210.F4_AlloyCodeText', 'PLC210.F4_Thikness',
  'PLC210.X1_ZoneOccup', 'PLC210.X1_Melt', 'PLC210.X1_PartNo', 'PLC210.X1_Pack', 'PLC210.X1_Sheet',
  'PLC210.X2_ZoneOccup', 'PLC210.X2_Melt', 'PLC210.X2_PartNo', 'PLC210.X2_Pack', 'PLC210.X2_Sheet',
  'PLC210.ModeLen', 'PLC210.TmpSet', 'PLC210.X1_UnLoadSpeed', 'PLC210.F4_UnLoadSpeed',
  'PLC210.Valave_1x1_MnAt', 'PLC210.Valave_1x2_MnAt', 'PLC210.Valave_1x3_MnAt', 'PLC210.Valave_1x4_MnAt', 'PLC210.Valave_1x5_MnAt',
  'PLC210.Valave_1x6_MnAt', 'PLC210.Valave_1x7_MnAt', 'PLC210.Valave_1x8_MnAt', 'PLC210.Valave_1x9_MnAt',
  'PLC210.Valave_2x1_MnAt', 'PLC210.Valave_2x2_MnAt', 'PLC210.Valave_2x3_MnAt', 'PLC210.Valave_2x4_MnAt', 'PLC210.Valave_2x5_MnAt',
  'PLC210.Valave_2x6_MnAt', 'PLC210.Valave_2x7_MnAt', 'PLC210.Valave_2x8_MnAt', 'PLC210.Valave_2x9_MnAt',
];

const ALL_TAGS = [...TEMPERING_TAGS, ...QUENCHING_TAGS];

// ═══════════════════════════════════════════════════════════════════════════
//  УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════════════
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
    const l = val.toLowerCase();
    return l === 'true' || l === '1' || l === 'yes';
  }
  return Boolean(val);
};
const toNumber = (v) => {
  const val = extractValue(v);
  if (val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
};
const toStr = (v) => (v === null || v === undefined) ? '—' : String(v);
const valveState = (v) => {
  if (v === 1 || v === '1' || v === true) return 1;
  if (v === 6 || v === '6') return 6;
  return 0;
};

// Форматирование
const fmtTemp = (v) => v != null ? `${Number(v).toFixed(1)}°` : '—';
const fmtMin = (v) => v != null ? `${Number(v).toFixed(0)} мин` : '—';
const fmtBar = (v) => v != null ? `${Number(v).toFixed(3)}` : '—';
const formatDateTime = (dt) => dt ? new Date(dt).toLocaleString('ru-RU') : '—';
const fmtClock = (d) => d.toTimeString().slice(0, 8);

// Преобразование OPC UA → данные печи отпуска
const transformOpcToPlcData = (values, furnaceNo) => {
  let prefix;
  if (furnaceNo === 1) prefix = 'RelFurn12.RelFurn1';
  else if (furnaceNo === 2) prefix = 'RelFurn12.RelFurn2';
  else prefix = `RelFurn${furnaceNo}`;
  const getVal = (tag) => extractValue(values[`${prefix}.${tag}`]);
  const data = {
    furnace_no: furnaceNo,
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

// ═══════════════════════════════════════════════════════════════════════════
//  MUI‑ПРИМИТИВЫ (печи отпуска)
// ═══════════════════════════════════════════════════════════════════════════
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
  const sizes = { xl: { val: '2rem', lbl: '0.6rem' }, md: { val: '0.85rem', lbl: '0.6rem' }, sm: { val: '0.75rem', lbl: '0.58rem' } };
  const sz = sizes[size] || sizes.md;
  return (
    <Box>
      <Typography sx={{ color: T.textMuted, fontSize: sz.lbl, fontFamily: T.sansFont, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', mb: 0.25, lineHeight: 1 }}>{label}</Typography>
      <Typography sx={{ fontFamily: T.monoFont, fontSize: sz.val, fontWeight: size === 'xl' ? 600 : 400, lineHeight: 1.2, color: highlight || T.textPrimary }}>
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
        <Typography sx={{ color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Прогресс</Typography>
        <Typography sx={{ color: pct >= 100 ? T.success : T.textSecondary, fontSize: '0.65rem', fontFamily: T.monoFont, fontWeight: 600 }}>{pct.toFixed(0)}%</Typography>
      </Stack>
      <Box sx={{ height: 5, borderRadius: 99, bgcolor: T.surfaceAlt, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 99, transition: 'width 0.6s ease', boxShadow: `0 0 8px ${color}66` }} />
      </Box>
    </Box>
  );
}

function CassetteLabel({ no, day, month, year, hour }) {
  if (!no && !day) return <Typography sx={{ color: T.textMuted, fontSize: '0.75rem', fontFamily: T.monoFont }}>—</Typography>;
  const hourStr = hour != null && hour !== 99 ? `${hour}ч` : '';
  const dateStr = day && month && year ? `${day}.${String(month).padStart(2, '0')}.${year}` : '';
  const parts = [dateStr, hourStr, no ? `№${no}` : ''].filter(Boolean);
  return <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.75rem', color: T.textSecondary }}>{parts.join(' · ')}</Typography>;
}

const HRule = () => <Divider sx={{ borderColor: T.borderSoft, my: 1.5 }} />;

function ConnectionIndicator({ connected, connecting, error }) {
  if (error) return (
    <Tooltip title={`Ошибка: ${error}`}>
      <Chip icon={<ErrorIcon sx={{ fontSize: '0.75rem !important' }} />} label="ОТКЛ" size="small"
        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#3d1a1a', color: T.danger, border: `1px solid ${T.danger}44`, '& .MuiChip-icon': { color: T.danger } }} />
    </Tooltip>
  );
  if (connecting) return (
    <Chip icon={<CircularProgress size={10} sx={{ color: T.warning }} />} label="ПОДКЛ..." size="small"
      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#2d2200', color: T.warning, border: `1px solid ${T.warning}44` }} />
  );
  if (connected) return (
    <Tooltip title="OPC UA подключён">
      <Chip icon={<SignalIcon sx={{ fontSize: '0.75rem !important' }} />} label="ONLINE" size="small"
        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#0f2a1a', color: T.success, border: `1px solid ${T.success}44`, '& .MuiChip-icon': { color: T.success } }} />
    </Tooltip>
  );
  return null;
}

// Read‑only отображение активной кассеты (без кнопок)
function ActiveCassetteView({ slotLabel, session }) {
  if (session) {
    return (
      <Box sx={{ bgcolor: '#0d1f30', border: `1px solid ${T.accent}33`, borderRadius: 1.5, p: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
          <Typography sx={{ color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {slotLabel ? `${slotLabel} · Активная кассета` : 'Активная кассета'}
          </Typography>
          {slotLabel && <Chip label={slotLabel} size="small" sx={{ height: 18, fontSize: '0.58rem', fontWeight: 700, bgcolor: `${T.accent}22`, color: T.accent, border: `1px solid ${T.accent}44` }} />}
        </Stack>
        <Typography sx={{ fontFamily: T.monoFont, fontSize: '1.05rem', fontWeight: 700, color: T.accent, lineHeight: 1.2, mb: 0.3 }}>№{session.cassetteNumber}</Typography>
        <Typography sx={{ color: T.textSecondary, fontSize: '0.66rem', fontFamily: T.monoFont, mb: 0.5 }}>{session.businessKey}</Typography>
        <Typography sx={{ color: T.textSecondary, fontSize: '0.7rem', fontFamily: T.sansFont }}>Загружена: {formatDateTime(session.loadedAt)}</Typography>
        {session.loadedBy && (
          <Typography sx={{ color: T.textMuted, fontSize: '0.68rem', fontFamily: T.sansFont }}>Оператор: {session.loadedBy}</Typography>
        )}
      </Box>
    );
  }
  return (
    <Box sx={{ bgcolor: T.surfaceAlt, border: `1px dashed ${T.border}`, borderRadius: 1.5, p: 1.5 }}>
      <Typography sx={{ color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
        {slotLabel ? `${slotLabel} · Свободен` : 'Слот свободен'}
      </Typography>
      <Typography sx={{ color: T.textMuted, fontSize: '0.75rem', fontFamily: T.monoFont }}>— нет кассеты —</Typography>
    </Box>
  );
}

// Карточка печи отпуска (ТОЛЬКО ЧТЕНИЕ)
function FurnaceCard({ furnaceNo, plcData, activeSessions }) {
  const hasTwoSlots = DUAL_SLOT_FURNACES.includes(furnaceNo);
  const isFault = plcData?.proc_fault;
  const isRun = plcData?.proc_run;
  const isEnd = plcData?.proc_end;
  const sessionSlot1 = hasTwoSlots ? (activeSessions.find(s => s.slotNumber === 1) || null) : (activeSessions[0] || null);
  const sessionSlot2 = hasTwoSlots ? (activeSessions.find(s => s.slotNumber === 2) || null) : null;
  const activeCount = activeSessions.length;
  const borderColor = isFault ? T.danger : isRun ? '#d29922' : isEnd ? T.success : T.border;
  const bgColor = isFault ? '#1a0d0d' : isRun ? '#1a1600' : isEnd ? '#0d1a10' : T.surface;
  const actColor = isFault ? T.danger : isRun ? '#f0a500' : T.textPrimary;

  return (
    <Paper elevation={0} sx={{
      bgcolor: bgColor, 
      border: `1px solid ${borderColor}`, 
      borderRadius: 2, 
      p: 2,
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'space-between',
      height: '100%',
      overflow: 'auto', 
      transition: 'border-color 0.3s, background-color 0.3s',
      boxShadow: isRun ? `0 0 20px ${T.warning}22` : isEnd ? `0 0 20px ${T.success}18` : 'none',
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ color: T.textPrimary, fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.02em', fontFamily: T.sansFont }}>Печь отпуска №{furnaceNo}</Typography>
        <StatusChip run={isRun} end={isEnd} fault={isFault} />
      </Stack>
      <HRule />
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={6}><Metric label="Факт" value={fmtTemp(plcData?.temp_act)} size="xl" highlight={actColor} /></Grid>
        <Grid item xs={6}><Metric label="Задание" value={fmtTemp(plcData?.temp_ref)} size="xl" highlight={T.accent} /></Grid>
      </Grid>
      <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
        <Metric label="T1" value={fmtTemp(plcData?.t1)} size="sm" />
        <Metric label="T2" value={fmtTemp(plcData?.t2)} size="sm" />
        {plcData?.t_average_furn != null && <Metric label="Ср. по печи" value={fmtTemp(plcData.t_average_furn)} size="sm" />}
      </Stack>
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        {[
          { label: 'Уст. время', val: fmtMin(plcData?.time_proc_set) },
          { label: 'До конца', val: fmtMin(plcData?.time_to_proc_end), highlight: (plcData?.time_to_proc_end || 0) < 10 ? '#f0a500' : T.textPrimary },
          { label: 'Нагрев', val: fmtMin(plcData?.act_time_heat_acc) },
          { label: 'Выдержка', val: fmtMin(plcData?.act_time_heat_wait) },
        ].map(({ label, val, highlight }) => (
          <Grid item xs={3} key={label}><Metric label={label} value={val} size="sm" highlight={highlight} /></Grid>
        ))}
      </Grid>
      <ProgressBar value={plcData?.act_time_total} max={plcData?.time_proc_set} />
      {hasTwoSlots && (
        <>
          <HRule />
          <Typography sx={{ color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1 }}>Горелка</Typography>
          <Grid container spacing={1}>
            {[
              { label: 'TE нижн.', value: fmtTemp(plcData?.burn1_te_lower) },
              { label: 'TE верхн.', value: fmtTemp(plcData?.burn1_te_upper) },
              { label: 'Возд., bar', value: fmtBar(plcData?.burn1_air_prs) },
              { label: 'Газ, bar', value: fmtBar(plcData?.burn1_gas_prs) },
            ].map(({ label, value }) => (
              <Grid item xs={6} key={label}><Metric label={label} value={value} size="sm" /></Grid>
            ))}
          </Grid>
        </>
      )}
      <HRule />
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>Программа нагрева</Typography>
        <Typography sx={{ fontFamily: T.monoFont, fontSize: '0.72rem', color: T.textSecondary, lineHeight: 1.6 }}>
          T1={fmtTemp(plcData?.point_ref_1)} · t1={fmtMin(plcData?.point_time_1)} · Δt2={fmtMin(plcData?.point_dtime_2)}
        </Typography>
      </Box>
     {/*  <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>Кассеты в ПЛК</Typography>
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
          <Typography sx={{ color: T.textMuted, fontSize: '0.6rem', fontFamily: T.sansFont, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Кассеты в печи</Typography>
          {hasTwoSlots && (
            <Chip label={`${activeCount}/2`} size="small" sx={{
              height: 20, fontSize: '0.6rem', fontWeight: 700,
              bgcolor: activeCount === 2 ? `${T.warning}22` : `${T.success}22`,
              color: activeCount === 2 ? T.warning : T.success,
              border: `1px solid ${activeCount === 2 ? T.warning : T.success}44`,
            }} />
          )}
        </Stack>
        {hasTwoSlots ? (
          <Stack spacing={1.5}>
            <ActiveCassetteView slotLabel="Слот 1" session={sessionSlot1} />
            <ActiveCassetteView slotLabel="Слот 2" session={sessionSlot2} />
          </Stack>
        ) : (
          <ActiveCassetteView slotLabel={null} session={sessionSlot1} />
        )}
      </Box>*/}
    </Paper>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SVG‑ПРИМИТИВЫ СХЕМЫ ЗАКАЛКИ
// ═══════════════════════════════════════════════════════════════════════════
const Led = ({ on, color = '#3fb950', size = 10 }) => (
  <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: on ? color : '#252a30', boxShadow: on ? `0 0 5px ${color}` : 'none', flexShrink: 0 }} />
);
const Seg = ({ value, unit = '', width = 70 }) => (
  <div style={{ background: C.display, border: '1px solid #1c6ca8', borderRadius: 3, padding: '2px 5px', minWidth: width, textAlign: 'right', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
    <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#4fc3f7', fontWeight: 700 }}>{value}</span>
    {unit && <span style={{ fontSize: 14, color: C.dim }}>{unit}</span>}
  </div>
);
const ValveLed = ({ cx, cy, state, r = 4.5 }) => {
  const color = state === 1 ? C.green : state === 6 ? C.red : '#252a30';
  const stroke = state === 6 ? C.red : state === 1 ? '#2ea043' : '#444';
  return (
    <g>
      {state === 1 && <circle cx={cx} cy={cy} r={r + 2.5} fill="none" stroke={C.green} strokeWidth={0.6} opacity={0.4} />}
      {state === 6 && <circle cx={cx} cy={cy} r={r + 2.5} fill="none" stroke={C.red} strokeWidth={0.6} opacity={0.5} />}
      <circle cx={cx} cy={cy} r={r} fill={color} stroke={stroke} strokeWidth={0.8} />
      {state === 6 && <text x={cx} y={cy + 2.5} textAnchor="middle" fill="#fff" fontSize={6} fontWeight={700}>!</text>}
    </g>
  );
};
const Rollers = ({ x, y, count, w = 16, gap = 5, h = 30 }) => (
  <>{Array.from({ length: count }).map((_, i) => (
    <g key={i}>
      <rect x={x + i * (w + gap)} y={y} width={w} height={h} rx={w / 2} fill={C.roller} stroke={C.rollerBd} strokeWidth={1} />
      <circle cx={x + i * (w + gap) + w / 2} cy={y + h / 2} r={3} fill="none" stroke={C.rollerBd} strokeWidth={1.5} />
    </g>
  ))}</>
);
const SheetRect = ({ x, y, w, h = 16, label, color }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2} fill={color} stroke="#8b949e" strokeWidth={1} opacity={0.92} />
    {label && <text x={x + w / 2} y={y + h / 2 + 3.5} textAnchor="middle" fill="#e6edf3" fontSize={8} fontFamily="monospace" fontWeight={600}>{label}</text>}
  </g>
);
const Nozzles9 = ({ x, y, active, side }) => (
  <>{Array.from({ length: 9 }).map((_, i) => {
    const cx = x + i * 13 + 6;
    const tipY = side === 'top' ? y + 10 : y - 10;
    return (
      <g key={i}>
        <polygon points={`${cx - 4},${y} ${cx + 4},${y} ${cx},${tipY}`} fill={active ? C.water : '#252a30'} stroke={active ? '#60a5fa' : '#333'} strokeWidth={0.5} />
        {active && <line x1={cx} y1={tipY} x2={cx} y2={side === 'top' ? tipY + 9 : tipY - 9} stroke={C.water} strokeWidth={1.5} strokeDasharray="2,2" opacity={0.7} />}
      </g>
    );
  })}</>
);

// ═══════════════════════════════════════════════════════════════════════════
//  ОСНОВНОЙ КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════
export default function LineMonitoringHMI() {
  // Одно OPC UA подключение на весь экран (только чтение)
  const { values, connected, connecting, error: opcError } = useOpcUa(ALL_TAGS);

  const [time, setTime] = useState(new Date());
  const [activeSessions, setActiveSessions] = useState([]);

  // ── Данные линии закалки из OPC UA ──
  const [liveData, setLiveData] = useState({
    entry: null, furnace: [null, null, null, null], quench: null, cool: null, output: null,
    arrows: { toFurnace: false, zones: [false, false, false, false] },
  });

  useEffect(() => {
    const makeSheet = (prefix) => {
      const fp = `PLC210.${prefix}`;
      const occ = toBool(values[`${fp}_ZoneOccup`]?.value ?? values[`${fp}_Ocp`]?.value);
      if (!occ) return null;
      return {
        melt: toStr(values[`${fp}_Melt`]?.value),
        sheet: toStr(values[`${fp}_Sheet`]?.value),
        pack: toStr(values[`${fp}_Pack`]?.value),
        batch: toStr(values[`${fp}_PartNo`]?.value),
        grade: toStr(values[`${fp}_AlloyCodeText`]?.value),
        thick: toStr(values[`${fp}_Thikness`]?.value),
      };
    };
    const entryOcc = toBool(values['PLC210.E1_Ocp']?.value);
    const entrySheet = entryOcc ? {
      melt: toStr(values['PLC210.E1_Melt']?.value),
      sheet: toStr(values['PLC210.E1_Sheet']?.value),
      pack: toStr(values['PLC210.E1_Pack']?.value),
      batch: toStr(values['PLC210.E1_PartNo']?.value),
    } : null;
    const x1Sheet = makeSheet('X1');
    setLiveData({
      entry: entrySheet,
      furnace: [1, 2, 3, 4].map(i => makeSheet(`F${i}`)),
      quench: x1Sheet, cool: x1Sheet, output: makeSheet('X2'),
      arrows: {
        toFurnace: toBool(values['PLC210.F1_InArrow']?.value),
        zones: [1, 2, 3, 4].map(i => toBool(values[`PLC210.F${i}_OutArrow`]?.value)),
      },
    });
  }, [values]);

  const realTemps = [
    Math.round(values['PLC210.T_F1_MedAct']?.value ?? 0),
    Math.round(values['PLC210.T_F2_MedAct']?.value ?? 0),
    Math.round(values['PLC210.T_F3_MedAct']?.value ?? 0),
    Math.round(values['PLC210.T_F4_MedAct']?.value ?? 0),
  ];
  const speedDisplay = (() => { const v = values['PLC210.F4_UnLoadSpeed']?.value; return (v != null && !isNaN(v)) ? Number(v) : '—'; })();
  const tempSetDisplay = (() => { const v = values['PLC210.TmpSet']?.value; return (v != null && !isNaN(v)) ? Number(v).toFixed(1) : '—'; })();
  const lengthDisplay = (() => { const v = values['PLC210.ModeLen']?.value; return v === 1 || v === '1' ? '6' : v === 0 || v === '0' ? '3' : '—'; })();
  const topValves = Array.from({ length: 9 }, (_, i) => valveState(values[`PLC210.Valave_1x${i + 1}_MnAt`]?.value));
  const bottomValves = Array.from({ length: 9 }, (_, i) => valveState(values[`PLC210.Valave_2x${i + 1}_MnAt`]?.value));

  // ── Активные сессии отпуска (REST, только чтение) ──
  const loadActiveSessions = useCallback(async () => {
    try { const r = await api.get('/tempering/active-sessions'); setActiveSessions(r.data); } catch { /* silent */ }
  }, []);
  useEffect(() => {
    loadActiveSessions();
    const iv = setInterval(loadActiveSessions, 10000);
    return () => clearInterval(iv);
  }, [loadActiveSessions]);

  // ── Данные печей отпуска из OPC UA ──
  const plcDataList = useMemo(() => FURNACES.map(no => transformOpcToPlcData(values, no)), [values]);
  const getPlcData = (n) => plcDataList.find(f => f.furnace_no === n);
  const getSessionsByFurnace = useCallback((n) => activeSessions.filter(s => s.furnaceNumber === n), [activeSessions]);

  // ── Часы ──
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Данные для SVG (без локальной таблицы/планов) ──
  const zones = liveData.furnace;
  const qS = liveData.quench;
  const cS = liveData.cool;
  const svgEntry = liveData.entry;

  // ── Геометрия SVG ──
  const VW = 1000, VH = 230, rY = 110, rH = 30, rW = 16, rGap = 5;
  const inX = 10, inN = 5;
  const fX = inX + inN * (rW + rGap) + 22;
  const zW = 118, zGap = 2, furnW = 4 * zW + 3 * zGap;
  const qX = fX + furnW + 20, qW = 126;
  const outX = qX + qW + 20, outN = 6;
  const finX = outX + outN * (rW + rGap) + 18, finN = 4;
  const zoneX = (i) => fX + i * (zW + zGap);

  return (
    <Box sx={{ bgcolor: T.bg,  height: '90vh',  display: 'flex',flexDirection: 'column',overflow: 'hidden',p: 1.5 }}>
      {/* ══ ВЕРХНЯЯ ПАНЕЛЬ ЛИНИИ ЗАКАЛКИ ═══════════════════════════════ */}
    {/*  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'nowrap', background: C.panel, border: `1px solid ${C.panelBd}`, borderRadius: 6, padding: '7px 12px', marginBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, minWidth: 155 }}>
          {[
            { on: false, color: C.red, label: 'Аварийный останов' },
            { on: false, color: C.red, label: 'Блокировка нагрева' },
            { on: true, color: C.green, label: 'Готовность к запуску' },
            { on: !!svgEntry, color: C.accent, label: 'Лист на рольганге' },
          ].map(({ on, color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Led on={on} color={color} />
              <span style={{ fontSize: 14, color: C.dim }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ width: 1, height: 48, background: C.panelBd, flexShrink: 0 }} />
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: C.dim, letterSpacing: 1, marginBottom: 3 }}>ТЕМП. ЗОН</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {realTemps.map((t, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: ZONE_LABEL[i], marginBottom: 2 }}>З{i + 1}</div>
                <Seg value={t} unit="°C" width={62} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 1, height: 48, background: C.panelBd, flexShrink: 0 }} />
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: C.dim, letterSpacing: 1, marginBottom: 3 }}>ЛИСТ В ЗОНЕ 4</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,auto)', gap: '2px 8px', alignItems: 'center' }}>
            {['Плавка', 'Партия', 'Пачка', 'Лист'].map(l => <span key={l} style={{ fontSize: 14, color: C.dim }}>{l}</span>)}
            {[zones[3]?.melt || '──────', zones[3]?.batch || '───', zones[3]?.pack || '──', zones[3]?.sheet || '────'].map((v, i) => (
              <Seg key={i} value={v} width={i === 0 ? 68 : 40} />
            ))}
          </div>
        </div>
        <div style={{ width: 1, height: 48, background: C.panelBd, flexShrink: 0 }} />
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: C.dim, marginBottom: 3 }}>Марка / Толщ.</div>
          <Seg value={zones[3]?.grade || '──'} width={52} />
          <div style={{ height: 4 }} />
          <Seg value={zones[3]?.thick ?? '─.─'} unit="мм" width={52} />
        </div>
        <div style={{ width: 1, height: 48, background: C.panelBd, flexShrink: 0 }} />
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 18, color: C.dim, marginBottom: 3 }}>Параметры</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[['Скорость', speedDisplay, 'м/с'], ['Уст.темп.', tempSetDisplay, '°C'], ['Длина   ', lengthDisplay, 'м']].map(([l, v, u]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, color: C.dim, minWidth: 62 }}>{l}</span>
                <Seg value={v} unit={u} width={58} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginBottom: 2 }}>
            <ConnectionIndicator connected={connected} connecting={connecting} error={opcError} />
          </div>
          <div style={{ fontSize: 24, color: C.accent, fontWeight: 700, letterSpacing: 3 }}>{fmtClock(time)}</div>
          <div style={{ fontSize: 14, color: C.dim }}>{time.toLocaleDateString('ru-RU')}</div>
        </div>
      </div>

      {opcError && (
        <Alert severity="warning" sx={{ mb: 2, bgcolor: '#2d2200', color: T.warning }}>
          Нет подключения к OPC UA серверу. Данные могут быть устаревшими.
        </Alert>
      )}*/} 

      {/* ══ ТЕХНОЛОГИЧЕСКАЯ СХЕМА ЗАКАЛКИ (read‑only) ═══════════════════ */}
      <div style={{ background: C.panel, border: `2px solid ${C.panelBd}`, 
                    borderRadius: 6, 
                    padding: '8px 10px', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 5, flex: '3 1 0',minHeight: 0, }}>
        <div style={{ fontSize: 18, color: C.dim, letterSpacing: 1 }}>ТЕХНОЛОГИЧЕСКАЯ СХЕМА — ЛИНИЯ ЗАКАЛКИ</div>
        {/*  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            { label: 'Вход. рольганг', sheet: svgEntry, color: C.accent },
            { label: 'Зона 1', sheet: zones[0], color: '#f87171' },
            { label: 'Зона 2', sheet: zones[1], color: '#fb923c' },
            { label: 'Зона 3', sheet: zones[2], color: '#fbbf24' },
            { label: 'Зона 4', sheet: zones[3], color: '#a3e635' },
            { label: 'Закалка', sheet: qS, color: '#60a5fa' },
            { label: 'Охлаждение', sheet: cS, color: '#34d399' },
            { label: 'Выдача', sheet: liveData.output, color: '#a78bfa' },
          ].map(({ label, sheet, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#0d1117', border: `1px solid ${C.panelBd}`, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: sheet ? color : '#252a30', boxShadow: sheet ? `0 0 4px ${color}` : 'none' }} />
              <span style={{ fontSize: 18, color: C.dim }}>{label}:</span>
              <span style={{ fontSize: 18, color: sheet ? C.text : C.dim, fontFamily: 'monospace' }}>
                {sheet ? `${sheet.melt}/${sheet.batch}/${sheet.pack}/${sheet.sheet}` : '—'}
              </span>
            </div>
          ))}
        </div>*/}

        <svg width="100%" viewBox={`0 80 ${VW} 112`}  preserveAspectRatio="xMidYMid meet"  style={{ display: 'block', flex: 1, minHeight: 0, width: '100%'  }}>
          <defs>
            <style>{`
              @keyframes dashMove { to { stroke-dashoffset: -20; } }
              .flow-active { animation: dashMove 0.4s linear infinite; }
              @keyframes faultPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
              .valve-fault { animation: faultPulse 0.8s ease-in-out infinite; }
            `}</style>
            {ZONE_FILL.map((_, i) => (
              <linearGradient key={i} id={`gz${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ZONE_FILL[i]} stopOpacity={0.85} />
                <stop offset="100%" stopColor={ZONE_FILL[i]} />
              </linearGradient>
            ))}
            <linearGradient id="gq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#1e40af" />
            </linearGradient>
            <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.accent} /></marker>
            <marker id="arrGreen" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.green} /></marker>
          </defs>
          <line x1={0} y1={rY + rH + 6} x2={VW} y2={rY + rH + 6} stroke={C.panelBd} strokeWidth={1} />

          {/* Входной рольганг */}
          <text x={inX + inN * (rW + rGap) / 2} y={rY - 14} textAnchor="middle" fill={C.dim} fontSize={9}>Вход. рольганг</text>
          <Rollers x={inX} y={rY} count={inN} w={rW} gap={rGap} h={rH} />
          {svgEntry && (
            <SheetRect x={inX + 1} y={rY - 13} w={inN * (rW + rGap) - 4} h={13}
              label={`${svgEntry.melt}/${svgEntry.batch}/${svgEntry.pack}/${svgEntry.sheet}`} color={C.accent} />
          )}
          <line x1={inX + inN * (rW + rGap) + 2} y1={rY + rH / 2} x2={fX - 4} y2={rY + rH / 2}
            stroke={liveData.arrows.toFurnace ? C.green : C.accent}
            strokeWidth={liveData.arrows.toFurnace ? 2.5 : 1.5}
            strokeDasharray={liveData.arrows.toFurnace ? '6 4' : 'none'}
            className={liveData.arrows.toFurnace ? 'flow-active' : ''}
            markerEnd={liveData.arrows.toFurnace ? 'url(#arrGreen)' : 'url(#arr)'} />

          {/* 4 зоны нагрева */}
          {[0, 1, 2, 3].map(i => {
            const zx = zoneX(i);
            const sh = zones[i];
            const moving = liveData.arrows.zones[i];
            return (
              <g key={i}>
                <rect x={zx} y={rY - 42} width={zW} height={rH + 46} rx={3} fill={`url(#gz${i})`}
                  stroke={sh ? ZONE_STROKE[i] : '#2a2a2a'} strokeWidth={sh ? 2 : 1}
                  style={sh ? { filter: `drop-shadow(0 0 3px ${ZONE_STROKE[i]}55)` } : {}} />
                <text x={zx + zW / 2} y={rY - 30} textAnchor="middle" fill={ZONE_LABEL[i]} fontSize={9} fontWeight={700}>ЗОНА {i + 1} НАГРЕВА</text>
                <text x={zx + zW / 2} y={rY - 14} textAnchor="middle" fill={ZONE_LABEL[i]} fontSize={13} fontWeight={700}>{realTemps[i]} °C</text>
                {sh ? (
                  <SheetRect x={zx + 5} y={rY - 1} w={zW - 10} h={rH - 4}
                    label={`${sh.melt}/${sh.batch}/${sh.pack}/${sh.sheet}`} color={ZONE_FILL[i]} />
                ) : (
                  <text x={zx + zW / 2} y={rY + rH / 2 + 4} textAnchor="middle" fill="#333" fontSize={9}>— пусто —</text>
                )}
                {i < 3 && (
                  <line x1={zx + zW + 1} y1={rY + rH / 2} x2={zoneX(i + 1) - 2} y2={rY + rH / 2}
                    stroke={moving ? C.green : '#2a2a2a'} strokeWidth={moving ? 2 : 1}
                    strokeDasharray={moving ? '5 3' : 'none'} className={moving ? 'flow-active' : ''}
                    markerEnd={moving ? 'url(#arrGreen)' : ''} />
                )}
              </g>
            );
          })}
          <rect x={fX - 3} y={rY - 46} width={furnW + 6} height={rH + 54} rx={4} fill="none" stroke="#3a3a3a" strokeWidth={1} strokeDasharray="5,3" />
          <text x={fX + furnW / 2} y={rY + rH + 26} textAnchor="middle" fill="#3a3a3a" fontSize={9} letterSpacing={5}>П Е Ч Ь   З А К А Л К И</text>
          {(() => {
            const moving = liveData.arrows.zones[3];
            return (
              <line x1={fX + furnW + 4} y1={rY + rH / 2} x2={qX - 4} y2={rY + rH / 2}
                stroke={moving ? C.green : C.accent} strokeWidth={moving ? 2.5 : 1.5}
                strokeDasharray={moving ? '6 4' : 'none'} className={moving ? 'flow-active' : ''}
                markerEnd={moving ? 'url(#arrGreen)' : 'url(#arr)'} />
            );
          })()}

          {/* Закалка */}
          <rect x={qX} y={rY - 42} width={qW} height={rH + 46} rx={3} fill="url(#gq)"
            stroke={qS ? '#3b82f6' : '#1e2a3a'} strokeWidth={qS ? 2 : 1}
            style={qS ? { filter: 'drop-shadow(0 0 3px #3b82f655)' } : {}} />
          <text x={qX + qW / 2} y={rY - 30} textAnchor="middle" fill="#93c5fd" fontSize={9} fontWeight={700}>ЗАКАЛКА</text>
          {topValves.map((st, i) => {
            const cx = qX + 10 + i * ((qW - 20) / 8);
            return <g key={`qtv${i}`} className={st === 6 ? 'valve-fault' : ''}><ValveLed cx={cx} cy={rY - 8} state={st} r={4} /></g>;
          })}
          <Nozzles9 x={qX + 5} y={rY - 4} active={!!qS} side="top" />
          <Nozzles9 x={qX + 5} y={rY + rH + 6} active={!!qS} side="bottom" />
          {qS
            ? <SheetRect x={qX + 5} y={rY - 1} w={qW - 10} h={rH - 4} label={`${qS.melt}/${qS.batch}/${qS.pack}/${qS.sheet}`} color="#1e3a8a" />
            : <text x={qX + qW / 2} y={rY + rH / 2 + 4} textAnchor="middle" fill="#252a50" fontSize={9}>— пусто —</text>}
          {bottomValves.map((st, i) => {
            const cx = qX + 10 + i * ((qW - 20) / 8);
            return <g key={`qbv${i}`} className={st === 6 ? 'valve-fault' : ''}><ValveLed cx={cx} cy={rY + rH + 8} state={st} r={4} /></g>;
          })}
          <text x={qX - 2} y={rY - 5} textAnchor="end" fill="#60a5fa" fontSize={7} fontWeight={700}>ВЕРХ</text>
          <text x={qX - 2} y={rY + rH + 11} textAnchor="end" fill="#60a5fa" fontSize={7} fontWeight={700}>НИЗ</text>
          <line x1={qX + qW + 4} y1={rY + rH / 2} x2={outX - 4} y2={rY + rH / 2} stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)" />

          {/* Охлаждение */}
          <text x={outX + outN * (rW + rGap) / 2} y={rY - 14} textAnchor="middle" fill={C.dim} fontSize={14}>Охлаждение</text>
          <Rollers x={outX} y={rY} count={outN} w={rW} gap={rGap} h={rH} />
          {cS && (
            <SheetRect x={outX + 1} y={rY - 13} w={outN * (rW + rGap) - 4} h={13}
              label={`${cS.melt}/${cS.batch}/${cS.pack}/${cS.sheet}`} color="#0e4a6b" />
          )}
          <line x1={outX + outN * (rW + rGap) + 4} y1={rY + rH / 2} x2={finX - 10} y2={rY + rH / 2} stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)" />

          {/* Выдача */}
          <text x={(finX + finN * (rW + rGap) / 2) - 10} y={rY - 14} textAnchor="middle" fill={C.dim} fontSize={14}>Выдача</text>
          <Rollers x={finX - 10} y={rY} count={finN} w={rW} gap={rGap} h={rH} />
          {liveData.output && (
            <g>
              <SheetRect x={finX - 10 + 1} y={rY - 13} w={finN * (rW + rGap) - 4} h={13}
                label={`${liveData.output.melt}/${liveData.output.batch}/${liveData.output.pack}/${liveData.output.sheet}`} color="#2d1f4a" />
              {liveData.output.isDefect && (
                <text x={finX - 10 + finN * (rW + rGap) / 2} y={rY + 14} textAnchor="middle" fill={C.red} fontSize={10} fontWeight={700}>⚠ БРАК</text>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* ══ ПЕЧИ ОТПУСКА (read‑only) ════════════════════════════════════ */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1, mt: 0, flexShrink: 0  }}>
        <LocalFireDepartmentIcon sx={{ color: T.accent, fontSize: '1.1rem' }} />
        <Typography sx={{ color: T.textPrimary, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: T.sansFont }}>
          Печи отпуска
        </Typography>
      </Stack>
      <Box sx={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2,
        flex: '4 1 0',     // ← забирает 4/7 свободного места
        minHeight: 0,      // ← позволяет сжиматься и не вылезать за экран
        '@media (max-width:1100px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
        '@media (max-width:600px)': { gridTemplateColumns: '1fr' },
        }}>
        {FURNACES.map(no => (
          <FurnaceCard key={no} furnaceNo={no} plcData={getPlcData(no)} activeSessions={getSessionsByFurnace(no)} />
        ))}
      </Box>
    </Box>
  );
}