// src/pages/MeasurementHMI.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useOpcUa } from '../hooks/useOpcUa';

// ── Palette ─────────────────────────────────────────────────────────────
const C = {
    bg: '#0d1117', panel: '#161b22', panelBd: '#30363d',
    header: '#1a2332',
    text: '#e6edf3', textDim: '#7d8590', textHdr: '#bbdefb',
    accent: '#58a6ff', green: '#3fb950', red: '#f85149', yellow: '#d29922',
    inputBg: '#21262d', inputBdr: '#37474f',
    okBdr: '#2e7d32', warnBdr: '#f57c00', errBdr: '#c62828',
    btnBg: '#1565c0', btnDis: '#37474f',
};

// ── Helpers ─────────────────────────────────────────────────────────────
const toStr = v => (v == null ? null : String(v));
const toNum = v => { if (v == null) return null; const n = Number(v); return isNaN(n) ? null : n; };
const sheetKey = s => s ? `${s.melt}/${s.partNo}/${s.pack}/${s.sheet}` : null;
const emptyGrid = () => Array.from({ length: 8 }, () => null);
const bdrColor = v => {
    if (v == null) return C.inputBdr;
    const a = Math.abs(v);
    return a > 1.0 ? C.errBdr : a > 0.5 ? C.warnBdr : C.okBdr;
};
const fmtTime = d => d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtWait = minutes => {
    if (minutes == null) return '';
    if (minutes < 1) return '<1 мин';
    if (minutes < 60) return `${Math.round(minutes)} мин`;
    return `${Math.floor(minutes / 60)}ч ${Math.round(minutes % 60)}м`;
};

// ── Крупная ячейка ввода ────────────────────────────────────────────────
function HCell({ label, value, onChange, disabled }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{
                fontSize: 13, color: C.textDim, fontFamily: 'monospace',
                fontWeight: 600, letterSpacing: 1
            }}>
                {label}
            </span>
            <input
                type="number"
                step="0.1"
                disabled={disabled}
                value={value ?? ''}
                onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                style={{
                    width: 90, height: 50,
                    textAlign: 'center', fontFamily: 'monospace',
                    fontSize: 22, fontWeight: 700,
                    color: value != null ? C.text : C.textDim,
                    background: C.inputBg,
                    border: `3px solid ${bdrColor(value)}`,
                    borderRadius: 6, padding: '4px 6px', outline: 'none',
                    cursor: disabled ? 'not-allowed' : 'text',
                    opacity: disabled ? 0.6 : 1,
                    transition: 'border-color 0.2s',
                }}
            />
        </div>
    );
}

// ── Крупная сетка 8 точек ───────────────────────────────────────────────
function MeasGrid({ title, values, onChange, disabled }) {
    const c = (idx, name) => (
        <HCell key={name} label={name.toUpperCase()} value={values[idx]}
            onChange={v => onChange(idx, v)} disabled={disabled} />
    );
    // h1=0, h2=1, h3=2, h4=3, h5=4, h6=5, h7=6, h8=7
    return (
        <div style={{
            flex: 1, background: C.panel, border: `1px solid ${C.panelBd}`,
            borderRadius: 8, padding: '14px 18px 18px',
        }}>
            <div style={{
                textAlign: 'center', fontSize: 15, fontWeight: 700, color: C.textHdr,
                marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5
            }}>
                {title}
            </div>
            {/* Top row: h1 h2 h3 */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 80px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                <div />{c(0, 'h1')}{c(1, 'h2')}{c(2, 'h3')}<div />
            </div>
            {/* Middle row: h8 [void] h4 */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                {c(7, 'h8')}
                <div style={{
                    height: 50, border: `2px dashed ${C.inputBdr}`,
                    borderRadius: 6, opacity: 0.2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{ color: C.textDim, fontSize: 11, opacity: 0.5 }}>ЛИСТ</span>
                </div>
                {c(3, 'h4')}
            </div>
            {/* Bottom row: h7 h6 h5 */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 80px', gap: 8, alignItems: 'start' }}>
                <div />{c(6, 'h7')}{c(5, 'h6')}{c(4, 'h5')}<div />
            </div>
        </div>
    );
}

// ── Элемент очереди ─────────────────────────────────────────────────────
function QueueItem({ item, isCurrent, onClick, waitColor }) {
    return (
        <div
            onClick={onClick}
            style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '4px 8px',
                padding: '8px 12px',
                background: isCurrent ? '#1a2f4a' : 'transparent',
                border: `1px solid ${isCurrent ? C.accent : C.panelBd}`,
                borderLeft: `4px solid ${isCurrent ? C.accent : 'transparent'}`,
                borderRadius: 5,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontSize: 13,
            }}
        >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
                <span style={{ color: C.accent }}>#{item.id}</span>
                <span>{item.melt}/{item.sheet}</span>
            </div>
            <div style={{
                fontSize: 11, color: waitColor, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
            }}>
                ⏱ {fmtWait(item.waitingMinutes)}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, gridColumn: '1 / -1' }}>
                Пачка: {item.pack} · {item.alloyCodeText || '—'} · {item.thickness ? `${item.thickness}мм` : '—'}
            </div>
        </div>
    );
}

