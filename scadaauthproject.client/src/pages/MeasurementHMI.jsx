// src/pages/MeasurementHMI.jsx
import React, { useState, useEffect } from 'react';
import api from '../api';
import { useOpcUa } from '../hooks/useOpcUa';

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
    bg: '#1a1a2e',
    panel: '#0f0f1a',
    header: '#16213e',
    blue: '#1565c0',
    blueHdr: '#1976d2',
    inputBg: '#263238',
    inputBdr: '#37474f',
    okBdr: '#2e7d32',
    warnBdr: '#f57c00',
    errBdr: '#c62828',
    text: '#e0e0e0',
    textDim: '#78909c',
    textHdr: '#bbdefb',
    green: '#4caf50',
    red: '#f44336',
    btnBg: '#1565c0',
    btnDis: '#37474f',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const toStr = v => (v == null ? null : String(v));
const toNum = v => { if (v == null) return null; const n = Number(v); return isNaN(n) ? null : n; };
const sheetKey = s => s ? `${s.melt}/${s.partNo}/${s.pack}/${s.sheet}` : null;
const emptyGrid = () => ({ h1: null, h2: null, h3: null, h4: null, h5: null, h6: null, h7: null, h8: null });
const bdrColor = v => { if (v == null) return C.inputBdr; const a = Math.abs(v); return a > 1.0 ? C.errBdr : a > 0.5 ? C.warnBdr : C.okBdr; };

// ── Одно поле измерения ───────────────────────────────────────────────────
function HCell({ label, value, onChange, disabled }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{label}</span>
            <input
                type="number" step="0.1" disabled={disabled}
                value={value ?? ''}
                onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                style={{
                    width: 60, textAlign: 'center', fontFamily: 'monospace',
                    fontSize: 15, fontWeight: 600,
                    color: value != null ? C.text : C.textDim,
                    background: C.inputBg,
                    border: `2px solid ${bdrColor(value)}`,
                    borderRadius: 4, padding: '3px 2px', outline: 'none',
                    cursor: disabled ? 'not-allowed' : 'text',
                    opacity: disabled ? 0.7 : 1,
                }}
            />
        </div>
    );
}

// ── Сетка 8 точек (периметр листа) ────────────────────────────────────────
//      h1  h2  h3
//  h8              h4
//      h7  h6  h5
function MeasGrid({ title, values, onChange, disabled }) {
    const c = name => (
        <HCell key={name} label={name.toUpperCase()} value={values[name]}
            onChange={v => onChange(name, v)} disabled={disabled} />
    );
    const COL = '64px 1fr 1fr 1fr 64px';
    return (
        <div style={{
            flex: 1, background: C.panel, border: `1px solid ${C.inputBdr}`,
            borderRadius: 6, padding: '10px 12px 14px',
        }}>
            <div style={{
                textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.textHdr,
                marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1
            }}>
                {title}
            </div>
            {/* Top: h1 h2 h3 */}
            <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 6, marginBottom: 6, alignItems: 'end' }}>
                <div />{c('h1')}{c('h2')}{c('h3')}<div />
            </div>
            {/* Middle: h8 [void] h4 */}
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 64px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                {c('h8')}
                <div style={{ height: 28, border: `1px dashed ${C.inputBdr}`, borderRadius: 4, opacity: 0.25 }} />
                {c('h4')}
            </div>
            {/* Bottom: h7 h6 h5 */}
            <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 6, alignItems: 'start' }}>
                <div />{c('h7')}{c('h6')}{c('h5')}<div />
            </div>
        </div>
    );
}

// ── Ячейка параметра листа ────────────────────────────────────────────────
function ParamCell({ label, value, wide }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minWidth: wide ? 90 : 60, padding: '2px 10px',
            borderRight: `1px solid #1e3a5f`,
        }}>
            <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {value ?? '—'}
            </span>
        </div>
    );
}

