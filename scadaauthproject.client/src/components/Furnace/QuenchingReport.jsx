// src/components/Quenching/QuenchingReport.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Chip, Divider, Button,
  CircularProgress, Alert, Stack,
} from '@mui/material';
import { Print, GetApp, ArrowBack } from '@mui/icons-material';
import { quenchingApi } from '../../api/quenchingApi';

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
const fmtDate = (d) => d
  ? new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  : '—';

const fmtSec = (v) => {
  if (v == null) return '—';
  const s = Math.round(v);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m} мин ${sec} с` : `${sec} с`;
};

const fmtVal = (v, dec = 2, unit = '') =>
  v != null ? `${Number(v).toFixed(dec)}${unit ? ' ' + unit : ''}` : null;

// ---------------------------------------------------------------------------
// Парсинг unlock: строка типа "0000111111" -> массив boolean длиной 10
// '1' = клапан разблокирован (выбран для работы)
// ---------------------------------------------------------------------------
const parseUnlock = (str) => {
  if (!str) return Array(10).fill(false);
  return Array.from(String(str).padEnd(10, '0')).map(ch => ch === '1');
};

// ---------------------------------------------------------------------------
// Парсинг mnat: JSON-строка вида "[0,0,0,0,1,1,1,1,1,0]" -> объект {1: val, ...}
// ---------------------------------------------------------------------------
const extractValveStates = (jsonb) => {
  if (!jsonb) return {};
  let arr;
  if (typeof jsonb === 'string') {
    try { arr = JSON.parse(jsonb); } catch { return {}; }
  } else if (Array.isArray(jsonb)) {
    arr = jsonb;
  } else {
    return {};
  }
  const result = {};
  arr.forEach((v, i) => { result[i + 1] = Number(v); });
  return result;
};

// ---------------------------------------------------------------------------
// Конфигурация состояний клапана: MnAt: 1=Открыт, 0=Закрыт, 6=Авария
// ---------------------------------------------------------------------------
const VALVE_STATES = {
  1: { label: 'Открыт', color: '#1565c0', bg: '#e3f2fd', border: '#1565c0' },
  0: { label: 'Закрыт', color: '#546e7a', bg: '#eceff1', border: '#90a4ae' },
  6: { label: 'Авария', color: '#c62828', bg: '#ffebee', border: '#c62828' },
};
const VALVE_LOCKED = { label: 'Блок.',  color: '#9e9e9e', bg: '#fafafa', border: '#e0e0e0' };
const VALVE_UNKNOWN = { label: '—',     color: '#bdbdbd', bg: '#f5f5f5', border: '#e0e0e0' };

// ---------------------------------------------------------------------------
// SVG-схема клапанов (10 верх + 10 низ)
// ---------------------------------------------------------------------------
const ValveDiagram = ({ mnAt1, mnAt2, unlock1, unlock2 }) => {
  const states1 = useMemo(() => extractValveStates(mnAt1), [mnAt1]);
  const states2 = useMemo(() => extractValveStates(mnAt2), [mnAt2]);
  const unlocked1 = useMemo(() => parseUnlock(unlock1), [unlock1]);
  const unlocked2 = useMemo(() => parseUnlock(unlock2), [unlock2]);

  const CELL    = 52;
  const GAP     = 6;
  const LABEL_W = 72;
  const ROW_H   = CELL + 8;
  const W       = LABEL_W + 10 * (CELL + GAP) - GAP + 4;
  const H       = 2 * ROW_H + 16;

  const rows = [
    { label: 'Верх (1x)', states: states1, unlocked: unlocked1, y: 8 },
    { label: 'Низ (2x)',  states: states2, unlocked: unlocked2, y: 8 + ROW_H },
  ];

  return (
    <Box sx={{ overflowX: 'auto', mt: 1 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', maxWidth: W, display: 'block', minWidth: 480 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {rows.map(({ label, states, unlocked, y }) => (
          <g key={label}>
            <text
              x={LABEL_W - 6} y={y + CELL / 2 + 4}
              textAnchor="end" fontSize={11}
              fill="#555" fontFamily="Roboto,sans-serif" fontWeight="500"
            >
              {label}
            </text>
            {Array.from({ length: 10 }, (_, i) => {
              const idx  = i + 1;
              const isLocked = !unlocked[i];   // unlocked – массив boolean
              const stateVal = states[idx];
              const s    = isLocked
                ? VALVE_LOCKED
                : (VALVE_STATES[stateVal] ?? VALVE_UNKNOWN);
              const x    = LABEL_W + i * (CELL + GAP);

              return (
                <g key={idx}>
                  <rect
                    x={x} y={y} width={CELL} height={CELL}
                    rx={7} ry={7}
                    fill={s.bg}
                    stroke={s.border}
                    strokeWidth={isLocked ? 1 : 2}
                  />
                  <text
                    x={x + CELL / 2} y={y + 18}
                    textAnchor="middle" fontSize={13}
                    fontWeight="700" fill={s.color}
                    fontFamily="Roboto,sans-serif"
                  >
                    {idx}
                  </text>
                  <text
                    x={x + CELL / 2} y={y + 34}
                    textAnchor="middle" fontSize={9}
                    fill={s.color} fontFamily="Roboto,sans-serif"
                  >
                    {s.label}
                  </text>
                  {!isLocked && stateVal != null && (
                    <circle
                      cx={x + CELL - 9} cy={y + 9} r={4}
                      fill={s.color}
                      opacity={0.85}
                    />
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Позиция клапана: задание vs факт
// ---------------------------------------------------------------------------
const ValvePositionRow = ({ label, posRef, posFbk }) => {
  const diff = (posRef != null && posFbk != null) ? Math.abs(posRef - posFbk) : null;
  const diffColor = diff == null
    ? 'text.disabled'
    : diff > 5 ? 'error.main' : diff > 2 ? 'warning.main' : 'success.main';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.5, flexWrap: 'wrap' }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Box>
          <Typography variant="caption" color="text.disabled" display="block">Задание</Typography>
          <Typography variant="body2" fontWeight={600} fontFamily="monospace">
            {posRef != null ? `${Number(posRef).toFixed(1)} %` : '—'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.disabled" display="block">Факт</Typography>
          <Typography variant="body2" fontWeight={600} fontFamily="monospace">
            {posFbk != null ? `${Number(posFbk).toFixed(1)} %` : '—'}
          </Typography>
        </Box>
        {diff != null && (
          <Box>
            <Typography variant="caption" color="text.disabled" display="block">Откл.</Typography>
            <Typography variant="body2" fontWeight={700} fontFamily="monospace" color={diffColor}>
              {diff.toFixed(1)} %
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Строка метрики в карточке
// ---------------------------------------------------------------------------
const MetricRow = ({ label, value, accent }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.35 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography
      variant="caption" fontWeight={700} fontFamily="monospace"
      sx={{ color: value != null ? (accent ?? 'text.primary') : 'text.disabled' }}
    >
      {value ?? '—'}
    </Typography>
  </Box>
);

// ---------------------------------------------------------------------------
// Основной компонент
// ---------------------------------------------------------------------------
const QuenchingReport = () => {
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
        const res = await quenchingApi.getSessionByKey(key);
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

  const s = session;

  return (
    <Box sx={{
      p: 3,
      '@media print': {
        p: 1,
        '& .no-print': { display: 'none !important' },
      },
    }}>
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
          onClick={() => window.open(`/quenching/report?key=${encodeURIComponent(key)}&print=true`, '_blank')}
        >
          PDF (новая вкладка)
        </Button>
      </Box>

      {/* Шапка */}
      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap">
          <Typography variant="h5" fontWeight={700}>
            Отчёт о закалке листа №{s.sheet}
          </Typography>
          {s.reheatNum > 0 && (
            <Chip label={`Повторная закалка №${s.reheatNum}`} color="warning" size="small" />
          )}
          {s.hadAlarm && <Chip label="АВАРИЯ" color="error" size="small" />}
        </Stack>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {[
            { label: 'Лист',        value: s.sheet },
            { label: 'Сляб',        value: s.slab      ?? '—' },
            { label: 'Плавка',      value: s.melt      ?? '—' },
            { label: 'Партия',      value: s.partNo    ?? '—' },
            { label: 'Пачка',       value: s.pack      ?? '—' },
            { label: 'Марка стали', value: s.alloyCodeText || s.alloyCode || '—' },
            { label: 'Толщина',     value: s.thickness != null ? `${Number(s.thickness).toFixed(1)} мм` : '—' },
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
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="caption" color="text.secondary">Вход в закалку</Typography>
            <Typography variant="body2" fontWeight={600}>{fmtDate(s.enteredAt)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="caption" color="text.secondary">Выход из закалки</Typography>
            <Typography variant="body2" fontWeight={600}>{fmtDate(s.exitedAt)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="caption" color="text.secondary">Время закалки</Typography>
            <Typography variant="body2" fontWeight={700} color="info.dark">
              {fmtSec(s.totalSec)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Давления и температуры */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* Закалка */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%', borderTop: '3px solid #1565c0', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} color="#1565c0" gutterBottom>
              Давление — закалка
            </Typography>
            <MetricRow label="Верх (закалка)"  value={fmtVal(s.pressTopZak, 2, 'МПа')} />
            <MetricRow label="Низ (закалка)"   value={fmtVal(s.pressBotZak, 2, 'МПа')} />
            <Divider sx={{ my: 1 }} />
           {/*  <MetricRow label="Секция 9"   value={fmtVal(s.press9, 2, 'МПа')} />
            <MetricRow label="Секция 10"  value={fmtVal(s.press10, 2, 'МПа')} />
            <MetricRow label="Секция 11"  value={fmtVal(s.press11, 2, 'МПа')} />
            <MetricRow label="Секция 12"  value={fmtVal(s.press12, 2, 'МПа')} />*/}
          </Paper>
        </Grid>

        {/* Ламинарное охлаждение */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%', borderTop: '3px solid #00695c', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} color="#00695c" gutterBottom>
              Давление — ламинарное охлаждение
            </Typography>
            <MetricRow label="Ламинарка 1 — верх" value={fmtVal(s.pressTopLamin1, 2, 'МПа')} />
            <MetricRow label="Ламинарка 1 — низ"  value={fmtVal(s.pressBotLamin1, 2, 'МПа')} />
            <Divider sx={{ my: 1 }} />
            <MetricRow label="Ламинарка 2 — верх" value={fmtVal(s.pressTopLamin2, 2, 'МПа')} />
            <MetricRow label="Ламинарка 2 — низ"  value={fmtVal(s.pressBotLamin2, 2, 'МПа')} />
            <Divider sx={{ my: 1 }} />
            <MetricRow label="Воздух (гидроакк.)" value={fmtVal(s.airPrs, 2, 'МПа')} />
          </Paper>
        </Grid>

        {/* Температуры и уровни */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%', borderTop: '3px solid #bf360c', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} color="#bf360c" gutterBottom>
              Температуры воды и уровни
            </Typography>
            <MetricRow label="Ламинарка 1 — верх" value={fmtVal(s.tempTopLam1, 1, '°C')} accent="#1565c0" />
            <MetricRow label="Ламинарка 1 — низ"  value={fmtVal(s.tempBotLam1, 1, '°C')} accent="#1565c0" />
            <MetricRow label="Ламинарка 2 — верх" value={fmtVal(s.tempTopLam2, 1, '°C')} accent="#00695c" />
            <MetricRow label="Ламинарка 2 — низ"  value={fmtVal(s.tempBotLam2, 1, '°C')} accent="#00695c" />
            <Divider sx={{ my: 1 }} />
            <MetricRow label="Градирня"           value={fmtVal(s.tempGrad,   1, '°C')} />
            <MetricRow label="Гидроаккумулятор"   value={fmtVal(s.tempHaccum, 1, '°C')} />
            <Divider sx={{ my: 1 }} />
            <MetricRow label="Уровень — гидроакк."    value={fmtVal(s.levelHaccum, 1, '%')} />
            <MetricRow label="Уровень — приёмный бак" value={fmtVal(s.levelTank,   1, '%')} />
          </Paper>
        </Grid>
      </Grid>

      {/* Позиции клапанов */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
          Позиции клапанов — задание / факт
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Клапан X1 (закалка)
            </Typography>
            <ValvePositionRow label="Верх" posRef={s.valveX1UpPosRef}   posFbk={s.valveX1UpPosFbk}   />
            <ValvePositionRow label="Низ"  posRef={s.valveX1DownPosRef} posFbk={s.valveX1DownPosFbk} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Клапан X2.1 (ламинарка 1)
            </Typography>
            <ValvePositionRow label="Верх" posRef={s.valveX2_1UpPosRef}   posFbk={s.valveX2_1UpPosFbk}   />
            <ValvePositionRow label="Низ"  posRef={s.valveX2_1DownPosRef} posFbk={s.valveX2_1DownPosFbk} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Клапан X2.2 (ламинарка 2)
            </Typography>
            <ValvePositionRow label="Верх" posRef={s.valveX2_2UpPosRef}   posFbk={s.valveX2_2UpPosFbk}   />
            <ValvePositionRow label="Низ"  posRef={s.valveX2_2DownPosRef} posFbk={s.valveX2_2DownPosFbk} />
          </Grid>
        </Grid>
      </Paper>

      {/* Схема клапанов быстрого охлаждения */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Клапаны быстрого охлаждения
          </Typography>
          <Stack direction="row" spacing={2} mt={0.75} flexWrap="wrap" useFlexGap>
            {Object.entries(VALVE_STATES).map(([k, st]) => (
              <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{
                  width: 12, height: 12, borderRadius: '3px',
                  bgcolor: st.bg, border: `2px solid ${st.border}`,
                }} />
                <Typography variant="caption" color="text.secondary">{st.label}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                width: 12, height: 12, borderRadius: '3px',
                bgcolor: VALVE_LOCKED.bg, border: `1px solid ${VALVE_LOCKED.border}`,
              }} />
              <Typography variant="caption" color="text.secondary">Заблокирован</Typography>
            </Box>
          </Stack>
        </Box>

        <ValveDiagram
          mnAt1={s.valves1Mnat}
          mnAt2={s.valves2Mnat}
          unlock1={s.valves1Unlock}
          unlock2={s.valves2Unlock}
        />
      </Paper>

      <Typography variant="caption" color="text.disabled" display="block" textAlign="right" mt={2}>
        Отчёт сформирован: {fmtDate(new Date())} | business_key: {key}
      </Typography>
    </Box>
  );
};

export default QuenchingReport;