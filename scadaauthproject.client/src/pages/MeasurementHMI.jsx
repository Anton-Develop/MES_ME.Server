// src/pages/MeasurementHMI.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Grid, Typography, TextField, Button,
  Divider, Stack, Alert, CircularProgress, Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../api';
import { useOpcUa } from '../hooks/useOpcUa';

// ── Константы цветов ───────────────────────────────────────────────────────
const valueColor = (v) => {
  if (v == null) return 'text.disabled';
  const abs = Math.abs(v);
  if (abs > 1.0) return 'error.main';
  if (abs > 0.5) return 'warning.main';
  return 'success.main';
};

// ── Поле ввода одной точки ─────────────────────────────────────────────────
const HInput = ({ label, value, onChange, disabled }) => (
  <Box sx={{ textAlign: 'center' }}>
    <Typography variant="caption" color="text.secondary" display="block">
      {label}
    </Typography>
    <TextField
      size="small"
      type="number"
      inputProps={{
        step: 0.1,
        style: { textAlign: 'center', fontFamily: 'monospace', fontSize: 16 }
      }}
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      disabled={disabled}
      sx={{
        width: 70,
        '& .MuiInputBase-root': {
          bgcolor: value != null ? 'background.paper' : 'action.hover',
          border: value != null ? '1px solid' : '1px solid transparent',
          borderColor: valueColor(value),
        }
      }}
    />
  </Box>
);

// ── Сетка 8 точек ──────────────────────────────────────────────────────────
const MeasurementGrid = ({ values, onChange, disabled, title }) => {
  const h = (name) => (
    <HInput
      label={name.toUpperCase()}
      value={values[name]}
      onChange={v => onChange(name, v)}
      disabled={disabled}
    />
  );

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" color="primary" gutterBottom align="center">
        {title}
      </Typography>
      <Grid container spacing={1} alignItems="center" justifyContent="center">
        <Grid item>{h('h1')}</Grid>
        <Grid item>{h('h2')}</Grid>
        <Grid item>{h('h3')}</Grid>
        <Grid item xs={12} />
        <Grid item>{h('h8')}</Grid>
        <Grid item sx={{ width: 70 }} />
        <Grid item>{h('h4')}</Grid>
        <Grid item xs={12} />
        <Grid item>{h('h7')}</Grid>
        <Grid item>{h('h6')}</Grid>
        <Grid item>{h('h5')}</Grid>
      </Grid>
    </Paper>
  );
};

// ── Пустая сетка ───────────────────────────────────────────────────────────
const emptyGrid = () => ({
  h1: null, h2: null, h3: null, h4: null,
  h5: null, h6: null, h7: null, h8: null,
});

// ── Helpers ────────────────────────────────────────────────────────────────
const toStr = v => (v === null || v === undefined) ? null : String(v);
const toNum = v => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

// ── Уникальный ключ листа ─────────────────────────────────────────────────
const sheetKey = (s) => {
  if (!s) return null;
  return `${s.melt ?? '?'}/${s.partNo ?? '?'}/${s.pack ?? '?'}/${s.sheet ?? '?'}`;
};