// ── Основной компонент ─────────────────────────────────────────────────────
export default function MeasurementHMI() {
    const { values, connected } = useOpcUa([
        'X2_ZoneOccup',
        'X2_Melt', 'X2_Slab', 'X2_PartNo', 'X2_Pack',
        'X2_Sheet', 'X2_SubSheet', 'X2_SheetInPack', 'X2_SheetsInPack',
        'X2_Thikness', 'X2_AlloyCodeText',
        'X2_SeqNo', 'X2_PlatePos', 'X2_State',
    ]);

    const [currentSheet, setCurrentSheet] = useState(null);
    const [dbRecord, setDbRecord] = useState(null);
    const [before, setBefore] = useState(emptyGrid());
    const [after, setAfter] = useState(emptyGrid());
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [opcSheetKey, setOpcSheetKey] = useState(null);

    // ── Слежение за X2 ───────────────────────────────────────────────────
    useEffect(() => {
        const occ = toNum(values['X2_ZoneOccup']?.value);
        if (occ === 1 || occ === true) {
            const sheet = {
                melt: toNum(values['X2_Melt']?.value),
                slab: toNum(values['X2_Slab']?.value),
                partNo: toNum(values['X2_PartNo']?.value),
                pack: toNum(values['X2_Pack']?.value),
                sheet: toNum(values['X2_Sheet']?.value),
                subSheet: toNum(values['X2_SubSheet']?.value),
                sheetInPack: toNum(values['X2_SheetInPack']?.value),
                sheetsInPack: toNum(values['X2_SheetsInPack']?.value),
                thickness: toStr(values['X2_Thikness']?.value),
                alloyCodeText: toStr(values['X2_AlloyCodeText']?.value),
                seqNo: toNum(values['X2_SeqNo']?.value),
                state: toStr(values['X2_State']?.value),
            };
            const key = sheetKey(sheet);
            if (key && key !== opcSheetKey) {
                setOpcSheetKey(key);
                setCurrentSheet(sheet);
                setDbRecord(null);
                setBefore(emptyGrid());
                setAfter(emptyGrid());
                setMessage(null);
            }
        } else {
            if (opcSheetKey !== null) {
                setOpcSheetKey(null); setCurrentSheet(null);
                setDbRecord(null); setBefore(emptyGrid()); setAfter(emptyGrid());
                setMessage(null);
            }
        }
    }, [values, opcSheetKey]);

    // ── Загрузка / создание записи БД ────────────────────────────────────
    useEffect(() => {
        if (!currentSheet) return;
        (async () => {
            try {
                const res = await api.get('/measurement/current', {
                    params: {
                        melt: currentSheet.melt, partNo: currentSheet.partNo,
                        pack: currentSheet.pack, sheet: currentSheet.sheet
                    },
                });
                setDbRecord(res.data);
                if (res.data?.measuredAt) {
                    const b = {}, a = {};
                    for (let i = 1; i <= 8; i++) {
                        b[`h${i}`] = res.data[`h${i}Before`] ?? null;
                        a[`h${i}`] = res.data[`h${i}After`] ?? null;
                    }
                    setBefore(b); setAfter(a);
                }
            } catch (err) {
                if (err.response?.status === 404) {
                    try {
                        const cr = await api.post('/measurement', {
                            melt: currentSheet.melt, slab: currentSheet.slab,
                            partNo: currentSheet.partNo, pack: currentSheet.pack,
                            sheet: currentSheet.sheet, sheetInPack: currentSheet.sheetInPack,
                            sheetsInPack: currentSheet.sheetsInPack,
                            thickness: toNum(currentSheet.thickness),
                            alloyCodeText: currentSheet.alloyCodeText,
                            enteredX2At: new Date().toISOString(),
                        });
                        setDbRecord(cr.data);
                    } catch (e) {
                        setMessage({ type: 'error', text: 'Ошибка создания записи: ' + (e.response?.data?.message ?? e.message) });
                    }
                }
            }
        })();
    }, [currentSheet]);

    // ── Сохранение ───────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!dbRecord?.id) return;
        setSaving(true);
        try {
            const payload = {};
            for (let i = 1; i <= 8; i++) { payload[`h${i}Before`] = before[`h${i}`]; payload[`h${i}After`] = after[`h${i}`]; }
            payload.measuredBy = localStorage.getItem('username') || 'operator';
            payload.measuredAt = new Date().toISOString();
            const res = await api.put(`/measurement/${dbRecord.id}`, payload);
            setDbRecord(res.data);
            setMessage({ type: 'success', text: 'Измерения сохранены' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message ?? 'Ошибка сохранения' });
        } finally { setSaving(false); }
    };

    const allFilled = () => { for (let i = 1; i <= 8; i++) if (before[`h${i}`] == null || after[`h${i}`] == null) return false; return true; };
    const alreadyMeasured = dbRecord?.measuredAt != null;
    const s = currentSheet;

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Roboto Mono',monospace", color: C.text }}>

            {/* Шапка */}
            <div style={{
                background: C.header, borderBottom: `2px solid ${C.blue}`,
                display: 'flex', alignItems: 'stretch', minHeight: 56
            }}>
                {/* ПЛК БАЗА */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
                    borderRight: `1px solid #1e3a5f`, minWidth: 120
                }}>
                    <div style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                        background: connected ? C.green : C.red,
                        boxShadow: connected ? `0 0 8px ${C.green}` : 'none'
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.textHdr, letterSpacing: 1 }}>ПЛК БАЗА</span>
                </div>

                {/* Заголовок параметров */}
                <div style={{
                    background: C.blueHdr, display: 'flex', alignItems: 'center',
                    padding: '0 14px', borderRight: `1px solid #1e3a5f`
                }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                        Параметры листа
                    </span>
                </div>

                {/* Поля */}
                {s ? (
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                        <ParamCell label="Плавка №" value={s.melt} />
                        <ParamCell label="Слиб" value={s.slab} />
                        <ParamCell label="Партия" value={s.partNo} />
                        <ParamCell label="Пачка" value={s.pack} />
                        <ParamCell label="Лист" value={s.sheet} />
                        <ParamCell label="Марка" value={s.alloyCodeText} wide />
                        <ParamCell label="Толщина" value={s.thickness} />
                        <ParamCell label="Листов в пачке" value={s.sheetsInPack} wide />
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', flex: 1 }}>
                        <span style={{ color: C.textDim, fontSize: 13 }}>
                            {connected ? 'Ожидание листа на X2...' : '⚠ OPC UA не подключён'}
                        </span>
                    </div>
                )}

                {alreadyMeasured && (
                    <div style={{
                        display: 'flex', alignItems: 'center', padding: '0 16px',
                        background: '#1b5e20', borderLeft: `1px solid #2e7d32`
                    }}>
                        <span style={{ fontSize: 12, color: '#a5d6a7', fontWeight: 700 }}>✓ ИЗМЕРЕНО</span>
                    </div>
                )}
            </div>

            {/* Сообщение */}
            {message && (
                <div style={{
                    padding: '7px 16px',
                    background: message.type === 'success' ? '#1b5e20' : message.type === 'error' ? '#b71c1c' : '#0d47a1',
                    borderBottom: `1px solid ${C.inputBdr}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span style={{ fontSize: 13 }}>{message.text}</span>
                    <button onClick={() => setMessage(null)}
                        style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
            )}

            {/* Тело */}
            {s ? (
                <div style={{ padding: '16px 20px' }}>
                    {/* Сетки */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        <MeasGrid title="До кантовки" values={before}
                            onChange={(k, v) => setBefore(p => ({ ...p, [k]: v }))} disabled={saving || alreadyMeasured} />
                        <MeasGrid title="После кантовки" values={after}
                            onChange={(k, v) => setAfter(p => ({ ...p, [k]: v }))} disabled={saving || alreadyMeasured} />
                    </div>

                    {/* Кнопка / статус */}
                    <div style={{ textAlign: 'center' }}>
                        {!alreadyMeasured ? (
                            <button
                                onClick={handleSave}
                                disabled={saving || !allFilled()}
                                style={{
                                    minWidth: 280, padding: '10px 24px', fontSize: 15, fontWeight: 700,
                                    fontFamily: 'inherit', letterSpacing: 1, textTransform: 'uppercase',
                                    background: (saving || !allFilled()) ? C.btnDis : C.btnBg,
                                    color: '#fff', border: 'none', borderRadius: 5,
                                    cursor: (saving || !allFilled()) ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {saving ? '⏳ Сохранение...' : allFilled() ? '💾 Сохранить замеры' : '⚠ Заполните все 16 точек'}
                            </button>
                        ) : (
                            <div style={{
                                display: 'inline-block', padding: '8px 20px', background: '#1b5e20',
                                borderRadius: 5, color: '#a5d6a7', fontSize: 14, fontWeight: 700
                            }}>
                                ✓ Замеры сохранены — {new Date(dbRecord.measuredAt).toLocaleString('ru-RU')}
                                {dbRecord.measuredBy ? ` (${dbRecord.measuredBy})` : ''}
                            </div>
                        )}
                    </div>

                    {/* Мета-строка */}
                    {dbRecord && (
                        <div style={{
                            marginTop: 14, display: 'flex', gap: 24, justifyContent: 'center',
                            fontSize: 11, color: C.textDim
                        }}>
                            <span>ID: {dbRecord.id}</span>
                            <span>Создана: {dbRecord.createdAt ? new Date(dbRecord.createdAt).toLocaleString('ru-RU') : '—'}</span>
                            <span>Вход X2: {dbRecord.enteredX2At ? new Date(dbRecord.enteredX2At).toLocaleString('ru-RU') : '—'}</span>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: 300, color: C.textDim, fontSize: 16
                }}>
                    {connected ? 'Лист на X2 не обнаружен' : '⚠ Нет соединения с OPC UA'}
                </div>
            )}
        </div>
    );
}