// ── Основной компонент ──────────────────────────────────────────────────
export default function MeasurementHMI() {
    // OPC UA — только для детекции новых листов
    const { values, connected } = useOpcUa([
        'X2_ZoneOccup', 'X2_Melt', 'X2_Slab', 'X2_PartNo', 'X2_Pack',
        'X2_Sheet', 'X2_SubSheet', 'X2_SheetInPack', 'X2_SheetsInPack',
        'X2_Thikness', 'X2_AlloyCodeText',
    ]);

    const [queue, setQueue] = useState([]);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [before, setBefore] = useState(emptyGrid());
    const [after, setAfter] = useState(emptyGrid());
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [lastCreatedKey, setLastCreatedKey] = useState(null);

    // ── Загрузка очереди ──────────────────────────────────────────────────
    const fetchQueue = useCallback(async () => {
        try {
            const res = await api.get('/measurement/queue');
            setQueue(res.data);
        } catch (err) {
            console.error('Ошибка загрузки очереди:', err);
        }
    }, []);

    useEffect(() => { fetchQueue(); }, [fetchQueue]);
    // Периодическое обновление очереди (каждые 5 сек)
    useEffect(() => {
        const id = setInterval(fetchQueue, 5000);
        return () => clearInterval(id);
    }, [fetchQueue]);

    // ── Автозагрузка первого листа из очереди ─────────────────────────────
    useEffect(() => {
        if (!currentRecord && queue.length > 0) {
            loadRecord(queue[0].id);
        }
    }, [queue, currentRecord]);

    // ── Загрузка записи по ID ─────────────────────────────────────────────
    const loadRecord = async (id) => {
        try {
            const res = await api.get(`/measurement/${id}`);
            const rec = res.data;
            setCurrentRecord(rec);

            if (rec.measuredAt) {
                // Уже измерен — загружаем данные
                const b = emptyGrid(), a = emptyGrid();
                for (let i = 1; i <= 8; i++) {
                    b[i - 1] = rec[`h${i}Before`] ?? null;
                    a[i - 1] = rec[`h${i}After`] ?? null;
                }
                setBefore(b); setAfter(a);
            } else {
                setBefore(emptyGrid());
                setAfter(emptyGrid());
            }
            setMessage(null);
        } catch (err) {
            setMessage({ type: 'error', text: 'Ошибка загрузки: ' + (err.response?.data?.message ?? err.message) });
        }
    };

    // ── Слежение за X2: создание записей в очереди ────────────────────────
    useEffect(() => {
        const occ = toNum(values['X2_ZoneOccup']?.value);
        if (occ === 1 || occ === true) {
            const sheet = {
                melt: toNum(values['X2_Melt']?.value),
                slab: toNum(values['X2_Slab']?.value),
                partNo: toNum(values['X2_PartNo']?.value),
                pack: toNum(values['X2_Pack']?.value),
                sheet: toNum(values['X2_Sheet']?.value),
                sheetInPack: toNum(values['X2_SheetInPack']?.value),
                sheetsInPack: toNum(values['X2_SheetsInPack']?.value),
                thickness: toNum(values['X2_Thikness']?.value),
                alloyCodeText: toStr(values['X2_AlloyCodeText']?.value),
            };
            const key = sheetKey(sheet);

            if (key && key !== lastCreatedKey) {
                setLastCreatedKey(key);
                // Создаём запись в БД (если ещё нет)
                api.post('/measurement', { ...sheet, enteredX2At: new Date().toISOString() })
                    .then(() => fetchQueue())
                    .catch(err => {
                        if (err.response?.status !== 409) // 409 = уже существует
                            console.error('Ошибка создания записи:', err);
                        else
                            fetchQueue(); // Обновляем очередь даже если дубликат
                    });
            }
        } else {
            // Лист уехал — сбрасываем ключ, чтобы следующий лист создал новую запись
            setLastCreatedKey(null);
        }
    }, [values, lastCreatedKey, fetchQueue]);

    // ── Сохранение замеров ────────────────────────────────────────────────
    const handleSave = async () => {
        if (!currentRecord?.id) return;
        setSaving(true);
        try {
            const payload = {};
            for (let i = 1; i <= 8; i++) {
                payload[`h${i}Before`] = before[i - 1];
                payload[`h${i}After`] = after[i - 1];
            }
            payload.measuredBy = localStorage.getItem('username') || 'operator';
            payload.measuredAt = new Date().toISOString();

            await api.put(`/measurement/${currentRecord.id}`, payload);
            setMessage({ type: 'success', text: '✓ Измерения сохранены! Переход к следующему листу...' });

            // Обновляем очередь
            await fetchQueue();

            // Через 1.5 сек — переход к следующему листу
            setTimeout(() => {
                setCurrentRecord(null); // Сброс — useEffect подхватит следующий из очереди
                setMessage(null);
            }, 1500);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message ?? 'Ошибка сохранения' });
        } finally {
            setSaving(false);
        }
    };

    // ── Проверки ──────────────────────────────────────────────────────────
    const allFilled = before.every(v => v != null) && after.every(v => v != null);
    const alreadyMeasured = currentRecord?.measuredAt != null;
    const s = currentRecord;
    const pendingCount = queue.length;

    return (
        <div style={{
            minHeight: '100vh', background: C.bg,
            fontFamily: "'Roboto Mono', 'Courier New', monospace", color: C.text,
            display: 'flex', flexDirection: 'column',
        }}>

            {/* ── ШАПКА ──────────────────────────────────────────────────────── */}
            <div style={{
                background: C.header, borderBottom: `2px solid ${C.accent}`,
                display: 'flex', alignItems: 'stretch', minHeight: 60,
            }}>
                {/* OPC UA статус */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
                    borderRight: `1px solid #1e3a5f`,
                }}>
                    <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: connected ? C.green : C.red,
                        boxShadow: connected ? `0 0 8px ${C.green}` : 'none',
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textHdr, letterSpacing: 1 }}>
                        ПЛК
                    </span>
                </div>

                {/* Параметры текущего листа */}
                <div style={{
                    background: '#1565c0', display: 'flex', alignItems: 'center',
                    padding: '0 14px', borderRight: `1px solid #1e3a5f`,
                }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
                        ТЕКУЩИЙ ЛИСТ
                    </span>
                </div>

                {s ? (
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                        {[
                            { label: 'Плавка', value: s.melt },
                            { label: 'Слиб', value: s.slab },
                            { label: 'Партия', value: s.partNo },
                            { label: 'Пачка', value: s.pack },
                            { label: 'Лист', value: s.sheet, accent: true },
                            { label: 'Марка', value: s.alloyCodeText, wide: true },
                            { label: 'Толщ.', value: s.thickness },
                        ].map(p => (
                            <div key={p.label} style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                padding: '4px 14px', borderRight: `1px solid #1e3a5f`,
                                minWidth: p.wide ? 100 : 65,
                            }}>
                                <span style={{ fontSize: 9, color: '#90caf9', whiteSpace: 'nowrap' }}>{p.label}</span>
                                <span style={{
                                    fontSize: 16, fontWeight: 700, fontFamily: 'monospace',
                                    color: p.accent ? C.accent : C.text,
                                }}>
                                    {p.value ?? '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', flex: 1 }}>
                        <span style={{ color: C.textDim, fontSize: 14 }}>
                            {pendingCount > 0
                                ? 'Загрузка листа из очереди...'
                                : connected ? 'Очередь пуста. Ожидание листа на X2...' : '⚠ OPC UA не подключён'}
                        </span>
                    </div>
                )}

                {/* Счётчик очереди */}
                <div style={{
                    display: 'flex', alignItems: 'center', padding: '0 20px',
                    background: pendingCount > 0 ? '#e65100' : '#1b5e20',
                    borderLeft: `1px solid ${pendingCount > 0 ? C.yellow : '#2e7d32'}`,
                    gap: 8,
                }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{pendingCount}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 11, color: '#fff', fontWeight: 700, lineHeight: 1.1 }}>
                            В ОЧЕРЕДИ
                        </span>
                        <span style={{ fontSize: 10, color: '#ffffffaa' }}>
                            {pendingCount === 0 ? 'всё измерено' : 'ожидает'}
                        </span>
                    </div>
                </div>

                {/* Статус "Измерено" */}
                {alreadyMeasured && (
                    <div style={{
                        display: 'flex', alignItems: 'center', padding: '0 16px',
                        background: '#1b5e20', borderLeft: `1px solid #2e7d32`,
                    }}>
                        <span style={{ fontSize: 12, color: '#a5d6a7', fontWeight: 700 }}>✓ ИЗМЕРЕНО</span>
                    </div>
                )}
            </div>

            {/* ── Сообщение ──────────────────────────────────────────────────── */}
            {message && (
                <div style={{
                    padding: '8px 16px',
                    background: message.type === 'success' ? '#1b5e20' : message.type === 'error' ? '#b71c1c' : '#0d47a1',
                    borderBottom: `1px solid ${C.inputBdr}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span style={{ fontSize: 13 }}>{message.text}</span>
                    <button onClick={() => setMessage(null)}
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
            )}

            {/* ── ТЕЛО: Сетки + Очередь ─────────────────────────────────────── */}
            <div style={{ display: 'flex', flex: 1, padding: 12, gap: 12 }}>

                {/* Левая часть: сетки измерений */}
                {s ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                            <MeasGrid title="До кантовки" values={before}
                                onChange={(idx, v) => setBefore(p => { const n = [...p]; n[idx] = v; return n; })}
                                disabled={saving || alreadyMeasured} />
                            <MeasGrid title="После кантовки" values={after}
                                onChange={(idx, v) => setAfter(p => { const n = [...p]; n[idx] = v; return n; })}
                                disabled={saving || alreadyMeasured} />
                        </div>

                        {/* Кнопка сохранения */}
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            {!alreadyMeasured ? (
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !allFilled}
                                    style={{
                                        minWidth: 360, padding: '14px 32px', fontSize: 18, fontWeight: 700,
                                        fontFamily: 'inherit', letterSpacing: 1.5, textTransform: 'uppercase',
                                        background: (saving || !allFilled) ? C.btnDis : C.btnBg,
                                        color: '#fff', border: 'none', borderRadius: 6,
                                        cursor: (saving || !allFilled) ? 'not-allowed' : 'pointer',
                                        boxShadow: allFilled && !saving ? `0 0 20px ${C.accent}44` : 'none',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {saving ? '⏳ Сохранение...' : allFilled() ? '💾 Сохранить замеры' : `⚠ Заполните все 16 точек (${before.filter(v => v != null).length + after.filter(v => v != null).length}/16)`}
                                </button>
                            ) : (
                                <div style={{
                                    display: 'inline-block', padding: '10px 24px', background: '#1b5e20',
                                    borderRadius: 6, color: '#a5d6a7', fontSize: 15, fontWeight: 700,
                                }}>
                                    ✓ Замеры сохранены — {new Date(s.measuredAt).toLocaleString('ru-RU')}
                                    {s.measuredBy ? ` (${s.measuredBy})` : ''}
                                </div>
                            )}
                        </div>

                        {/* Мета-инфо */}
                        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', fontSize: 11, color: C.textDim }}>
                            <span>ID: {s.id}</span>
                            <span>Создана: {s.createdAt ? new Date(s.createdAt).toLocaleString('ru-RU') : '—'}</span>
                            <span>Вход X2: {s.enteredX2At ? new Date(s.enteredX2At).toLocaleString('ru-RU') : '—'}</span>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: C.textDim, fontSize: 18,
                    }}>
                        {pendingCount > 0 ? 'Загрузка...' : 'Нет листов для измерения'}
                    </div>
                )}

                {/* Правая панель: Очередь */}
                <div style={{
                    width: 320, flexShrink: 0,
                    background: C.panel, border: `1px solid ${C.panelBd}`,
                    borderRadius: 8, padding: 12,
                    display: 'flex', flexDirection: 'column',
                }}>
                    <div style={{
                        fontSize: 13, fontWeight: 700, color: C.accent,
                        letterSpacing: 1, marginBottom: 10,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <span>📋 ОЧЕРЕДЬ ({pendingCount})</span>
                        <button onClick={fetchQueue} style={{
                            background: 'transparent', border: `1px solid ${C.panelBd}`,
                            color: C.textDim, borderRadius: 3, padding: '2px 8px',
                            cursor: 'pointer', fontSize: 11,
                        }}>
                            ↻
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {queue.length === 0 ? (
                            <div style={{
                                padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12,
                            }}>
                                Очередь пуста.<br />
                                Листы появятся здесь,<br />
                                когда приедут на X2.
                            </div>
                        ) : (
                            queue.map((item, idx) => {
                                const isCurrent = currentRecord?.id === item.id;
                                const waitColor = item.waitingMinutes > 10 ? C.red
                                    : item.waitingMinutes > 5 ? C.yellow : C.green;
                                return (
                                    <QueueItem
                                        key={item.id}
                                        item={item}
                                        isCurrent={isCurrent}
                                        onClick={() => !isCurrent && loadRecord(item.id)}
                                        waitColor={waitColor}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}