import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const C = {
  bg: '#0d1117', panel: '#161b22', panelBd: '#30363d',
  text: '#e6edf3', dim: '#7d8590', accent: '#58a6ff',
  green: '#3fb950', red: '#f85149', yellow: '#d29922',
  inputBg: '#21262d',
};

const actionLabels = {
  create: '📦 Создание', add_sheet: '➕ Лист добавлен',
  remove_sheet: '❌ Лист удалён', edit_measurement: '✏ Замеры изменены',
  finish: '🔥 Отправлена в печь',
};
const actionColors = {
  create: C.accent, add_sheet: C.green,
  remove_sheet: C.red, edit_measurement: C.yellow,
  finish: '#fb923c',
};

export default function CassetteHistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSession, setSelectedSession] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const pageSize = 25;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/cassettenew/history', { params: { page, pageSize } });
      setSessions(res.data.sessions);
      setTotalCount(res.data.totalCount);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

const openAudit = async (session) => {
  setSelectedSession(session);
  setAuditLoading(true);
  try {
    // Используем готовый business_key из ответа API ("8888/20260608-0629")
    const bk = session.business_key;
    const res = await api.get(`/cassettenew/${encodeURIComponent(bk)}/audit`);
    setAuditLog(res.data);
  } catch (err) {
    console.error('Ошибка загрузки аудита:', err);
    setAuditLog([]);
  } finally {
    setAuditLoading(false);
  }
};

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Roboto Mono', monospace", padding: 16 }}>
      <h1 style={{ fontSize: 20, color: C.accent, marginBottom: 16 }}>📋 История кассет</h1>

      <div style={{ background: C.panel, border: `1px solid ${C.panelBd}`, borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.panelBd}` }}>
              {['Кассета', 'Печь', 'Загружена', 'Загрузил', 'Выгружена', 'Выгрузил', 'Листов', 'Авто', ''].map(h => (
                <th key={h} style={{ padding: '6px 8px', color: C.dim, textAlign: 'left', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: C.dim }}>Загрузка...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: C.dim }}>Нет завершённых кассет</td></tr>
            ) : sessions.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${C.panelBd}22` }}>
               <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: C.accent, fontWeight: 700 }} >
  №{s.business_key ? s.business_key.split('/')[0] : '—'}
</td >
                <td style={{ padding: '5px 8px' }}>Печь {s.furnace_number}</td>
                <td style={{ padding: '5px 8px', color: C.dim }}>{new Date(s.loaded_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ padding: '5px 8px', color: C.dim, fontSize: 11 }}>{s.loaded_by}</td>
                <td style={{ padding: '5px 8px', color: C.green }}>{new Date(s.unloaded_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ padding: '5px 8px', color: C.dim, fontSize: 11 }}>{s.unloaded_by}</td>
                <td style={{ padding: '5px 8px', fontWeight: 700 }}>{s.sheet_count}</td>
                <td style={{ padding: '5px 8px' }}>
                  {s.completed_by_plc && <span style={{ color: C.green, fontSize: 11 }}>✓ PLC</span>}
                </td>
                <td style={{ padding: '5px 8px' }}>
                  <button onClick={() => openAudit(s)}
                    style={{ background: 'transparent', color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>
                    Журнал
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
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.panelBd}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>←</button>
          <span style={{ padding: '4px 10px', color: C.dim, fontSize: 13 }}>{page} / {totalPages} ({totalCount})</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.panelBd}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>→</button>
        </div>
      )}

      {/* ── МОДАЛКА: Аудит-лог кассеты ── */}
      {selectedSession && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelectedSession(null)}>
          <div style={{ background: C.panel, border: `2px solid ${C.accent}`, borderRadius: 8, padding: 24, minWidth: 600, maxWidth: 800, maxHeight: '80vh', color: C.text, display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: C.accent }} >
  📜 Журнал кассеты №{selectedSession.business_key ? selectedSession.business_key.split('/')[0] : '—'} (Печь {selectedSession.furnace_number})
</h2>
              <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {auditLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: C.dim }}>Загрузка журнала...</div>
              ) : auditLog.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: C.dim }}>Журнал пуст</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {auditLog.map((log, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '140px 160px 1fr auto',
                      gap: 8, padding: '6px 8px', fontSize: 12,
                      background: i % 2 ? 'transparent' : '#ffffff06', borderRadius: 3,
                      borderLeft: `3px solid ${actionColors[log.action] || C.dim}`,
                    }}>
                      <span style={{ color: C.dim, fontFamily: 'monospace' }}>
                        {new Date(log.performed_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span style={{ color: actionColors[log.action] || C.text, fontWeight: 700 }}>
                        {actionLabels[log.action] || log.action}
                      </span>
                      <span style={{ color: C.text }}>
                        {log.mat_id && <span style={{ fontFamily: 'monospace', color: C.accent }}>{log.matId || log.mat_id}</span>}
                        {log.details?.reason && <span style={{ color: C.yellow }}> — {log.details.reason}</span>}
                        {log.details?.sheetCount && <span> ({log.details.sheetCount} л.)</span>}
                        {log.details?.furnace && <span> → Печь {log.details.furnace}</span>}
                      </span>
                      <span style={{ color: C.dim, fontSize: 11 }}>{log.performed_by}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}