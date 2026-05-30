import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useOpcUa } from '../hooks/useOpcUa';
import { useAuth } from '../context/AuthContext';

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

// ════════════════════════════════════════════════════════════════════
// 🎹 Виртуальная мини-клавиатура
// ════════════════════════════════════════════════════════════════════
function NumericKeypad({ anchorRect, initial, onCommit, onClose }) {
  const [buf, setBuf] = useState(initial ?? '');
  const kpRef = useRef(null);

  const pos = (() => {
    if (!anchorRect) return { top: 0, left: 0 };
    const kpW = 210, kpH = 320;
    let top = anchorRect.bottom + 6;
    let left = anchorRect.left;
    if (top + kpH > window.innerHeight) top = anchorRect.top - kpH - 6;
    if (left + kpW > window.innerWidth - 10) left = anchorRect.right - kpW;
    if (left < 10) left = 10;
    return { top, left };
  })();

  useEffect(() => {
    const h = e => { if (kpRef.current && !kpRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const press = ch => {
    if (ch === 'C') setBuf('');
    else if (ch === '⌫') setBuf(b => b.slice(0, -1));
    else if (ch === '±') setBuf(b => b.startsWith('-') ? b.slice(1) : (b ? '-' + b : '-'));
    else if (ch === '.') setBuf(b => b.includes('.') ? b : (b || '0') + '.');
    else {
      const digits = buf.replace(/[.-]/g, '');
      if (digits.length >= 6 && ch !== '.') return;
      setBuf(b => b + ch);
    }
  };

  const commit = () => {
    if (buf === '' || buf === '-' || buf === '.') { onCommit(null); return; }
    const n = parseFloat(buf);
    onCommit(isNaN(n) ? null : n);
  };

  const btn = (label, onClick, color = C.inputBg, textColor = C.text, big = false) => (
    <button onClick={onClick} style={{
      height: 56, fontSize: big ? 20 : 22, fontWeight: 700, fontFamily: 'monospace',
      background: color, color: textColor,
      border: `1px solid ${C.panelBd}`, borderRadius: 6, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{label}</button>
  );

  return (
    <div ref={kpRef} onClick={e => e.stopPropagation()} style={{
      position: 'fixed', top: pos.top, left: pos.left, width: 210,
      background: C.panel, border: `2px solid ${C.accent}`,
      borderRadius: 10, padding: 8, zIndex: 5000,
      boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        padding: '6px 8px', background: C.inputBg, borderRadius: 4,
        fontFamily: 'monospace', fontSize: 20, color: C.text, minHeight: 32,
        border: `1px solid ${C.panelBd}`, textAlign: 'right',
      }}>{buf || <span style={{ color: C.dim }}>0</span>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {['1','2','3','4','5','6','7','8','9'].map(n => btn(n, () => press(n)))}
        {btn('±', () => press('±'), '#2c3340')}
        {btn('0', () => press('0'))}
        {btn('.', () => press('.'))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {btn('C', () => press('C'), '#5a1a1a', '#fff')}
        {btn('⌫', () => press('⌫'), '#5a3a1a', '#fff')}
        {btn('✕', onClose, C.panelBd, C.dim)}
      </div>
      {btn('✓ ГОТОВО', commit, C.green, '#000', true)}
    </div>
  );
}

function NumericInput({ value, onChange, disabled, style, placeholder }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const ref = useRef(null);

  const openKp = () => {
    if (disabled) return;
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setOpen(true);
  };

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-flex', gap: 0 }}>
        <input
          ref={ref} type="text" inputMode="none" readOnly
          value={value ?? ''} placeholder={placeholder} disabled={disabled}
          onFocus={openKp} onClick={openKp} style={style}
        />
        {!disabled && (
          <button onClick={openKp} style={{
            width: 36, height: style?.height || 45,
            background: C.inputBg, border: `1px solid ${C.panelBd}`,
            borderLeft: 'none', borderRadius: '0 6px 6px 0',
            color: C.accent, cursor: 'pointer', fontSize: 16,
          }} title="Клавиатура">⌨</button>
        )}
      </div>
      {open && (
        <NumericKeypad
          anchorRect={rect}
          initial={value != null ? String(value) : ''}
          onCommit={v => { onChange(v); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ── Ячейка замера ──
function HCell({ label, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{label}</span>
      <NumericInput
        value={value} onChange={onChange} disabled={disabled} placeholder="—"
        style={{
          width: 80, height: 45, textAlign: 'center', fontFamily: 'monospace',
          fontSize: 20, fontWeight: 700, borderRadius: '6px 0 0 6px',
          color: value != null ? C.text : C.dim,
          background: C.inputBg,
          border: `3px solid ${bdrColor(value)}`,
          padding: 4, outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
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
      }}>{title}</div>
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

// ── Модалка редактирования замеров ──
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

  const CellEdit = ({ v, onChange }) => (
    <NumericInput value={v} onChange={onChange}
      style={{
        padding: 6, background: C.inputBg, color: C.text,
        border: `1px solid ${bdrColor(v)}`, borderRadius: '3px 0 0 3px',
        textAlign: 'center', fontFamily: 'monospace', width: '100%',
      }}
    />
  );

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
                <CellEdit key={i} v={v} onChange={nv => { const n = [...values.before]; n[i] = nv; setValues({ ...values, before: n }); }} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.accent, marginBottom: 6, fontWeight: 700 }}>ПОСЛЕ КАНТОВКИ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {values.after.map((v, i) => (
                <CellEdit key={i} v={v} onChange={nv => { const n = [...values.after]; n[i] = nv; setValues({ ...values, after: n }); }} />
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

// ── Модалка переоткрытия кассеты ──
function ReopenCassetteModal({ cassette, sheets, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    if (!reason.trim()) { setError('Укажите причину переоткрытия'); return; }
    setLoading(true); setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: C.panel, border: `2px solid ${C.orange}`, borderRadius: 10,
        padding: 24, minWidth: 500, maxWidth: 600, color: C.text,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: C.orange }}>🔓 Переоткрыть кассету №{cassette.cassette_number}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>
          В кассете <b style={{ color: C.text }}>{sheets.length} листов</b>. После переоткрытия она вернётся в зону формирования.
        </p>

        <div style={{ maxHeight: 300, overflowY: 'auto', background: C.bg, borderRadius: 6, padding: 8, marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.panelBd}` }}>
                {['№', 'Плавка', 'Лист', 'Марка'].map(h => (
                  <th key={h} style={{ padding: '4px 6px', color: C.dim, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheets.map((cs, i) => (
                <tr key={cs.id} style={{ borderBottom: `1px solid ${C.panelBd}22` }}>
                  <td style={{ padding: '4px 6px', color: C.dim }}>{i + 1}</td>
                  <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{cs.sheet?.meltNumber}</td>
                  <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{cs.sheet?.sheetNumber}</td>
                  <td style={{ padding: '4px 6px', color: C.yellow }}>{cs.sheet?.steelGrade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label style={{ fontSize: 12, color: C.yellow, display: 'block', marginBottom: 4, fontWeight: 700 }}>
          Причина переоткрытия (обязательно):
        </label>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          rows={2} placeholder="Например: ошибочно закрыли, нужно добавить ещё листы..."
          style={{ width: '100%', padding: 8, background: C.inputBg, color: C.text, border: `1px solid ${C.panelBd}`, borderRadius: 4, marginBottom: 12, boxSizing: 'border-box' }} />

        {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'transparent', color: C.dim, border: `1px solid ${C.panelBd}`,
            borderRadius: 4, padding: '8px 16px', cursor: 'pointer',
          }}>Отмена</button>
          <button onClick={handleConfirm} disabled={loading || !reason.trim()}
            style={{
              background: loading || !reason.trim() ? C.btnDis : C.orange,
              color: '#000', border: 'none', borderRadius: 4,
              padding: '8px 16px', cursor: 'pointer', fontWeight: 700,
            }}>
            {loading ? '⏳ Переоткрытие...' : '🔓 Подтвердить переоткрытие'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Карточка закрытой кассеты ──
function ClosedCassetteCard({ cassette, onRefresh, isMaster, cassettesInFurnaces, onReopenClick }) {
  const lastSheet = cassette.sheets?.[cassette.sheets.length - 1];
  const inFurnace = cassettesInFurnaces.includes(String(cassette.cassette_number));

  const melts = new Set(cassette.sheets?.map(s => s.sheet?.meltNumber).filter(Boolean) || []);
  const grades = new Set(cassette.sheets?.map(s => s.sheet?.steelGrade).filter(Boolean) || []);

  return (
    <div style={{
      width: 360, flexShrink: 0,
      background: C.panel, border: `2px solid ${C.orange}`,
      borderRadius: 10, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 1 }}>КАССЕТА №{cassette.cassette_number}</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{cassette.businessKey}</div>
        </div>
        <div style={{ background: C.orange, color: '#000', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
          🔒 {cassette.sheets?.length || 0} л.
        </div>
      </div>

      <div style={{
        background: '#1a2f4a', padding: 10, borderRadius: 6,
        border: `1px solid ${C.accent}`, display: 'flex', gap: 14, fontSize: 12,
      }}>
        <div>
          <div style={{ color: C.dim, fontSize: 10 }}>ПЛАВОК</div>
          <div style={{ color: C.accent, fontWeight: 700, fontSize: 18 }}>{melts.size}</div>
        </div>
        
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ color: C.dim, fontSize: 10 }}>ПОСЛЕДНИЙ</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: C.accent }}>
             {lastSheet ? `${lastSheet.sheet?.meltNumber}/${lastSheet.sheet?.batchNumber}/${lastSheet.sheet?.packNumber}/${lastSheet.sheet?.sheetNumber}` : '—'}
          </div>
          
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.dim }}>
        Закрыта: <b>{new Date(cassette.closedAt || cassette.closed_at).toLocaleString('ru-RU', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        })}</b>
      </div>

      {inFurnace ? (
        <div style={{ background: '#4a1a1a', color: C.red, padding: 10, borderRadius: 6, fontSize: 13, textAlign: 'center', fontWeight: 700 }}>
          ♨ УЖЕ В ПЕЧИ
        </div>
      ) : (
        <>
          {isMaster && (
            <button onClick={() => onReopenClick(cassette)}
              style={{
                width: '100%', padding: 8, fontSize: 11,
                background: 'transparent', color: C.orange,
                border: `1px solid ${C.orange}`, borderRadius: 4, cursor: 'pointer',
              }}>
              🔓 Переоткрыть (мастер)
            </button>
          )}
        </>
      )}
    </div>
  );
}
/* ── Модалка добавления листов в кассету ── */
function AddSheetsModal({ open, onClose, onAdd, businessKey }) {
  const [filters, setFilters] = useState({
    melt: '',
    batch: '',
    pack: '',
    sheet: '',
    steelGrade: '',
  });
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Загрузка доступных листов
  const loadAvailable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.melt) params.append('melt', filters.melt);
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.pack) params.append('pack', filters.pack);
      if (filters.sheet) params.append('sheet', filters.sheet);
      if (filters.steelGrade) params.append('steelGrade', filters.steelGrade);
      params.append('limit', '200');

      const res = await api.get(`/cassettenew/available-sheets?${params}`);
      setAvailable(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (open) {
      loadAvailable();
      setSelected([]);
    }
  }, [open, loadAvailable]);

  const toggleSelection = (matId) => {
    setSelected(prev => 
      prev.includes(matId) 
        ? prev.filter(id => id !== matId)
        : [...prev, matId]
    );
  };

  const selectAll = () => {
    if (selected.length === available.length) {
      setSelected([]);
    } else {
      setSelected(available.map(s => s.matId));
    }
  };

  const handleAdd = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      for (const matId of selected) {
        await api.post(`/cassettenew/${encodeURIComponent(businessKey)}/add-sheet`, { matId });
      }
      onAdd(selected.length);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка добавления');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const allSelected = available.length > 0 && selected.length === available.length;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: C.panel, border: `2px solid ${C.green}`, borderRadius: 10,
        padding: 24, minWidth: 800, maxWidth: '95vw', maxHeight: '90vh', color: C.text,
        display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: C.green }}>➕ Добавить листы в кассету</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>

        {/* Фильтры */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12,
          padding: 12, background: C.bg, borderRadius: 6, border: `1px solid ${C.panelBd}`
        }}>
          {[
            { key: 'melt', label: 'Плавка', placeholder: '123' },
            { key: 'batch', label: 'Партия', placeholder: '456' },
            { key: 'pack', label: 'Пачка', placeholder: '789' },
            { key: 'sheet', label: 'Лист', placeholder: '10' },
            { key: 'steelGrade', label: 'Марка стали', placeholder: 'AMg2' },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: C.dim, fontWeight: 600 }}>{f.label}</label>
              <input
                type="text"
                value={filters[f.key]}
                onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{
                  padding: '6px 8px', fontSize: 12, background: C.inputBg, color: C.text,
                  border: `1px solid ${C.panelBd}`, borderRadius: 4, fontFamily: 'monospace',
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={loadAvailable} disabled={loading}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 700,
              background: loading ? C.btnDis : C.accent, color: '#000',
              border: 'none', borderRadius: 4, cursor: 'pointer',
            }}>
            {loading ? '🔍 Поиск...' : '🔍 Найти'}
          </button>
          <button onClick={selectAll} disabled={available.length === 0}
            style={{
              padding: '8px 16px', fontSize: 12,
              background: allSelected ? C.green : 'transparent',
              color: allSelected ? '#000' : C.dim,
              border: `1px solid ${C.panelBd}`, borderRadius: 4, cursor: 'pointer',
            }}>
            {allSelected ? '✓ Снять выбор' : `✓ Выбрать все (${available.length})`}
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.dim, alignSelf: 'center' }}>
            Выбрано: <b style={{ color: C.accent }}>{selected.length}</b>
          </span>
        </div>

        {error && (
          <div style={{ padding: 8, background: '#4a1a1a', color: C.red, borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        {/* Таблица листов */}
        <div style={{ 
          flex: 1, overflowY: 'auto', background: C.bg, borderRadius: 6, 
          border: `1px solid ${C.panelBd}`, marginBottom: 12,
          minHeight: 300, maxHeight: 500,
        }}>
          {loading && available.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.dim }}>Загрузка...</div>
          ) : available.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.dim }}>
              Нет доступных листов{filters.melt || filters.batch || filters.pack || filters.sheet || filters.steelGrade ? ' по заданным фильтрам' : ''}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, background: C.panel, zIndex: 1 }}>
                <tr style={{ borderBottom: `1px solid ${C.panelBd}` }}>
                  <th style={{ padding: '8px', width: 30 }}>
                    <input type="checkbox" checked={allSelected} onChange={selectAll} />
                  </th>
                  {['Мат.ключ', 'Плавка', 'Партия', 'Пачка', 'Лист', 'Марка', 'Размеры'].map(h => (
                    <th key={h} style={{ padding: '8px', color: C.dim, textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {available.map(s => {
                  const isSelected = selected.includes(s.matId);
                  return (
                    <tr key={s.matId} 
                      onClick={() => toggleSelection(s.matId)}
                      style={{ 
                        borderBottom: `1px solid ${C.panelBd}22`, 
                        cursor: 'pointer',
                        background: isSelected ? '#1a472a' : 'transparent',
                      }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => {}} />
                      </td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{s.matId}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.meltNumber}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.batchNumber}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.packNumber}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{s.sheetNumber}</td>
                      <td style={{ padding: '6px 8px', color: C.yellow }}>{s.steelGrade || '—'}</td>
                      <td style={{ padding: '6px 8px', color: C.dim, fontSize: 10 }}>{s.sheetDimensions || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Кнопки действий */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'transparent', color: C.dim, border: `1px solid ${C.panelBd}`,
            borderRadius: 4, padding: '10px 20px', cursor: 'pointer',
          }}>Отмена</button>
          <button onClick={handleAdd} disabled={selected.length === 0 || loading}
            style={{
              background: selected.length === 0 || loading ? C.btnDis : C.green,
              color: '#000', border: 'none', borderRadius: 4,
              padding: '10px 20px', cursor: 'pointer', fontWeight: 700,
            }}>
            {loading ? '⏳ Добавление...' : `➕ Добавить ${selected.length} листов`}
          </button>
        </div>
      </div>
    </div>
  );
}
// ════════════════════════════════════════════════════════════════════
// ОСНОВНОЙ КОМПОНЕНТ
// ════════════════════════════════════════════════════════════════════
export default function OperatorWorkplace() {
  const { values, connected } = useOpcUa([
    'PLC210.X2_ZoneOccup', 'PLC210.X2_Melt', 'PLC210.X2_Slab', 'PLC210.X2_PartNo', 'PLC210.X2_Pack',
    'PLC210.X2_Sheet', 'PLC210.X2_SubSheet', 'PLC210.X2_SheetInPack', 'PLC210.X2_SheetsInPack',
    'PLC210.X2_Thikness', 'PLC210.X2_AlloyCodeText',
  ]);

  const { user } = useAuth();
  const isMaster = ['master', 'superadmin', 'developer'].includes(user?.role || '');

  const toNum = v => { if (v == null) return null; const n = Number(v); return isNaN(n) ? null : n; };
  const toStr = v => (v == null ? null : String(v));

  const [lastCreatedKey, setLastCreatedKey] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [before, setBefore] = useState(emptyGrid());
  const [after, setAfter] = useState(emptyGrid());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const [currentCassette, setCurrentCassette] = useState(null);
  const [closedCassettes, setClosedCassettes] = useState([]);
  const [cassetteNumber, setCassetteNumber] = useState('');
  const [furnacesStatus, setFurnacesStatus] = useState([]);
  const [cassetteStatus, setCassetteStatus] = useState(null);

  const [editModal, setEditModal] = useState(null);
  const [removeModal, setRemoveModal] = useState(null);
  const [reopenModal, setReopenModal] = useState(null);
const [addSheetsModal, setAddSheetsModal] = useState(false);
  const currentRecordRef = useRef(null);
  useEffect(() => { currentRecordRef.current = currentRecord; }, [currentRecord]);

  // ── API helpers ──
  const fetchQueue = useCallback(async () => {
    try { const res = await api.get('/measurement/queue'); setQueue(res.data); }
    catch (err) { console.error('Ошибка очереди:', err); }
  }, []);

  const fetchFurnacesStatus = useCallback(async () => {
    try { const res = await api.get('/cassettenew/furnaces-status'); setFurnacesStatus(res.data); }
    catch (err) { console.error('Ошибка печей:', err); }
  }, []);

  const refreshAllCassettes = useCallback(async () => {
    try {
      const res = await api.get('/cassettenew/list');
      const all = res.data || [];
      const active = all.find(c => !c.is_closed);
      const closed = all.filter(c => c.is_closed);

      const closedWithSheets = await Promise.all(
        closed.map(async c => {
          try {
            const sheetsRes = await api.get(`/cassettenew/${encodeURIComponent(c.business_key)}/sheets`);
            return { ...c, businessKey: c.business_key, sheets: sheetsRes.data };
          } catch { return { ...c, businessKey: c.business_key, sheets: [] }; }
        })
      );
      setClosedCassettes(closedWithSheets);

      if (active) {
        try {
          const sheetsRes = await api.get(`/cassettenew/${encodeURIComponent(active.business_key)}/sheets`);
          const statusRes = await api.get(`/cassettenew/${encodeURIComponent(active.business_key)}/status`);
          setCurrentCassette({ businessKey: active.business_key, sheets: sheetsRes.data });
          setCassetteStatus(statusRes.data);
        } catch (err) {
          if (err.response?.status === 404) { setCurrentCassette(null); setCassetteStatus(null); }
        }
      } else { setCurrentCassette(null); setCassetteStatus(null); }
    } catch (err) { console.error('Ошибка загрузки кассет:', err); }
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
    const id = setInterval(() => { fetchQueue(); fetchFurnacesStatus(); refreshAllCassettes(); }, 5000);
    return () => clearInterval(id);
  }, [initialLoadDone, fetchQueue, fetchFurnacesStatus, refreshAllCassettes]);

  // ── Автозагрузка первого листа ──
  useEffect(() => {
    if (!initialLoadDone) return;
    if (!currentRecordRef.current && queue.length > 0) loadRecord(queue[0].id);
  }, [queue, initialLoadDone]);

  // ── Слежение за X2 ──
  useEffect(() => {
    const occ = toNum(values['PLC210.X2_ZoneOccup']?.value);
    if (occ !== 1 && occ !== true) { setLastCreatedKey(null); return; }
    const sheet = {
      melt: toNum(values['PLC210.X2_Melt']?.value), slab: toNum(values['PLC210.X2_Slab']?.value),
      partNo: toNum(values['PLC210.X2_PartNo']?.value), pack: toNum(values['PLC210.X2_Pack']?.value),
      sheet: toNum(values['PLC210.X2_Sheet']?.value), sheetInPack: toNum(values['PLC210.X2_SheetInPack']?.value),
      sheetsInPack: toNum(values['PLC210.X2_SheetsInPack']?.value),
      thickness: toNum(values['PLC210.X2_Thikness']?.value),
      alloyCodeText: toStr(values['PLC210.X2_AlloyCodeText']?.value),
    };
    const key = `${sheet.melt}/${sheet.partNo}/${sheet.pack}/${sheet.sheet}`;
    if (!key || key === lastCreatedKey || !sheet.melt || !sheet.sheet) return;
    setLastCreatedKey(key);
    api.post('/measurement', { ...sheet, enteredX2At: new Date().toISOString() })
      .then(() => { fetchQueue(); setMessage({ type: 'success', text: `📥 Лист ${sheet.melt}/${sheet.sheet} в очереди` }); })
      .catch(err => { if (err.response?.status === 409) fetchQueue(); else console.error(err); });
  }, [values, lastCreatedKey, fetchQueue]);

  // ── Загрузка записи ──
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

  // ── Сохранение замеров ──
  const handleSave = async () => {
    if (!currentRecord?.id) return;
    setSaving(true);
    try {
      const payload = {};
      for (let i = 1; i <= 8; i++) { payload[`h${i}Before`] = before[i-1]; payload[`h${i}After`] = after[i-1]; }
      payload.measuredBy = user?.username || 'operator';
      payload.measuredAt = new Date().toISOString();
      await api.put(`/measurement/${currentRecord.id}`, payload);
      setMessage({ type: 'success', text: '✓ Замеры сохранены! Можно добавить в кассету →' });
      await fetchQueue();
      setCurrentRecord(prev => prev ? { ...prev, measuredAt: payload.measuredAt, measuredBy: payload.measuredBy } : prev);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Ошибка' });
    } finally { setSaving(false); }
  };

  // ── Создание кассеты ──
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

  // ── Добавление листа в кассету ──
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

const handleAddSheetsSuccess = async (count) => {
  setMessage({ type: 'success', text: `✓ Добавлено ${count} листов в кассету` });
  // Обновляем состав кассеты
  if (currentCassette) {
    const res = await api.get(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/sheets`);
    setCurrentCassette({ ...currentCassette, sheets: res.data });
    const statusRes = await api.get(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/status`);
    setCassetteStatus(statusRes.data);
  }
  await fetchQueue();
};
  // ── Закрытие кассеты ──
  const handleCloseCassette = async () => {
    if (!currentCassette) return;
    if (!window.confirm('Закрыть кассету? После закрытия нельзя будет добавить новые листы.')) return;
    try {
      await api.post(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/close`);
      setMessage({ type: 'success', text: '🔒 Кассета закрыта. Отправьте в печь на странице "Печи отпуска".' });
      await refreshAllCassettes();
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || err.message }); }
  };

  // ── Удаление листа из кассеты ──
  const handleRemoveSheet = async () => {
    if (!removeModal || !currentCassette || !removeModal.reason.trim()) return;
    try {
      await api.delete(
        `/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/remove-sheet/${removeModal.matId}`,
        { data: { reason: removeModal.reason } }
      );
      const res = await api.get(`/cassettenew/${encodeURIComponent(currentCassette.businessKey)}/sheets`);
      setCurrentCassette({ ...currentCassette, sheets: res.data });
      setRemoveModal(null);
      setMessage({ type: 'success', text: 'Лист удалён из кассеты' });
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || err.message }); }
  };

  // ── ПЕРЕОТКРЫТИЕ КАССЕТЫ ──
  const handleReopenClick = async (cassette) => {
    try {
      const res = await api.get(`/cassettenew/${encodeURIComponent(cassette.businessKey)}/sheets`);
      setReopenModal({ cassette, sheets: res.data });
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка загрузки листов кассеты' });
    }
  };

  const confirmReopen = async (reason) => {
    if (!reopenModal?.cassette) return;
    try {
      await api.post(
        `/cassettenew/${encodeURIComponent(reopenModal.cassette.businessKey)}/reopen`,
        { reason }
      );
      setMessage({ type: 'success', text: `✅ Кассета №${reopenModal.cassette.cassette_number} переоткрыта` });
      setReopenModal(null);
      await refreshAllCassettes();
    } catch (err) {
      throw err; // пробрасываем ошибку в модалку
    }
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
          <div style={{
            background: queue.length > 0 ? C.yellow : C.green,
            color: '#000', padding: '4px 12px', borderRadius: 4,
            fontSize: 13, fontWeight: 700,
          }}>
            Очередь: {queue.length}
          </div>
          <div style={{
            background: C.orange, color: '#000', padding: '4px 12px', borderRadius: 4,
            fontSize: 13, fontWeight: 700,
          }}>
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

      {/* ▼ ЗОНА 1: ДО КАНТОВКИ */}
      <div style={{
        background: '#0d111788', border: `1px solid ${C.accent}`,
        borderRadius: 8, padding: 10,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: C.accent,
          marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase',
          borderBottom: `1px solid ${C.panelBd}`, paddingBottom: 4,
        }}>▼ ДО КАНТОВКИ — формирование кассеты</div>

        <div style={{ display: 'flex', gap: 12 }}>
          {/* Очередь */}
          <div style={{
            width: 260, flexShrink: 0,
            background: C.panel, border: `1px solid ${C.panelBd}`,
            borderRadius: 6, padding: 12,
            display: 'flex', flexDirection: 'column',
            maxHeight: 620,
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
                    {item.measuredAt && <div style={{ fontSize: 9, color: C.green, marginTop: 2 }}>✓ Измерен</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Центр: замеры */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentRecord ? (
              <>
                <div style={{
                  background: C.panel, border: `1px solid ${C.accent}`,
                  borderRadius: 6, padding: '8px 12px',
                  display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12,
                }}>
				{/* <div><span style={{ color: C.dim }}>MatId:</span> <b style={{ color: C.accent }}>{currentRecord.matId}</b></div>*/}
                  <div><span style={{ color: C.dim }}>Плавка:</span> <b>{currentRecord.melt}</b></div>
                  <div><span style={{ color: C.dim }}>Лист:</span> <b style={{ color: C.accent }}>{currentRecord.sheet}</b></div>
                  <div><span style={{ color: C.dim }}>Партия:</span> <b style={{ color: C.yellow }}>{currentRecord.partNo}</b></div>
				   <div><span style={{ color: C.dim }}>Пачка:</span> <b style={{ color: C.yellow }}>{currentRecord.pack}</b></div>
				   <div><span style={{ color: C.dim }}>Толщ:</span> <b style={{ color: C.yellow }}>{currentRecord.thickness}</b></div>
				  <div><span style={{ color: C.dim }}>Марка:</span> <b style={{ color: C.yellow }}>{currentRecord.alloyCodeText}</b></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <MeasGrid title="До кантовки" values={before}
                    onChange={(i, v) => setBefore(p => { const n = [...p]; n[i] = v; return n; })}
                    disabled={saving || alreadyMeasured} />
                  <MeasGrid title="После кантовки" values={after}
                    onChange={(i, v) => setAfter(p => { const n = [...p]; n[i] = v; return n; })}
                    disabled={saving || alreadyMeasured} />
                </div>
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  {!alreadyMeasured ? (
                    <button onClick={handleSave} disabled={saving || !allFilled}
                      style={{
                        minWidth: 420, padding: '14px 32px', fontSize: 16, fontWeight: 700,
                        background: (saving || !allFilled) ? C.btnDis : C.btnBg,
                        color: '#fff', border: 'none', borderRadius: 8,
                        cursor: (saving || !allFilled) ? 'not-allowed' : 'pointer',
                        boxShadow: allFilled ? `0 0 12px ${C.btnBg}80` : 'none',
                      }}>
                      {saving ? '⏳ Сохранение...' : allFilled ? '💾 СОХРАНИТЬ ЗАМЕРЫ' : `⚠ Заполните все 16 точек (осталось ${16 - [...before, ...after].filter(v => v != null).length})`}
                    </button>
                  ) : (
                    <div style={{ display: 'inline-block', padding: '10px 24px', background: '#1b5e20', borderRadius: 6, color: '#a5d6a7', fontSize: 14, fontWeight: 700 }}>
                      ✓ Измерено — {new Date(currentRecord.measuredAt).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: C.dim, background: C.panel, borderRadius: 6 }}>
                Выберите лист из очереди ←
              </div>
            )}
          </div>

          {/* Активная кассета */}
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
                <NumericInput
                  value={cassetteNumber}
                  onChange={v => setCassetteNumber(v != null ? String(v) : '')}
                  style={{
                    padding: 10, fontSize: 16, background: C.inputBg, color: C.text,
                    border: `1px solid ${C.panelBd}`, borderRadius: '4px 0 0 4px', width: '100%',
                  }}
                />
                {cassettesInFurnaces.length > 0 && (
                  <div style={{ background: '#e6510022', border: `1px solid ${C.yellow}`, padding: 6, borderRadius: 4, fontSize: 10 }}>
                    ⚠ В печах: <b>{cassettesInFurnaces.join(', ')}</b>
                  </div>
                )}
                <button onClick={handleCreateCassette} disabled={!cassetteNumber}
                  style={{
                    padding: 12, fontSize: 13, fontWeight: 700,
                    background: !cassetteNumber ? C.btnDis : C.green,
                    color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer',
                  }}>✅ Создать кассету</button>
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

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280 }}>
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
                      {isMaster && !cassetteStatus?.is_closed && (
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
                    padding: 10, fontSize: 12, fontWeight: 700,
                    background: !canAddToCassette ? C.btnDis : C.green,
                    color: '#000', border: 'none', borderRadius: 4,
                    cursor: canAddToCassette ? 'pointer' : 'not-allowed',
                  }}>
                  {canAddToCassette ? `➕ Добавить ${currentRecord?.melt}/${currentRecord?.sheet}` : '⚠ Сначала замеры'}
                </button>
				{/* Кнопка массового добавления листов */}
{!cassetteStatus?.is_closed && (
  <button onClick={() => setAddSheetsModal(true)}
    style={{
      padding: 10, fontSize: 12, fontWeight: 700,
      background: C.accent, color: '#000',
      border: 'none', borderRadius: 4, cursor: 'pointer',
      marginBottom: 4,
    }}>
    ➕ Добавить листы из очереди закалки
  </button>
)}
                {currentCassette.sheets.length > 0 && !cassetteStatus?.is_closed && (
                  <button onClick={handleCloseCassette}
                    style={{
                      padding: 10, fontSize: 12, fontWeight: 700,
                      background: C.orange, color: '#000',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                    }}>🔒 Закончить формирование ({currentCassette.sheets.length} л.)</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ▼ ЗОНА 2: ПОСЛЕ КАНТОВКИ */}
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
          <span>▼ ПОСЛЕ КАНТОВКИ — готовы к печи ({closedCassettes.length})</span>
          <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>
            В печах: {cassettesInFurnaces.length > 0 ? cassettesInFurnaces.join(', ') : '—'}
          </span>
        </div>

        {closedCassettes.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.dim, fontSize: 13 }}>
            🕐 Нет закрытых кассет. Завершите формирование в верхней зоне ↑
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {closedCassettes.map(c => (
              <ClosedCassetteCard
                key={c.businessKey}
                cassette={c}
                onRefresh={refreshAllCassettes}
                isMaster={isMaster}
                cassettesInFurnaces={cassettesInFurnaces}
                onReopenClick={handleReopenClick}
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
              Лист <b style={{ color: C.accent }}>{removeModal.matId}</b> будет удалён из кассеты.
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

{addSheetsModal && (
  <AddSheetsModal
    open={addSheetsModal}
    onClose={() => setAddSheetsModal(false)}
    onAdd={handleAddSheetsSuccess}
    businessKey={currentCassette?.businessKey}
  />
)}
      {reopenModal && (
        <ReopenCassetteModal
          cassette={reopenModal.cassette}
          sheets={reopenModal.sheets}
          onClose={() => setReopenModal(null)}
          onConfirm={confirmReopen}
        />
      )}
    </div>
  );
}