// ── Основной компонент ─────────────────────────────────────────────────────
export default function MeasurementHMI() {
  // ── OPC UA подписка на X2 ─────────────────────────────────────────────
  const { values, connected } = useOpcUa([
    'X2_ZoneOccup',    // признак присутствия листа
    'X2_Melt',         // плавка
    'X2_Slab',         // сляб
    'X2_PartNo',       // партия
    'X2_Pack',         // пачка
    'X2_Sheet',        // лист
    'X2_SubSheet',     // подлист
    'X2_Thikness',     // толщина (текст)
    'X2_SheetInPack',  // листов в пачке
    'X2_SeqNo',        // порядковый номер
    'X2_AlloyCodeText',// марка сплава
    'X2_PlatePos',     // позиция плиты
    'X2_State',        // состояние
  ]);

  // ── Состояния ─────────────────────────────────────────────────────────
  const [currentSheet, setCurrentSheet]   = useState(null);  // данные листа из OPC
  const [dbRecord, setDbRecord]           = useState(null);  // запись в БД (если есть)
  const [before, setBefore]               = useState(emptyGrid());
  const [after, setAfter]                = useState(emptyGrid());
  const [saving, setSaving]               = useState(false);
  const [message, setMessage]             = useState(null);
  const [opcSheetKey, setOpcSheetKey]     = useState(null);  // ключ текущего листа в X2

  // ── Извлечение данных листа из OPC ───────────────────────────────────
  useEffect(() => {
    const occ = toNum(values['X2_ZoneOccup']?.value);  // ZoneOccup в X2
    
    if (occ === 1 || occ === true) {
      // Лист присутствует в X2
      const sheet = {
        melt:          toNum(values['X2_Melt']?.value),
        slab:          toNum(values['X2_Slab']?.value),
        partNo:        toNum(values['X2_PartNo']?.value),
        pack:          toNum(values['X2_Pack']?.value),
        sheet:         toNum(values['X2_Sheet']?.value),
        subSheet:      toNum(values['X2_SubSheet']?.value),
        sheetInPack:   toNum(values['X2_SheetInPack']?.value),
        thickness:     toStr(values['X2_Thikness']?.value),
        alloyCodeText: toStr(values['X2_AlloyCodeText']?.value),
        seqNo:         toNum(values['X2_SeqNo']?.value),
        platePos:      toStr(values['X2_PlatePos']?.value),
        state:         toStr(values['X2_State']?.value),
      };

      const key = sheetKey(sheet);
      
      // Только если лист изменился — обновляем состояние
      if (key && key !== opcSheetKey) {
        setOpcSheetKey(key);
        setCurrentSheet(sheet);
        setDbRecord(null);      // сбросим, пока не загрузим из БД
        setBefore(emptyGrid());
        setAfter(emptyGrid());
        console.log('[MeasurementHMI] Новый лист в X2:', sheet);
      }
    } else {
      // Лист ушёл из X2
      if (opcSheetKey !== null) {
        setOpcSheetKey(null);
        setCurrentSheet(null);
        setDbRecord(null);
        setBefore(emptyGrid());
        setAfter(emptyGrid());
        console.log('[MeasurementHMI] Лист покинул X2');
      }
    }
  }, [values, opcSheetKey]);

  // ── Загрузка/создание записи в БД при появлении нового листа ──────────
  useEffect(() => {
    if (!currentSheet) return;

    const loadOrCreateRecord = async () => {
      try {
        // Пробуем найти существующую запись
        const res = await api.get('/measurement/current', {
          params: {
            melt:    currentSheet.melt,
            partNo:  currentSheet.partNo,
            pack:    currentSheet.pack,
            sheet:   currentSheet.sheet,
          }
        });
        setDbRecord(res.data);
        
        // Если замеры уже есть — подгружаем их в форму
        if (res.data) {
          const b = {}, a = {};
          for (let i = 1; i <= 8; i++) {
            b[`h${i}`] = res.data[`h${i}_before`] ?? null;
            a[`h${i}`] = res.data[`h${i}_after`]  ?? null;
          }
          setBefore(b);
          setAfter(a);
        }
      } catch (err) {
        // Если записи нет — создаём новую
        if (err.response?.status === 404) {
          try {
            const createRes = await api.post('/measurement', {
              melt:          currentSheet.melt,
              slab:          currentSheet.slab,
              partNo:        currentSheet.partNo,
              pack:          currentSheet.pack,
              sheet:         currentSheet.sheet,
              sheetInPack:   currentSheet.sheetInPack,
              thickness:     currentSheet.thickness,
              alloyCodeText: currentSheet.alloyCodeText,
              enteredX2At:   new Date().toISOString(),
            });
            setDbRecord(createRes.data);
            setMessage({ type: 'info', text: 'Создана новая запись измерений' });
          } catch (createErr) {
            console.error('Ошибка создания записи:', createErr);
            setMessage({ type: 'error', text: 'Ошибка создания записи измерений' });
          }
        } else {
          console.error('Ошибка загрузки записи:', err);
        }
      }
    };

    loadOrCreateRecord();
  }, [currentSheet]);

  // ── Сохранение замеров ────────────────────────────────────────────────
  const handleSaveMeasurement = async () => {
    if (!dbRecord?.id) {
      setMessage({ type: 'error', text: 'Нет записи для сохранения' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        h1Before: before.h1, h2Before: before.h2, h3Before: before.h3,
        h4Before: before.h4, h5Before: before.h5, h6Before: before.h6,
        h7Before: before.h7, h8Before: before.h8,
        h1After:  after.h1,  h2After:  after.h2,  h3After:  after.h3,
        h4After:  after.h4,  h5After:  after.h5,  h6After:  after.h6,
        h7After:  after.h7,  h8After:  after.h8,
        measuredBy: localStorage.getItem('username') || 'operator',
        measuredAt: new Date().toISOString(),
      };

      const res = await api.put(`/measurement/${dbRecord.id}`, payload);
      setDbRecord(res.data);
      setMessage({ type: 'success', text: '✅ Измерения сохранены' });
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      setMessage({ type: 'error', text: '❌ Ошибка сохранения измерений' });
    } finally {
      setSaving(false);
    }
  };

  // ── Проверка, заполнены ли все 16 точек ──────────────────────────────
  const allMeasured = () => {
    for (let i = 1; i <= 8; i++) {
      if (before[`h${i}`] == null || after[`h${i}`] == null) return false;
    }
    return true;
  };

  const alreadyMeasured = dbRecord?.measured_at != null;

  // ── Рендер ────────────────────────────────────────────────────────────
  const s = currentSheet;

  return (
    <Box sx={{ p: 2, maxWidth: 950, mx: 'auto' }}>

      {/* Сообщения */}
      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 1 }}>
          {message.text}
        </Alert>
      )}

      {/* Статус OPC */}
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={connected ? 'OPC UA подключён' : 'OPC UA отключён'}
          color={connected ? 'success' : 'error'}
          size="small"
          variant="outlined"
        />
        {s && (
          <Chip
            label={`Лист в X2: ${sheetKey(s)}`}
            color="primary"
            size="small"
          />
        )}
        {alreadyMeasured && (
          <Chip
            label="Измерено"
            color="success"
            size="small"
            icon={<CheckCircleIcon />}
          />
        )}
      </Box>

      {/* Параметры листа */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: s ? '#1a237e' : '#424242', color: '#fff' }}>
        <Typography variant="subtitle1" align="center" fontWeight={700} gutterBottom>
          Параметры листа на позиции X2
        </Typography>
        {s ? (
          <Grid container spacing={2} justifyContent="center">
            {[
              ['Плавка №',        s.melt],
              ['Сляб',            s.slab],
              ['Партия',          s.partNo],
              ['Пачка',           s.pack],
              ['Лист',            `${s.sheet} / ${s.subSheet ?? '-'}`],
              ['Марка',           s.alloyCodeText ?? '—'],
              ['Толщина',         s.thickness ? `${s.thickness} мм` : '—'],
              ['Листов в пачке',  s.sheetInPack],
              ['SeqNo',           s.seqNo],
              ['Состояние X2',    s.state],
            ].map(([label, value]) => (
              <Grid item key={label} sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>{label}</Typography>
                <Typography variant="body1" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                  {value ?? '—'}
                </Typography>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography align="center" sx={{ opacity: 0.7 }}>
            Ожидание листа на X2...
          </Typography>
        )}
      </Paper>

      {/* Сетка измерений */}
      {s && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <MeasurementGrid
              title="До кантовки"
              values={before}
              onChange={(k, v) => setBefore(p => ({ ...p, [k]: v }))}
              disabled={saving || alreadyMeasured}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MeasurementGrid
              title="После кантовки"
              values={after}
              onChange={(k, v) => setAfter(p => ({ ...p, [k]: v }))}
              disabled={saving || alreadyMeasured}
            />
          </Grid>
        </Grid>
      )}

      {/* Кнопки действий */}
      {s && (
        <Box sx={{ mb: 2, textAlign: 'center' }}>
          {!alreadyMeasured ? (
            <Button
              variant="contained"
              size="large"
              color="primary"
              onClick={handleSaveMeasurement}
              disabled={saving || !allMeasured()}
              sx={{ minWidth: 260, fontSize: 16 }}
            >
              {saving ? (
                <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" />
              ) : null}
              {allMeasured() ? '💾 Сохранить измерения' : '⚠ Заполните все 16 точек'}
            </Button>
          ) : (
            <Alert severity="success" sx={{ display: 'inline-flex' }}>
              Измерения сохранены —{' '}
              {new Date(dbRecord.measured_at).toLocaleString('ru-RU')}
            </Alert>
          )}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Информация о записи в БД */}
      {dbRecord && (
        <Paper sx={{ p: 2, bgcolor: '#263238', color: '#fff' }}>
          <Typography variant="subtitle2" gutterBottom>
            Запись в БД (sheet_measurements)
          </Typography>
          <Grid container spacing={1}>
            {[
              ['ID записи',   dbRecord.id],
              ['Создана',     dbRecord.created_at ? new Date(dbRecord.created_at).toLocaleString('ru-RU') : '—'],
              ['Вход в X2',   dbRecord.entered_x2_at ? new Date(dbRecord.entered_x2_at).toLocaleString('ru-RU') : '—'],
              ['Измерена',    dbRecord.measured_at ? new Date(dbRecord.measured_at).toLocaleString('ru-RU') : '—'],
              ['Оператор',    dbRecord.measured_by ?? '—'],
            ].map(([label, val]) => (
              <Grid item xs={6} sm={4} key={label}>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>{label}</Typography>
                <Typography fontFamily="monospace">{val}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  );
}