import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const C = {
  bg: '#0d1117', panel: '#161b22', panelBd: '#30363d',
  text: '#e6edf3', dim: '#7d8590', accent: '#58a6ff',
  green: '#3fb950', red: '#f85149', yellow: '#d29922',
  inputBg: '#21262d', orange: '#fb923c',
};

const inputStyle = {
  background: C.inputBg, border: `1px solid ${C.panelBd}`, borderRadius: 4,
  color: C.text, padding: '6px 10px', fontSize: 13, fontFamily: "'Roboto Mono', monospace",
  outline: 'none', width: '100%',
};

const btnPrimary = {
  background: C.accent, color: '#fff', border: 'none', borderRadius: 4,
  padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};

const btnDanger = {
  background: 'transparent', color: C.red, border: `1px solid ${C.red}`,
  borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 11,
};

const btnSecondary = {
  background: 'transparent', color: C.dim, border: `1px solid ${C.panelBd}`,
  borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
};

export default function CassetteEditPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  // Модалка редактирования сессии
  const [editSession, setEditSession] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSheets, setEditSheets] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Модалка поиска листов
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    matId: '', melt: '', batch: '', pack: '', sheet: '',
  });

  // Модалка подтверждения удаления
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState('');

  const totalPages = Math.ceil(totalCount / pageSize);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/cassettenew/completed', { params: { page, pageSize } });
      setSessions(res.data.sessions);
      setTotalCount(res.data.totalCount);
    } catch (err) {
      console.error('Ошибка загрузки:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ─── Открыть редактирование ───
  const openEdit = async (session) => {
    setEditSession(session);
    setEditLoading(true);
    try {
      const res = await api.get(`/cassettenew/completed/${session.id}/details`);
      const s = res.data.session;
      setEditForm({
        furnaceNumber: s.furnace_number,
        loadedAt: s.loaded_at ? toLocalInput(s.loaded_at) : '',
        loadedBy: s.loaded_by || '',
        unloadedAt: s.unloaded_at ? toLocalInput(s.unloaded_at) : '',
        unloadedBy: s.unloaded_by || '',
        status: s.status || '',
        completedByPlc: s.completed_by_plc || false,
        notes: s.notes || '',
        slotNumber: s.slot_number || 1,
        totalTimeMin: s.total_time_min || '',
        maxTemp: s.max_temp || '',
        reason: '',
      });
      setEditSheets(res.data.sheets || []);
    } catch (err) {
      console.error('Ошибка загрузки деталей:', err);
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Сохранить изменения сессии ───
  const saveSession = async () => {
    setSaving(true);
    try {
      await api.put(`/cassettenew/completed/${editSession.id}`, {
        furnaceNumber: editForm.furnaceNumber,
        loadedAt: editForm.loadedAt ? new Date(editForm.loadedAt).toISOString() : null,
        loadedBy: editForm.loadedBy || null,
        unloadedAt: editForm.unloadedAt ? new Date(editForm.unloadedAt).toISOString() : null,
        unloadedBy: editForm.unloadedBy || null,
        status: editForm.status,
        completedByPlc: editForm.completedByPlc,
        notes: editForm.notes || null,
        slotNumber: editForm.slotNumber,
        totalTimeMin: editForm.totalTimeMin || null,
        maxTemp: editForm.maxTemp || null,
        reason: editForm.reason || 'Редактирование',
      });
      alert('✅ Сессия обновлена');
      setEditSession(null);
      fetchSessions();
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // ─── Поиск листов ───
  const doSearch = async () => {
    setSearchLoading(true);
    try {
      const params = {};
      if (searchFilters.matId) params.matId = searchFilters.matId;
      if (searchFilters.melt) params.melt = searchFilters.melt;
      if (searchFilters.batch) params.batch = searchFilters.batch;
      if (searchFilters.pack) params.pack = searchFilters.pack;
      if (searchFilters.sheet) params.sheet = searchFilters.sheet;
      const res = await api.get('/cassettenew/search-sheets', { params });
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  // ─── Добавить лист ───
  const addSheet = async (matId) => {
    try {
      await api.post(`/cassettenew/completed/${editSession.id}/add-sheet`, { matId });
      alert('✅ Лист добавлен');
      setSearchOpen(false);
      // Перезагружаем детали
      openEdit(editSession);
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.message || err.message));
    }
  };

  // ─── Удалить лист ───
  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await api.delete(
        `/cassettenew/completed/${editSession.id}/remove-sheet/${encodeURIComponent(removeTarget.matId)}/${removeTarget.reheatNum}`,
        { data: { reason: removeReason || 'Удаление при редактировании' } }
      );
      alert('✅ Лист удалён');
      setRemoveTarget(null);
      setRemoveReason('');
      openEdit(editSession);
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.message || err.message));
    }
  };

  // ─── Утилиты ───
  function toLocalInput(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Roboto Mono', monospace", padding: 16 }}>
      <h1 style={{ fontSize: 20, color: C.orange, marginBottom: 16 }}>🔧 Редактирование завершённых кассет</h1>

      {/* ─── Таблица ─── */}
      <div style={{ background: C.panel, border: `1px solid ${C.panelBd}`, borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.panelBd}` }}>
              {['Кассета', 'Печь', 'Слот', 'Загружена', 'Выгружена', 'Время (мин)', 'T°max', 'Листов', 'PLC', 'Статус', ''].map(h => (
                <th key={h} style={{ padding: '6px 8px', color: C.dim, textAlign: 'left', fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 30, textAlign: 'center', color: C.dim }}>Загрузка...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 30, textAlign: 'center', color: C.dim }}>Нет завершённых кассет</td></tr>
            ) : sessions.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${C.panelBd}22` }}>
                <td style={{ padding: '5px 8px', color: C.accent, fontWeight: 700 }}>№{s.cassette_number}</td>
                <td style={{ padding: '5px 8px' }}>Печь {s.furnace_number}</td>
                <td style={{ padding: '5px 8px', color: C.dim }}>{s.slot_number}</td>
                <td style={{ padding: '5px 8px', color: C.dim, fontSize: 11 }}>{fmtDate(s.loaded_at)}</td>
                <td style={{ padding: '5px 8px', color: C.green, fontSize: 11 }}>{fmtDate(s.unloaded_at)}</td>
                <td style={{ padding: '5px 8px' }}>{s.total_time_min ?? '—'}</td>
                <td style={{ padding: '5px 8px' }}>{s.max_temp ?? '—'}</td>
                <td style={{ padding: '5px 8px', fontWeight: 700 }}>{s.sheet_count}</td>
                <td style={{ padding: '5px 8px' }}>{s.completed_by_plc && <span style={{ color: C.green }}>✓</span>}</td>
                <td style={{ padding: '5px 8px', fontSize: 11, color: C.dim }}>{s.status}</td>
                <td style={{ padding: '5px 8px' }}>
                  <button onClick={() => openEdit(s)} style={{ ...btnPrimary, fontSize: 11, padding: '3px 10px' }}>
                    ✏ Редакт.
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSecondary}>←</button>
          <span style={{ padding: '4px 10px', color: C.dim, fontSize: 13 }}>{page} / {totalPages} ({totalCount})</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSecondary}>→</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* МОДАЛКА: Редактирование сессии */}
      {/* ═══════════════════════════════════════════════════ */}
      {editSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditSession(null)}>
          <div style={{ background: C.panel, border: `2px solid ${C.orange}`, borderRadius: 8, padding: 24, width: 900, maxWidth: '95vw', maxHeight: '90vh', color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>

            {/* Заголовок */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: C.orange }}>
                🔧 Кассета №{editSession.cassette_number} — Печь {editSession.furnace_number}
              </h2>
              <button onClick={() => setEditSession(null)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {editLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.dim }}>Загрузка...</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* ─── Поля сессии ─── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Печь №" type="number" value={editForm.furnaceNumber}
                    onChange={v => setEditForm(f => ({ ...f, furnaceNumber: +v }))} min={1} max={4} />
                  <Field label="Слот" type="number" value={editForm.slotNumber}
                    onChange={v => setEditForm(f => ({ ...f, slotNumber: +v }))} min={1} />
                  <Field label="Статус" value={editForm.status}
                    onChange={v => setEditForm(f => ({ ...f, status: v }))} />
                  <Field label="Загружена" type="datetime-local" value={editForm.loadedAt}
                    onChange={v => setEditForm(f => ({ ...f, loadedAt: v }))} />
                  <Field label="Загрузил" value={editForm.loadedBy}
                    onChange={v => setEditForm(f => ({ ...f, loadedBy: v }))} />
                  <Field label="Выгружена" type="datetime-local" value={editForm.unloadedAt}
                    onChange={v => setEditForm(f => ({ ...f, unloadedAt: v }))} />
                  <Field label="Выгрузил" value={editForm.unloadedBy}
                    onChange={v => setEditForm(f => ({ ...f, unloadedBy: v }))} />
                  <Field label="Время (мин)" type="number" value={editForm.totalTimeMin}
                    onChange={v => setEditForm(f => ({ ...f, totalTimeMin: v ? +v : '' }))} />
                  <Field label="T° max" type="number" value={editForm.maxTemp}
                    onChange={v => setEditForm(f => ({ ...f, maxTemp: v ? +v : '' }))} step="0.1" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.dim, marginBottom: 3, display: 'block' }}>Примечания</label>
                    <textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 12, color: C.dim, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={editForm.completedByPlc || false}
                        onChange={e => setEditForm(f => ({ ...f, completedByPlc: e.target.checked }))} />
                      Завершена PLC
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: C.yellow, marginBottom: 3, display: 'block' }}>Причина редактирования</label>
                  <input value={editForm.reason || ''} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                    style={inputStyle} placeholder="Укажите причину..." />
                </div>

                {/* Кнопка сохранить */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveSession} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Сохранение...' : '💾 Сохранить сессию'}
                  </button>
                </div>

                {/* ─── Листы в кассете ─── */}
                <div style={{ borderTop: `1px solid ${C.panelBd}`, paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14, color: C.accent }}>📄 Листы в кассете ({editSheets.length})</h3>
                    <button onClick={() => setSearchOpen(true)} style={{ ...btnPrimary, background: C.green }}>
                      ➕ Добавить лист
                    </button>
                  </div>

                  {editSheets.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: C.dim, fontSize: 12 }}>Нет листов</div>
                  ) : (
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.panelBd}` }}>
                            {['#', 'MatId', 'Плавка', 'Партия', 'Пачка', 'Лист', 'Марка', 'Размер', 'Нагрев', 'Статус', ''].map(h => (
                              <th key={h} style={{ padding: '4px 6px', color: C.dim, textAlign: 'left', fontSize: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {editSheets.map((cs, i) => (
                            <tr key={cs.id} style={{ borderBottom: `1px solid ${C.panelBd}11` }}>
                              <td style={{ padding: '4px 6px', color: C.dim }}>{i + 1}</td>
                              <td style={{ padding: '4px 6px', color: C.accent, fontWeight: 600 }}>{cs.matId}</td>
                              <td style={{ padding: '4px 6px' }}>{cs.sheet?.meltNumber}</td>
                              <td style={{ padding: '4px 6px' }}>{cs.sheet?.batchNumber}</td>
                              <td style={{ padding: '4px 6px' }}>{cs.sheet?.packNumber}</td>
                              <td style={{ padding: '4px 6px' }}>{cs.sheet?.sheetNumber}</td>
                              <td style={{ padding: '4px 6px' }}>{cs.sheet?.steelGrade}</td>
                              <td style={{ padding: '4px 6px', fontSize: 10 }}>{cs.sheet?.sheetDimensions}</td>
                              <td style={{ padding: '4px 6px', color: C.yellow }}>{cs.reheatNum}</td>
                              <td style={{ padding: '4px 6px', fontSize: 10, color: C.dim }}>{cs.sheet?.status}</td>
                              <td style={{ padding: '4px 6px' }}>
                                <button onClick={() => setRemoveTarget({ matId: cs.matId, reheatNum: cs.reheatNum })}
                                  style={btnDanger}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* МОДАЛКА: Поиск и добавление листа */}
      {/* ═══════════════════════════════════════════════════ */}
      {searchOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSearchOpen(false)}>
          <div style={{ background: C.panel, border: `2px solid ${C.green}`, borderRadius: 8, padding: 24, width: 850, maxWidth: '95vw', maxHeight: '85vh', color: C.text, display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: C.green }}>🔍 Поиск листа для добавления</h3>
              <button onClick={() => setSearchOpen(false)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            {/* Фильтры */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: C.dim }}>MatId</label>
                <input value={searchFilters.matId} onChange={e => setSearchFilters(f => ({ ...f, matId: e.target.value }))}
                  style={inputStyle} placeholder="MatId" onKeyDown={e => e.key === 'Enter' && doSearch()} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: C.dim }}>Плавка</label>
                <input value={searchFilters.melt} onChange={e => setSearchFilters(f => ({ ...f, melt: e.target.value }))}
                  style={inputStyle} placeholder="Плавка" onKeyDown={e => e.key === 'Enter' && doSearch()} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: C.dim }}>Партия</label>
                <input value={searchFilters.batch} onChange={e => setSearchFilters(f => ({ ...f, batch: e.target.value }))}
                  style={inputStyle} placeholder="Партия" onKeyDown={e => e.key === 'Enter' && doSearch()} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: C.dim }}>Пачка</label>
                <input value={searchFilters.pack} onChange={e => setSearchFilters(f => ({ ...f, pack: e.target.value }))}
                  style={inputStyle} placeholder="Пачка" onKeyDown={e => e.key === 'Enter' && doSearch()} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: C.dim }}>№ Листа</label>
                <input value={searchFilters.sheet} onChange={e => setSearchFilters(f => ({ ...f, sheet: e.target.value }))}
                  style={inputStyle} placeholder="Лист" onKeyDown={e => e.key === 'Enter' && doSearch()} />
              </div>
            </div>

            <button onClick={doSearch} disabled={searchLoading} style={{ ...btnPrimary, background: C.green, marginBottom: 12, alignSelf: 'flex-start' }}>
              {searchLoading ? 'Поиск...' : '🔎 Найти'}
            </button>

            {/* Результаты */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 350 }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: C.dim, fontSize: 12 }}>
                  {searchLoading ? 'Поиск...' : 'Введите критерии и нажмите «Найти»'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.panelBd}` }}>
                      {['MatId', 'Плавка', 'Партия', 'Пачка', 'Лист', 'Марка', 'Размер', 'Статус', ''].map(h => (
                        <th key={h} style={{ padding: '4px 6px', color: C.dim, textAlign: 'left', fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map(s => (
                      <tr key={s.matId} style={{ borderBottom: `1px solid ${C.panelBd}11` }}>
                        <td style={{ padding: '4px 6px', color: C.accent, fontWeight: 600 }}>{s.matId}</td>
                        <td style={{ padding: '4px 6px' }}>{s.meltNumber}</td>
                        <td style={{ padding: '4px 6px' }}>{s.batchNumber}</td>
                        <td style={{ padding: '4px 6px' }}>{s.packNumber}</td>
                        <td style={{ padding: '4px 6px' }}>{s.sheetNumber}</td>
                        <td style={{ padding: '4px 6px' }}>{s.steelGrade}</td>
                        <td style={{ padding: '4px 6px', fontSize: 10 }}>{s.sheetDimensions}</td>
                        <td style={{ padding: '4px 6px', fontSize: 10, color: C.dim }}>{s.status}</td>
                        <td style={{ padding: '4px 6px' }}>
                          <button onClick={() => addSheet(s.matId)}
                            style={{ ...btnPrimary, background: C.green, fontSize: 10, padding: '2px 8px' }}>
                            + Добавить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* МОДАЛКА: Подтверждение удаления листа */}
      {/* ═══════════════════════════════════════════════════ */}
      {removeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setRemoveTarget(null)}>
          <div style={{ background: C.panel, border: `2px solid ${C.red}`, borderRadius: 8, padding: 24, width: 420, color: C.text }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, color: C.red }}>⚠️ Удалить лист?</h3>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Лист <strong style={{ color: C.accent }}>{removeTarget.matId}</strong> (нагрев №{removeTarget.reheatNum}) будет удалён из кассеты.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.dim, marginBottom: 4, display: 'block' }}>Причина удаления</label>
              <input value={removeReason} onChange={e => setRemoveReason(e.target.value)}
                style={inputStyle} placeholder="Причина..." />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRemoveTarget(null)} style={btnSecondary}>Отмена</button>
              <button onClick={confirmRemove} style={{ ...btnDanger, padding: '6px 16px', fontSize: 12 }}>
                🗑 Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Вспомогательный компонент поля ───
function Field({ label, type = 'text', value, onChange, ...rest }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: C.dim, marginBottom: 3, display: 'block' }}>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
        {...rest}
      />
    </div>
  );
}