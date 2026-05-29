import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useOpcUa } from '../hooks/useOpcUa';

const C = {
  bg: '#0d1117', panel: '#161b22', panelBd: '#30363d',
  text: '#e6edf3', dim: '#7d8590', accent: '#58a6ff',
  green: '#3fb950', red: '#f85149', yellow: '#d29922',
  inputBg: '#21262d', btnBg: '#1565c0', btnDis: '#37474f',
  orange: '#ff9800',
};

const emptyGrid = () => Array.from({ length: 8 }, () => null);
const bdrColor = v => {
  if (v == null) return C.panelBd;
  const a = Math.abs(v);
  return a > 1.0 ? C.red : a > 0.5 ? C.yellow : C.green;
};
const fmtWait = m => m == null ? '—' : m < 1 ? '<1м' : m < 60 ? `${Math.round(m)}м` : `${Math.floor(m/60)}ч`;

// ── Ячейка замера ──
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

// ── Модалка редактирования замеров (мастер) ──
function EditMeasurementModal({ sheet, onSave, onClose }) {
  const [values, setValues] = useState({ before: emptyGrid(), after: emptyGrid(), reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (sheet?.measurement) {
      const b = emptyGrid(), a = emptyGrid();
      for (let i = 1; i <= 8; i++) {
        b[i-1] = sheet.measurement[`h${i}Before`] ?? null;
        a[i-1] = sheet.measurement[`h${i}After`] ?? null;
      }
      setValues({ before: b, after: a, reason: '' });
    }
  }, [sheet]);

  const handleSave = async () => {
    if (!sheet?.matId || !sheet?.cassetteBusinessKey) return;
    if (!values.reason.trim()) { setError('Укажите причину'); return; }
    setSaving(true); setError(null);
    try {
      const payload = { reason: values.reason };
      for (let i = 1; i <= 8; i++) {
        payload[`h${i}Before`] = values.before[i-1];
        payload[`h${i}After`] = values.after[i-1];
      }
      await api.put(
        `/cassettenew/${encodeURIComponent(sheet.cassetteBusinessKey)}/edit-measurement/${sheet.matId}`,
        payload
      );
      onSave(); onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: C.panel, border: `2px solid ${C.yellow}`, borderRadius: 8,
        padding: 24, minWidth: 700, maxWidth: '90vw', color: C.text,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: C.yellow }}>✏ Редактирование замеров</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 12 }}>
          Лист: <b style={{ color: C.accent }}>{sheet?.sheet?.meltNumber}/{sheet?.sheet?.sheetNumber}</b>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.accent, marginBottom: 6, fontWeight: 700 }}>ДО КАНТОВКИ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {values.before.map((v, i) => (
                <input key={i} type="number" step="0.1" value={v ?? ''}
                  onChange={e => { const n = [...values.before]; n[i] = e.target.value === '' ? null : parseFloat(e.target.value); setValues({ ...values, before: n }); }}
                  style={{ padding: 6, background: C.inputBg, color: C.text, border: `1px solid ${bdrColor(v)}`, borderRadius: 3, textAlign: 'center', fontFamily: 'monospace' }}
                  placeholder={`H${i+1}`} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.accent, marginBottom: 6, fontWeight: 700 }}>ПОСЛЕ КАНТОВКИ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {values.after.map((v, i) => (
                <input key={i} type="number" step="0.1" value={v ?? ''}
                  onChange={e => { const n = [...values.after]; n[i] = e.target.value === '' ? null : parseFloat(e.target.value); setValues({ ...values, after: n }); }}
                  style={{ padding: 6, background: C.inputBg, color: C.text, border: `1px solid ${bdrColor(v)}`, borderRadius: 3, textAlign: 'center', fontFamily: 'monospace' }}
                  placeholder={`H${i+1}`} />
              ))}
            </div>
          </div>
        </div>
        <label style={{ fontSize: 12, color: C.yellow, display: 'block', marginBottom: 4, fontWeight: 700 }}>Причина (обязательно):</label>
        <textarea value={values.reason} onChange={e => setValues({ ...values, reason: e.target.value })}
          rows={2} placeholder="Например: ошибочный ввод..."
          style={{ width: '100%', padding: 8, background: C.inputBg, color: C.text, border: `1px solid ${C.panelBd}`, borderRadius: 4, marginBottom: 12, boxSizing: 'border-box' }} />
        {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>⚠ {error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.panelBd}`, borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}>Отмена</button>
          <button onClick={handleSave} disabled={saving || !values.reason.trim()}
            style={{ background: saving || !values.reason.trim() ? C.btnDis : C.yellow, color: '#000', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 }}>
            {saving ? 'Сохранение...' : '💾 Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Карточка закрытой кассеты (для нижней зоны) ──
function ClosedCassetteCard({ cassette, onRefresh, isMaster, cassettesInFurnaces }) {
  const [furnace, setFurnace] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const lastSheet = cassette.sheets?.[cassette.sheets.length - 1];
  const inFurnace = cassettesInFurnaces.includes(String(cassette.cassette_number));

  const handleFinish = async () => {
    if (!window.confirm(`Отправить ${cassette.sheets.length} листов в печь №${furnace}?`)) return;
    setSending(true); setError(null);
    try {
      await api.post(`/cassettenew/${encodeURIComponent(cassette.businessKey)}/finish`, { furnaceNumber: furnace });
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка');
      setSending(false);
    }
  };

  const handleReopen = async () => {
    const reason = window.prompt('🔓 Переоткрыть кассету?\nУкажите причину (в аудит-лог):');
    if (!reason?.trim()) return;
    try {
      await api.post(`/cassettenew/${encodeURIComponent(cassette.businessKey)}/reopen`, { reason: reason.trim() });
      onRefresh();
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div style={{
      width: 280, flexShrink: 0,
      background: C.panel, border: `2px solid ${C.orange}`,
      borderRadius: 8, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: C.dim }}>КАССЕТА №{cassette.cassette_number}</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.accent }}>{cassette.businessKey}</div>
        </div>
        <div style={{ background: C.orange, color: '#000', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}>
          🔒 {cassette.sheets.length} л.
        </div>
      </div>

      {/* Последний лист — КРУПНО */}
      {lastSheet && (
        <div style={{
          background: '#1a2f4a', padding: 8, borderRadius: 4,
          border: `1px solid ${C.accent}`,
        }}>
          <div style={{ fontSize: 9, color: C.dim, marginBottom: 2 }}>ПОСЛЕДНИЙ ЛИСТ:</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: C.accent }}>
            {lastSheet.sheet?.meltNumber}/{lastSheet.sheet?.sheetNumber}
          </div>
          <div style={{ fontSize: 10, color: C.yellow }}>{lastSheet.sheet?.steelGrade}</div>
          {lastSheet.measurement && (
            <div style={{ fontSize: 9, color: C.green, marginTop: 2 }}>
              H1: {lastSheet.measurement.h1Before?.toFixed(1) || '—'} → {lastSheet.measurement.h1After?.toFixed(1) || '—'}
            </div>
          )}
        </div>
      )}

      {/* Время */}
      <div style={{ fontSize: 10, color: C.dim }}>
        Закрыта: {new Date(cassette.closedAt || cassette.closed_at).toLocaleString('ru-RU', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        })}
      </div>

      {/* Ошибка */}
      {error && <div style={{ fontSize: 10, color: C.red, background: '#4a1a1a', padding: 4, borderRadius: 3 }}>⚠ {error}</div>}

      {/* Кнопки */}
      {inFurnace ? (
        <div style={{ background: '#4a1a1a', color: C.red, padding: 6, borderRadius: 4, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>
          ♨ В ПЕЧИ
        </div>
      ) : (
        <>
          <select value={furnace} onChange={e => setFurnace(parseInt(e.target.value))}
            style={{
              width: '100%', padding: 6, fontSize: 12,
              background: C.inputBg, color: C.text,
              border: `1px solid ${C.panelBd}`, borderRadius: 4,
            }}>
            {[1,2,3,4].map(n => <option key={n} value={n}>Печь №{n}</option>)}
          </select>
          <button onClick={handleFinish} disabled={sending}
            style={{
              width: '100%', padding: 8, fontSize: 12, fontWeight: 700,
              background: sending ? C.btnDis : C.red, color: '#fff',
              border: 'none', borderRadius: 4, cursor: sending ? 'not-allowed' : 'pointer',
            }}>
            {sending ? '⏳ Отправка...' : `🔥 В печь №${furnace}`}
          </button>
          {isMaster && (
            <button onClick={handleReopen}
              style={{
                width: '100%', padding: 6, fontSize: 10,
                background: 'transparent', color: C.orange,
                border: `1px solid ${C.orange}`, borderRadius: 4, cursor: 'pointer',
              }}>
              🔓 Переоткрыть
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
export default function OperatorWorkplace() {
  const { values, connected } = useOpcUa([
    'X2_ZoneOccup', 'X2_Melt', 'X2_Slab', 'X2_PartNo', 'X2_Pack',
    'X2_Sheet', 'X2_SubSheet', 'X2_SheetInPack', 'X2_SheetsInPack',
    'X2_Thikness', 'X2_AlloyCodeText',
  ]);

  const toNum = v => { if (v == null) return null; const n = Number(v); return isNaN(n) ? null : n; };
  const toStr = v => (v == null ? null : String(v));
  const [lastCreatedKey, setLastCreatedKey] = useState(null);

  // ── Очередь измерения ──
  const [queue, setQueue] = useState([]);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [before, setBefore] = useState(emptyGrid());
  const [after, setAfter] = useState(emptyGrid());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // ── Кассеты ──
  const [currentCassette, setCurrentCassette] = useState(null);   // активная (формируется)
  const [closedCassettes, setClosedCassettes] = useState([]);      // готовые к отправке
  const [cassetteNumber, setCassetteNumber] = useState('');
  const [furnacesStatus, setFurnacesStatus] = useState([]);
  const [cassetteStatus, setCassetteStatus] = useState(null);

  // ── Редактирование ──
  const [editModal, setEditModal] = useState(null);
  const [removeModal, setRemoveModal] = useState(null);

  const currentRecordRef = useRef(null);
  useEffect(() => { currentRecordRef.current = currentRecord; }, [currentRecord]);

  const isMaster = ['master', 'superadmin', 'developer'].includes(localStorage.getItem('role') || '');

  // ── API helpers ──
  const fetchQueue = useCallback(async () => {
    try { const res = await api.get('/measurement/queue'); setQueue(res.data); }
    catch (err) { console.error('Ошибка очереди:', err); }
  }, []);

  const fetchFurnacesStatus = useCallback(async () => {
    try { const res = await api.get('/cassettenew/furnaces-status'); setFurnacesStatus(res.data); }
    catch (err) { console.error('Ошибка печей:', err); }
  }, []);

  // ── Разделение кассет на активную и закрытые ──
  const refreshAllCassettes = useCallback(async () => {
    try {
      const res = await api.get('/cassettenew/list');
      const all = res.data || [];
      const active = all.find(c => !c.is_closed);
      const closed = all.filter(c => c.is_closed);

      // Загружаем полный состав для закрытых
      const closedWithSheets = await Promise.all(
        closed.map(async c => {
          try {
            const sheetsRes = await api.get(`/cassettenew/${encodeURIComponent(c.business_key)}/sheets`);
            return { ...c, businessKey: c.business_key, sheets: sheetsRes.data };
          } catch {
            return { ...c, businessKey: c.business_key, sheets: [] };
          }
        })
      );

      setClosedCassettes(closedWithSheets);

      if (active) {
        // Активная кассета — загружаем состав и статус
        try {
          const sheetsRes = await api.get(`/cassettenew/${encodeURIComponent(active.business_key)}/sheets`);
          const statusRes = await api.get(`/cassettenew/${encodeURIComponent(active.business_key)}/status`);
          setCurrentCassette({ businessKey: active.business_key, sheets: sheetsRes.data });
          setCassetteStatus(statusRes.data);
        } catch (err) {
          if (err.response?.status === 404) {
            setCurrentCassette(null);
            setCassetteStatus(null);
          }
        }
      } else {
        setCurrentCassette(null);
        setCassetteStatus(null);
      }
    } catch (err) {
      console.error('Ошибка загрузки кассет:', err);
    }
  }, []);

  // ── Первичная загрузка ──
  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchQueue(), fetchFurnacesStatus(), refreshAllCassettes()]);
      setInitialLoadDone(true);
    };
    init();
  }, [fetchQueue, fetchFurnacesStatus, refreshAllCassettes]);

  // ── Периодическое обновление ──
  useEffect(() => {
    if (!initialLoadDone) return;
    const id = setInterval(() => {
      fetchQueue();
      fetchFurnacesStatus();
      refreshAllCassettes();
    }, 5000);
    return () => clearInterval(id);
  }, [initialLoadDone, fetchQueue, fetchFurnacesStatus, refreshAllCassettes]);

  // ── Авто-загрузка первого листа ──
  useEffect(() => {
    if (!initialLoadDone) return;
    if (!currentRecordRef.current && queue.length > 0) loadRecord(queue[0].id);
  }, [queue, initialLoadDone]);

  // ── Слежение за X2 ──
  useEffect(() => {
    const occ = toNum(values['X2_ZoneOccup']?.value);
    if (occ !== 1 && occ !== true) { setLastCreatedKey(null); return; }
    const sheet = {
      melt: toNum(values['X2_Melt']?.value), slab: toNum(values['X2_Slab']?.value),
      partNo: toNum(values['X2_PartNo']?.value), pack: toNum(values['X2_Pack']?.value),
      sheet: toNum(values['X2_Sheet']?.value), sheetInPack: toNum(values['X2_SheetInPack']?.value),
      sheetsInPack: toNum(values['X2_SheetsInPack']?.value),
      thickness: toNum(values['X2_Thikness']?.value),
      alloyCodeText: toStr(values['X2_AlloyCodeText']?.value),
    };
    const key = `${sheet.melt}/${sheet.partNo}/${sheet.pack}/${sheet.sheet}`;
    if (!key || key === lastCreatedKey || !sheet.melt || !sheet.sheet) return;
    setLastCreatedKey(key);
    api.post('/measurement', { ...sheet, enteredX2At: new Date().toISOString() })
      .then(() => { fetchQueue(); setMessage({ type: 'success', text: `📥 Лист ${sheet.melt}/${sheet.sheet} в очереди` }); })
      .catch(err => { if (err.response?.status !== 409) console.error(err); else fetchQueue(); });
  }, [values, lastCreatedKey, fetchQueue]);

  const loadRecord = async (id) => {
    try {
      const res = await api.get(`/measurement/${id}`);
      const rec = res.data;
      setCurrentRecord(rec);
      if (rec.measuredAt) {
        const b = emptyGrid(), a = emptyGrid();
        for (let i = 1; i <= 8; i++) { b[i-1] = rec[`h${i}Before`] ?? null; a[i-1] = rec[`h${i}After`] ?? null; }
        setBefore(b); setAfter(a);
      } else { setBefore(emptyGrid()); setAfter(emptyGrid()); }
      setMessage(null);
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || err.message }); }
  };

  const handleSave = async () => {
    if (!currentRecord?.id) return;
    setSaving(true);
    try {
      const payload = {};
      for (let i = 1; i <= 8; i++) { payload[`h${i}Before`] = before[i-1]; payload[`h${i}After`] = after[i-1]; }
      payload.measuredBy = localStorage.getItem('username') || 'operator';
      payload.measuredAt = new Date().toISOString();
      await api.put(`/measurement/${currentRecord.id}`, payload);
      setMessage({ type: 'success', text: '✓ Замеры сохранены! Можно добавить в кассету →' });
      await fetchQueue();
      setCurrentRecord(prev => prev ? { ...prev, measuredAt: payload.measuredAt, measuredBy: payload.measuredBy } : prev);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Ошибка' });
    } finally { setSaving(false); }
  };

  const handleCreateCassette = async () => {
    if (!cassetteNumber) return;
    const inFurnace = furnacesStatus.find(f => f.cassette_id === cassetteNumber);
    if (inFurnace) { setMessage({ type: 'error', text: `Кассета №${cassetteNumber} в печи №${inFurnace.furnace_number}!` }); return; }
    if (currentCassette) { setMessage({ type: 'error', text: 'Сначала завершите текущую кассету' }); return; }
    try {
      const res = await api.post('/cassettenew/create', { cassetteNumber: parseInt(cassetteNumber) });
      setCurrentCassette({ businessKey: res.data.businessKey, sheets: [] });
      setCassetteStatus({ is_closed: false, sheet_count: 0 });
      setCassetteNumber('');
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || err.message }); }
  };

  const handleAddToCassette = async () => {
    if (!currentCassette || !currentRecord?.matId || !currentRecord.measuredAt) return;
    if (cassetteStatus?.is_closed) { setMessage({ type: 'error', text: 'Кассета закрыта' }); return; }
    try {
      await api.post(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/add-sheet`, { matId: currentRecord.matId });
      setMessage({ type: 'success', text: `✓ Лист ${currentRecord.melt}/${currentRecord.sheet} добавлен` });
      const res = await api.get(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/sheets`);
      setCurrentCassette({ ...currentCassette, sheets: res.data });
      const statusRes = await api.get(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/status`);
      setCassetteStatus(statusRes.data);
      setCurrentRecord(null);
      await fetchQueue();
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || err.message }); }
  };

  const handleCloseCassette = async () => {
    if (!currentCassette) return;
    if (!window.confirm('Закрыть кассету? Она переместится в зону "После кантовки".')) return;
    try {
      await api.post(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/close`);
      setMessage({ type: 'success', text: '🔒 Кассета закрыта и готова к отправке в печь' });
      await refreshAllCassettes();
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || err.message }); }
  };

  const handleRemoveSheet = async () => {
    if (!removeModal || !currentCassette || !removeModal.reason.trim()) return;
    try {
      await api.delete(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/remove-sheet/${removeModal.matId}`,
        { data: { reason: removeModal.reason } });
      const res = await api.get(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/sheets`);
      setCurrentCassette({ ...currentCassette, sheets: res.data });
      setRemoveModal(null);
      setMessage({ type: 'success', text: 'Лист удалён' });
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || err.message }); }
  };

  const allFilled = before.every(v => v != null) && after.every(v => v != null);
  const alreadyMeasured = currentRecord?.measuredAt != null;
  const canAddToCassette = alreadyMeasured && currentCassette && currentRecord?.matId && !cassetteStatus?.is_closed;
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
          🔧 РАБОЧЕЕ МЕСТО ОПЕРАТОРА
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: connected ? C.green : C.red,
              boxShadow: connected ? `0 0 6px ${C.green}` : 'none',
            }} />
            <span style={{ fontSize: 12, color: C.dim }}>{connected ? 'OPC UA' : 'Нет связи'}</span>
          </div>
          <div style={{ background: queue.length > 0 ? C.yellow : C.green, color: '#000', padding: '4px 12px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}>
            Очередь: {queue.length}
          </div>
          <div style={{ background: C.orange, color: '#000', padding: '4px 12px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}>
            📦 Готово: {closedCassettes.length}
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
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ▼ ЗОНА 1: ДО КАНТОВКИ — формирование                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1, minHeight: 400,
        background: '#0d111788', border: `1px solid ${C.accent}`,
        borderRadius: 8, padding: 10,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: C.accent,
          marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase',
          borderBottom: `1px solid ${C.panelBd}`, paddingBottom: 4,
        }}>
          ▼ ДО КАНТОВКИ — формирование кассеты
        </div>

        <div style={{ display: 'flex', gap: 12, flex: 1 }}>
          {/* ── Очередь ── */}
          <div style={{
            width: 260, flexShrink: 0,
            background: C.panel, border: `1px solid ${C.panelBd}`,
            borderRadius: 6, padding: 12,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
              📋 Очередь ({queue.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {queue.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: C.dim, fontSize: 11 }}>Ожидание листа...</div>
              ) : queue.map(item => {
                const isCurrent = currentRecord?.id === item.id;
                return (
                  <div key={item.id} onClick={() => !isCurrent && loadRecord(item.id)}
                    style={{
                      padding: '8px 10px', cursor: 'pointer',
                      background: isCurrent ? '#1a2f4a' : 'transparent',
                      border: `1px solid ${isCurrent ? C.accent : C.panelBd}`,
                      borderLeft: `4px solid ${isCurrent ? C.accent : 'transparent'}`,
                      borderRadius: 4,
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.accent, fontSize: 12 }}>
                        {item.melt}/{item.sheet}
                      </span>
                      <span style={{ fontSize: 10, color: item.waitingMinutes > 10 ? C.red : C.dim }}>
                        ⏱ {fmtWait(item.waitingMinutes)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: C.dim }}>Пачка {item.pack} · {item.alloyCodeText || '—'}</div>
                    {item.measuredAt && <div style={{ fontSize: 9, color: C.green }}>✓ Измерен</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Замеры ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentRecord ? (
              <>
                <div style={{
                  background: C.panel, border: `1px solid ${C.accent}`,
                  borderRadius: 6, padding: '8px 12px',
                  display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12,
                }}>
                  <div><span style={{ color: C.dim }}>MatId:</span> <b style={{ color: C.accent }}>{currentRecord.matId}</b></div>
                  <div><span style={{ color: C.dim }}>Плавка:</span> <b>{currentRecord.melt}</b></div>
                  <div><span style={{ color: C.dim }}>Лист:</span> <b style={{ color: C.accent }}>{currentRecord.sheet}</b></div>
                  <div><span style={{ color: C.dim }}>Марка:</span> <b style={{ color: C.yellow }}>{currentRecord.alloyCodeText}</b></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                  <MeasGrid title="До кантовки" values={before}
                    onChange={(i, v) => setBefore(p => { const n = [...p]; n[i] = v; return n; })}
                    disabled={saving || alreadyMeasured} />
                  <MeasGrid title="После кантовки" values={after}
                    onChange={(i, v) => setAfter(p => { const n = [...p]; n[i] = v; return n; })}
                    disabled={saving || alreadyMeasured} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  {!alreadyMeasured ? (
                    <button onClick={handleSave} disabled={saving || !allFilled}
                      style={{
                        minWidth: 360, padding: '12px 32px', fontSize: 14, fontWeight: 700,
                        background: (saving || !allFilled) ? C.btnDis : C.btnBg,
                        color: '#fff', border: 'none', borderRadius: 6,
                        cursor: (saving || !allFilled) ? 'not-allowed' : 'pointer',
                      }}>
                      {saving ? '⏳ Сохранение...' : allFilled ? '💾 Сохранить замеры' : `⚠ Заполните все 16 точек`}
                    </button>
                  ) : (
                    <div style={{ display: 'inline-block', padding: '8px 20px', background: '#1b5e20', borderRadius: 6, color: '#a5d6a7', fontSize: 13, fontWeight: 700 }}>
                      ✓ Измерено — {new Date(currentRecord.measuredAt).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim }}>
                Выберите лист из очереди
              </div>
            )}
          </div>

          {/* ── Активная кассета ── */}
          <div style={{
            width: 300, flexShrink: 0,
            background: C.panel, border: `1px solid ${C.panelBd}`,
            borderRadius: 6, padding: 12,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>📦 АКТИВНАЯ КАССЕТА</div>

            {!currentCassette ? (
              <>
                <label style={{ fontSize: 11, color: C.dim }}>Номер кассеты:</label>
                <input type="number" min="1" value={cassetteNumber}
                  onChange={e => setCassetteNumber(e.target.value)}
                  style={{
                    padding: 8, fontSize: 14, background: C.inputBg, color: C.text,
                    border: `1px solid ${C.panelBd}`, borderRadius: 4,
                  }} />
                {cassettesInFurnaces.length > 0 && (
                  <div style={{ background: '#e6510022', border: `1px solid ${C.yellow}`, padding: 6, borderRadius: 4, fontSize: 10 }}>
                    ⚠ В печах: <b>{cassettesInFurnaces.join(', ')}</b>
                  </div>
                )}
                <button onClick={handleCreateCassette} disabled={!cassetteNumber}
                  style={{
                    padding: 10, fontSize: 13, fontWeight: 700,
                    background: !cassetteNumber ? C.btnDis : C.green,
                    color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer',
                  }}>
                  ✅ Создать кассету
                </button>
              </>
            ) : (
              <>
                <div style={{
                  background: '#1a2f4a', padding: 8, borderRadius: 4,
                  border: `1px solid ${C.accent}`,
                }}>
                  <div style={{ fontSize: 10, color: C.dim }}>Кассета:</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, fontFamily: 'monospace' }}>
                    {currentCassette.businessKey}
                  </div>
                  <div style={{ fontSize: 11, color: C.text, marginTop: 2 }}>
                    Листов: <b>{currentCassette.sheets.length}</b>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200 }}>
                  {currentCassette.sheets.length === 0 ? (
                    <div style={{ padding: 10, textAlign: 'center', color: C.dim, fontSize: 10 }}>Пусто — добавьте лист</div>
                  ) : currentCassette.sheets.map((cs, i) => (
                    <div key={cs.id} style={{
                      padding: '4px 8px', fontSize: 10,
                      background: i % 2 ? 'transparent' : '#ffffff06',
                      borderRadius: 2, fontFamily: 'monospace',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ color: C.dim }}>{i+1}.</span>{' '}
                        <span style={{ color: C.accent, fontWeight: 700 }}>
                          {cs.sheet?.meltNumber}/{cs.sheet?.sheetNumber}
                        </span>{' '}
                        <span style={{ color: C.yellow, fontSize: 9 }}>{cs.sheet?.steelGrade}</span>
                      </div>
                      {isMaster && (
                        <div style={{ display: 'flex', gap: 2 }}>
                          {cs.measurement && (
                            <button onClick={() => setEditModal({ ...cs, cassetteBusinessKey: currentCassette.businessKey })}
                              style={{ background: 'transparent', color: C.yellow, border: `1px solid ${C.yellow}`, borderRadius: 2, padding: '0 4px', cursor: 'pointer', fontSize: 9 }}>✏</button>
                          )}
                          <button onClick={() => setRemoveModal({ matId: cs.matId, reason: '' })}
                            style={{ background: 'transparent', color: C.red, border: `1px solid ${C.red}`, borderRadius: 2, padding: '0 4px', cursor: 'pointer', fontSize: 9 }}>✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button onClick={handleAddToCassette} disabled={!canAddToCassette}
                  style={{
                    padding: 8, fontSize: 12, fontWeight: 700,
                    background: !canAddToCassette ? C.btnDis : C.green,
                    color: '#000', border: 'none', borderRadius: 4,
                    cursor: canAddToCassette ? 'pointer' : 'not-allowed',
                  }}>
                  {canAddToCassette ? `➕ Добавить ${currentRecord?.melt}/${currentRecord?.sheet}` : '⚠ Сначала замеры'}
                </button>

                {currentCassette.sheets.length > 0 && (
                  <button onClick={handleCloseCassette}
                    style={{
                      padding: 8, fontSize: 12, fontWeight: 700,
                      background: C.orange, color: '#000',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                    }}>
                    🔒 Закончить формирование ({currentCassette.sheets.length} л.)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ▼ ЗОНА 2: ПОСЛЕ КАНТОВКИ — готовые к отправке в печь           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        background: '#1a120d44', border: `1px solid ${C.orange}`,
        borderRadius: 8, padding: 10,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: C.orange,
          marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase',
          borderBottom: `1px solid ${C.panelBd}`, paddingBottom: 4,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>▼ ПОСЛЕ КАНТОВКИ — готовые к отправке в печь ({closedCassettes.length})</span>
          <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>
            В печах: {cassettesInFurnaces.length > 0 ? cassettesInFurnaces.join(', ') : '—'}
          </span>
        </div>

        {closedCassettes.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.dim, fontSize: 13 }}>
            🕐 Нет закрытых кассет. Завершите формирование в верхней зоне →
          </div>
        ) : (
          <div style={{
            display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8,
          }}>
            {closedCassettes.map(c => (
              <ClosedCassetteCard
                key={c.businessKey}
                cassette={c}
                onRefresh={refreshAllCassettes}
                isMaster={isMaster}
                cassettesInFurnaces={cassettesInFurnaces}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── МОДАЛКИ ── */}
      {editModal && (
        <EditMeasurementModal
          sheet={editModal}
          onSave={() => { refreshAllCassettes(); setEditModal(null); }}
          onClose={() => setEditModal(null)}
        />
      )}

      {removeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setRemoveModal(null)}>
          <div style={{
            background: C.panel, border: `2px solid ${C.red}`, borderRadius: 8,
            padding: 24, minWidth: 400, color: C.text,
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 12px', color: C.red }}>⚠ Удаление листа</h2>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Лист <b style={{ color: C.accent }}>{removeModal.matId}</b> будет удалён.
            </p>
            <label style={{ fontSize: 12, color: C.yellow, display: 'block', marginBottom: 4, fontWeight: 700 }}>Причина:</label>
            <textarea value={removeModal.reason}
              onChange={e => setRemoveModal({ ...removeModal, reason: e.target.value })}
              rows={2}
              style={{
                width: '100%', padding: 8, background: C.inputBg, color: C.text,
                border: `1px solid ${C.panelBd}`, borderRadius: 4, marginBottom: 12,
                boxSizing: 'border-box',
              }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRemoveModal(null)} style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.panelBd}`, borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}>Отмена</button>
              <button onClick={handleRemoveSheet} disabled={!removeModal.reason.trim()}
                style={{ background: !removeModal.reason.trim() ? C.btnDis : C.red, color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 }}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}