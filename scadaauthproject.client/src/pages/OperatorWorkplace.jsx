import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useOpcUa } from '../hooks/useOpcUa';

const C = {
  bg: '#0d1117', panel: '#161b22', panelBd: '#30363d',
  text: '#e6edf3', dim: '#7d8590', accent: '#58a6ff',
  green: '#3fb950', red: '#f85149', yellow: '#d29922',
  inputBg: '#21262d', btnBg: '#1565c0', btnDis: '#37474f',
};

const emptyGrid = () => Array.from({ length: 8 }, () => null);
const bdrColor = v => {
  if (v == null) return C.panelBd;
  const a = Math.abs(v);
  return a > 1.0 ? C.red : a > 0.5 ? C.yellow : C.green;
};
const fmtWait = m => m == null ? '—' : m < 1 ? '<1м' : m < 60 ? `${Math.round(m)}м` : `${Math.floor(m/60)}ч`;

// ── Ячейка замера ─────────────────────────────────────────────────────
function HCell({ label, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{label}</span>
      <input
        type="number" step="0.1" disabled={disabled}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        style={{
          width: 80, height: 45, textAlign: 'center', fontFamily: 'monospace',
          fontSize: 20, fontWeight: 700,
          color: value != null ? C.text : C.dim,
          background: C.inputBg,
          border: `3px solid ${bdrColor(value)}`,
          borderRadius: 6, padding: 4, outline: 'none',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
    </div>
  );
}

// ── Сетка 8 точек ─────────────────────────────────────────────────────
function MeasGrid({ title, values, onChange, disabled }) {
  const c = (idx, name) => (
    <HCell key={name} label={name.toUpperCase()} value={values[idx]}
      onChange={v => onChange(idx, v)} disabled={disabled} />
  );
  return (
    <div style={{
      flex: 1, background: C.panel, border: `1px solid ${C.panelBd}`,
      borderRadius: 8, padding: '12px 16px',
    }}>
      <div style={{
        textAlign: 'center', fontSize: 14, fontWeight: 700, color: C.accent,
        marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.5,
      }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr 70px', gap: 6, marginBottom: 6 }}>
        <div />{c(0,'h1')}{c(1,'h2')}{c(2,'h3')}<div />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 70px', gap: 6, marginBottom: 6 }}>
        {c(7,'h8')}
        <div style={{ height: 45, border: `2px dashed ${C.panelBd}`, borderRadius: 6, opacity: 0.3,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: C.dim, fontSize: 10 }}>ЛИСТ</span>
        </div>
        {c(3,'h4')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr 70px', gap: 6 }}>
        <div />{c(6,'h7')}{c(5,'h6')}{c(4,'h5')}<div />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
export default function OperatorWorkplace() {
  const { connected } = useOpcUa(['X2_ZoneOccup']);

  // ── Очередь измерения ──
  const [queue, setQueue] = useState([]);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [before, setBefore] = useState(emptyGrid());
  const [after, setAfter] = useState(emptyGrid());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // ── Кассета ──
  const [currentCassette, setCurrentCassette] = useState(null); // { businessKey, sheets: [] }
  const [cassetteNumber, setCassetteNumber] = useState('');
  const [furnacesStatus, setFurnacesStatus] = useState([]);
  const [furnaceForFinish, setFurnaceForFinish] = useState(1);

  // ── Загрузка очереди ──
  const fetchQueue = useCallback(async () => {
    try {
      const res = await api.get('/measurement/queue');
      setQueue(res.data);
    } catch (err) {
      console.error('Ошибка загрузки очереди:', err);
    }
  }, []);

  const fetchFurnacesStatus = useCallback(async () => {
    try {
      const res = await api.get('/cassettenew/furnaces-status');
      setFurnacesStatus(res.data);
    } catch (err) {
      console.error('Ошибка загрузки печей:', err);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchFurnacesStatus();
    const id = setInterval(() => { fetchQueue(); fetchFurnacesStatus(); }, 5000);
    return () => clearInterval(id);
  }, [fetchQueue, fetchFurnacesStatus]);
{/* ── Управление кассетой ── */}
const [cassetteStatus, setCassetteStatus] = useState(null); // { is_closed, sheet_count }

// Загрузка статуса кассеты при открытии
useEffect(() => {
  if (currentCassette?.businessKey) {
    api.get(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/status`)
      .then(res => setCassetteStatus(res.data))
      .catch(() => setCassetteStatus(null));
  } else {
    setCassetteStatus(null);
  }
}, [currentCassette?.businessKey]);

const handleCloseCassette = async () => {
  if (!currentCassette) return;
  if (!window.confirm('Закрыть кассету? После закрытия нельзя будет добавить новые листы.')) return;

  try {
    const res = await api.post(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/close`);
    setCassetteStatus(prev => ({ ...prev, is_closed: true }));
    setMessage({ type: 'success', text: res.data.message });
  } catch (err) {
    setMessage({ type: 'error', text: err.response?.data?.message || err.message });
  }
};
  // Автозагрузка первого листа из очереди
  useEffect(() => {
    if (!currentRecord && queue.length > 0) {
      loadRecord(queue[0].id);
    }
  }, [queue, currentRecord]);

  const loadRecord = async (id) => {
    try {
      const res = await api.get(`/measurement/${id}`);
      const rec = res.data;
      setCurrentRecord(rec);
      if (rec.measuredAt) {
        const b = emptyGrid(), a = emptyGrid();
        for (let i = 1; i <= 8; i++) {
          b[i-1] = rec[`h${i}Before`] ?? null;
          a[i-1] = rec[`h${i}After`] ?? null;
        }
        setBefore(b); setAfter(a);
      } else {
        setBefore(emptyGrid());
        setAfter(emptyGrid());
      }
      setMessage(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    }
  };

  // ── Сохранение замеров ──
  const handleSave = async () => {
    if (!currentRecord?.id) return;
    setSaving(true);
    try {
      const payload = {};
      for (let i = 1; i <= 8; i++) {
        payload[`h${i}Before`] = before[i-1];
        payload[`h${i}After`] = after[i-1];
      }
      payload.measuredBy = localStorage.getItem('username') || 'operator';
      payload.measuredAt = new Date().toISOString();

      await api.put(`/measurement/${currentRecord.id}`, payload);
      setMessage({ type: 'success', text: '✓ Замеры сохранены! Теперь можно добавить в кассету →' });
      await fetchQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  };

  // ── Создание кассеты ──
  const handleCreateCassette = async () => {
    if (!cassetteNumber) return;
    const inFurnace = furnacesStatus.find(f => f.cassette_id === cassetteNumber);
    if (inFurnace) {
      setMessage({ type: 'error', text: `Кассета №${cassetteNumber} сейчас в печи №${inFurnace.furnace_number}!` });
      return;
    }
    try {
      const res = await api.post('/cassettenew/create', { cassetteNumber: parseInt(cassetteNumber) });
      setCurrentCassette({ businessKey: res.data.businessKey, sheets: [] });
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    }
  };

  // ── Добавление листа в кассету ──
  const handleAddToCassette = async () => {
    if (!currentCassette || !currentRecord?.matId) return;
    if (!currentRecord.measuredAt) {
      setMessage({ type: 'error', text: 'Сначала сохраните замеры!' });
      return;
    }
    try {
      await api.post(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/add-sheet`, {
        matId: currentRecord.matId
      });
      setMessage({ type: 'success', text: `✓ Лист ${currentRecord.melt}/${currentRecord.sheet} добавлен в кассету` });
      // Загружаем обновлённый состав кассеты
      const res = await api.get(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/sheets`);
      setCurrentCassette({ ...currentCassette, sheets: res.data });
      // Переходим к следующему листу
      setCurrentRecord(null);
      fetchQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    }
  };

  // ── Завершение кассеты ──
  const handleFinishCassette = async () => {
    if (!currentCassette || currentCassette.sheets.length === 0) return;
    if (!window.confirm(`Отправить ${currentCassette.sheets.length} листов в печь №${furnaceForFinish}?`)) return;
    try {
      const res = await api.post(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/finish`, {
        furnaceNumber: furnaceForFinish
      });
      setMessage({ type: 'success', text: res.data.message });
      setCurrentCassette(null);
      setCassetteNumber('');
      fetchFurnacesStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    }
  };

  const allFilled = before.every(v => v != null) && after.every(v => v != null);
  const alreadyMeasured = currentRecord?.measuredAt != null;
  const canAddToCassette = alreadyMeasured && currentCassette && currentRecord?.matId;
  const cassettesInFurnaces = furnacesStatus.map(f => f.cassette_id);

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "'Roboto Mono', monospace", padding: 12,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* ── ШАПКА ── */}
      <div style={{
        background: C.panel, border: `1px solid ${C.accent}`,
        borderRadius: 6, padding: '10px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>
          🔧 РАБОЧЕЕ МЕСТО ОПЕРАТОРА — ЗАКАЛКА / ИЗМЕРЕНИЕ / КАССЕТЫ
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: connected ? C.green : C.red,
              boxShadow: connected ? `0 0 6px ${C.green}` : 'none',
            }} />
            <span style={{ fontSize: 12, color: C.dim }}>
              {connected ? 'OPC UA подключён' : 'Нет связи'}
            </span>
          </div>
          <div style={{
            background: queue.length > 0 ? C.yellow : C.green,
            color: '#000', padding: '4px 12px', borderRadius: 4,
            fontSize: 13, fontWeight: 700,
          }}>
            В очереди: {queue.length}
          </div>
        </div>
      </div>

      {/* ── СООБЩЕНИЕ ── */}
      {message && (
        <div style={{
          padding: '8px 16px', borderRadius: 4,
          background: message.type === 'success' ? '#1b5e20' : '#b71c1c',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── ОСНОВНАЯ РАСКЛАДКА: 3 колонки ── */}
      <div style={{ display: 'flex', gap: 12, flex: 1 }}>

        {/* ═══ ЛЕВАЯ: Очередь измерения ═══ */}
        <div style={{
          width: 280, flexShrink: 0,
          background: C.panel, border: `1px solid ${C.panelBd}`,
          borderRadius: 6, padding: 12,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: C.accent,
            marginBottom: 10, letterSpacing: 1,
          }}>
            📋 ОЧЕРЕДЬ ИЗМЕРЕНИЯ ({queue.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {queue.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: C.dim, fontSize: 12 }}>
                Очередь пуста.<br />Ожидание листа на X2...
              </div>
            ) : queue.map(item => {
              const isCurrent = currentRecord?.id === item.id;
              const waitColor = item.waitingMinutes > 10 ? C.red : item.waitingMinutes > 5 ? C.yellow : C.green;
              return (
                <div key={item.id}
                  onClick={() => !isCurrent && loadRecord(item.id)}
                  style={{
                    padding: '8px 10px', cursor: 'pointer',
                    background: isCurrent ? '#1a2f4a' : 'transparent',
                    border: `1px solid ${isCurrent ? C.accent : C.panelBd}`,
                    borderLeft: `4px solid ${isCurrent ? C.accent : 'transparent'}`,
                    borderRadius: 4,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.accent }}>
                      {item.melt}/{item.sheet}
                    </span>
                    <span style={{ fontSize: 11, color: waitColor }}>⏱ {fmtWait(item.waitingMinutes)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.dim }}>
                    Пачка {item.pack} · {item.alloyCodeText || '—'}
                  </div>
                  {item.measuredAt && (
                    <div style={{ fontSize: 10, color: C.green, marginTop: 2 }}>✓ Измерен</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ ЦЕНТР: Текущий лист + замеры ═══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {currentRecord ? (
            <>
              {/* Инфо о листе */}
              <div style={{
                background: C.panel, border: `1px solid ${C.accent}`,
                borderRadius: 6, padding: '10px 16px',
                display: 'flex', gap: 20, flexWrap: 'wrap',
              }}>
                {[
                  { l: 'MatId', v: currentRecord.matId || '—', c: C.accent },
                  { l: 'Плавка', v: currentRecord.melt },
                  { l: 'Партия', v: currentRecord.partNo },
                  { l: 'Пачка', v: currentRecord.pack },
                  { l: 'Лист', v: currentRecord.sheet, c: C.accent },
                  { l: 'Марка', v: currentRecord.alloyCodeText, c: C.yellow },
                  { l: 'Толщ.', v: currentRecord.thickness ? `${currentRecord.thickness}мм` : '—' },
                ].map(p => (
                  <div key={p.l} style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 10, color: C.dim }}>{p.l}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: p.c || C.text }}>
                      {p.v ?? '—'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Сетки замеров */}
              <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                <MeasGrid title="До кантовки" values={before}
                  onChange={(i, v) => setBefore(p => { const n = [...p]; n[i] = v; return n; })}
                  disabled={saving || alreadyMeasured} />
                <MeasGrid title="После кантовки" values={after}
                  onChange={(i, v) => setAfter(p => { const n = [...p]; n[i] = v; return n; })}
                  disabled={saving || alreadyMeasured} />
              </div>

              {/* Кнопка сохранения */}
              <div style={{ textAlign: 'center' }}>
                {!alreadyMeasured ? (
                  <button onClick={handleSave} disabled={saving || !allFilled}
                    style={{
                      minWidth: 360, padding: '14px 32px', fontSize: 16, fontWeight: 700,
                      background: (saving || !allFilled) ? C.btnDis : C.btnBg,
                      color: '#fff', border: 'none', borderRadius: 6,
                      cursor: (saving || !allFilled) ? 'not-allowed' : 'pointer',
                    }}>
                    {saving ? '⏳ Сохранение...' : allFilled ? '💾 Сохранить замеры' : `⚠ Заполните все 16 точек (${before.filter(v=>v!=null).length + after.filter(v=>v!=null).length}/16)`}
                  </button>
                ) : (
                  <div style={{
                    display: 'inline-block', padding: '10px 24px', background: '#1b5e20',
                    borderRadius: 6, color: '#a5d6a7', fontSize: 14, fontWeight: 700,
                  }}>
                    ✓ Измерено — {new Date(currentRecord.measuredAt).toLocaleString('ru-RU')}
                    {currentRecord.measuredBy ? ` (${currentRecord.measuredBy})` : ''}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.dim, fontSize: 16,
            }}>
              Выберите лист из очереди слева
            </div>
          )}
        </div>

        {/* ═══ ПРАВАЯ: Кассета ═══ */}
        <div style={{
          width: 320, flexShrink: 0,
          background: C.panel, border: `1px solid ${C.panelBd}`,
          borderRadius: 6, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, letterSpacing: 1 }}>
            📦 ТЕКУЩАЯ КАССЕТА
          </div>

          {!currentCassette ? (
            // Создание кассеты
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, color: C.dim }}>Номер кассеты:</label>
              <input type="number" min="1" value={cassetteNumber}
                onChange={e => setCassetteNumber(e.target.value)}
                placeholder="Например: 12"
                style={{
                  padding: 10, fontSize: 16, background: C.inputBg, color: C.text,
                  border: `1px solid ${C.panelBd}`, borderRadius: 4,
                }} />
              {cassettesInFurnaces.length > 0 && (
                <div style={{
                  background: '#e6510022', border: `1px solid ${C.yellow}`,
                  padding: 8, borderRadius: 4, fontSize: 11,
                }}>
                  ⚠ В печах: <b>{cassettesInFurnaces.join(', ')}</b>
                </div>
              )}
              <button onClick={handleCreateCassette}
                disabled={!cassetteNumber}
                style={{
                  padding: 10, fontSize: 14, fontWeight: 700,
                  background: !cassetteNumber ? C.btnDis : C.green,
                  color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer',
                }}>
                ✅ Создать кассету
              </button>
            </div>
          ) : (
            // Работа с кассетой
            <>
              <div style={{
                background: '#1a2f4a', padding: 8, borderRadius: 4,
                border: `1px solid ${C.accent}`,
              }}>
                <div style={{ fontSize: 11, color: C.dim }}>Кассета:</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, fontFamily: 'monospace' }}>
                  {currentCassette.businessKey}
                </div>
                <div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>
                  Листов: <b>{currentCassette.sheets.length}</b>
                </div>
              </div>

              {/* Состав кассеты */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {currentCassette.sheets.length === 0 ? (
                  <div style={{ padding: 15, textAlign: 'center', color: C.dim, fontSize: 11 }}>
                    Кассета пуста
                  </div>
                ) : currentCassette.sheets.map((cs, i) => (
                  <div key={cs.id} style={{
                    padding: '4px 8px', fontSize: 11,
                    background: i % 2 ? 'transparent' : '#ffffff06',
                    borderRadius: 3, fontFamily: 'monospace',
                  }}>
                    <span style={{ color: C.dim }}>{i+1}.</span>{' '}
                    <span style={{ color: C.accent }}>{cs.sheet?.meltNumber}/{cs.sheet?.sheetNumber}</span>{' '}
                    <span style={{ color: C.yellow }}>{cs.sheet?.steelGrade}</span>
                  </div>
                ))}
              </div>

             {/* Кнопка "Добавить в кассету" — доступна только пока кассета НЕ закрыта */}
<button
  onClick={handleAddToCassette}
  disabled={!canAddToCassette || cassetteStatus?.is_closed}
  style={{
    padding: 12, fontSize: 14, fontWeight: 700,
    background: (!canAddToCassette || cassetteStatus?.is_closed) ? C.btnDis : C.green,
    color: '#000', border: 'none', borderRadius: 4,
    cursor: (canAddToCassette && !cassetteStatus?.is_closed) ? 'pointer' : 'not-allowed',
  }}
>
  {cassetteStatus?.is_closed
    ? '🔒 Кассета закрыта'
    : canAddToCassette
      ? `➕ Добавить ${currentRecord?.melt}/${currentRecord?.sheet}`
      : '⚠ Сначала сохраните замеры'}
</button>

{/* 🔒 Кнопка "Закончить формирование" — доступна когда есть листы и кассета ещё открыта */}
{currentCassette && currentCassette.sheets.length > 0 && !cassetteStatus?.is_closed && (
  <button
    onClick={handleCloseCassette}
    style={{
      width: '100%', padding: 10, fontSize: 13, fontWeight: 700,
      background: C.yellow, color: '#000',
      border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: 6,
    }}
  >
    🔒 Закончить формирование ({currentCassette.sheets.length} л.)
  </button>
)}

{/* 🔥 Кнопка "Отправить в печь" — доступна ТОЛЬКО когда кассета ЗАКРЫТА */}
<div style={{ borderTop: `1px solid ${C.panelBd}`, paddingTop: 8, marginTop: 4 }}>
  <label style={{ fontSize: 11, color: C.dim }}>Печь для отпуска:</label>
  <select value={furnaceForFinish}
    onChange={e => setFurnaceForFinish(parseInt(e.target.value))}
    disabled={!cassetteStatus?.is_closed}
    style={{
      width: '100%', padding: 6, fontSize: 13,
      background: C.inputBg, color: C.text,
      border: `1px solid ${C.panelBd}`, borderRadius: 4, marginBottom: 6,
      opacity: !cassetteStatus?.is_closed ? 0.5 : 1,
    }}>
    {[1,2,3,4].map(n => <option key={n} value={n}>Печь №{n}</option>)}
  </select>

  <button
    onClick={handleFinishCassette}
    disabled={!cassetteStatus?.is_closed || currentCassette.sheets.length === 0}
    style={{
      width: '100%', padding: 12, fontSize: 14, fontWeight: 700,
      background: !cassetteStatus?.is_closed ? C.btnDis : C.red,
      color: '#fff', border: 'none', borderRadius: 4,
      cursor: cassetteStatus?.is_closed ? 'pointer' : 'not-allowed',
    }}
  >
    {!cassetteStatus?.is_closed
      ? '🔒 Сначала закройте кассету'
      : `🔥 Отправить в печь (${currentCassette.sheets.length} л.)`}
  </button>

  {/* Кнопка отмены — доступна только пока кассета НЕ закрыта */}
  {!cassetteStatus?.is_closed && (
    <button
      onClick={() => { if (window.confirm('Закрыть кассету без отправки?')) setCurrentCassette(null); }}
      style={{
        width: '100%', padding: 6, fontSize: 11, marginTop: 4,
        background: 'transparent', color: C.dim,
        border: `1px solid ${C.panelBd}`, borderRadius: 4, cursor: 'pointer',
      }}
    >
      ✕ Отменить кассету
    </button>
  )}
</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}