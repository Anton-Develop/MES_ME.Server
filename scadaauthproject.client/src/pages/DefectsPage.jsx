import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const C = {
  bg: '#0d1117', panel: '#161b22', panelBd: '#30363d',
  text: '#e6edf3', dim: '#7d8590', accent: '#58a6ff',
  green: '#3fb950', red: '#f85149', yellow: '#d29922',
  inputBg: '#21262d', btnBg: '#1565c0',
};

const severityLabel = { 1: 'Низкая', 2: 'Средняя', 3: 'Высокая' };
const severityColor = { 1: C.yellow, 2: '#fb923c', 3: C.red };
const statusLabel = { open: 'Открыт', resolved: 'Возвращён', scrapped: 'Утилизирован' };
const statusColor = { open: C.red, resolved: C.green, scrapped: C.dim };

export default function DefectsPage() {
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedDefect, setSelectedDefect] = useState(null);

  // Модальное окно обработки
  const [resolveModal, setResolveModal] = useState(null);

  const pageSize = 30;

  const fetchDefects = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await api.get('/defects', { params });
      setDefects(res.data.defects);
      setTotalCount(res.data.totalCount);
    } catch (err) {
      console.error('Ошибка загрузки браков:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchDefects(); }, [fetchDefects]);

  // Обработка брака (возврат / утилизация)
  const handleResolve = async (action) => {
    if (!resolveModal) return;
    try {
      await api.post(`/defects/${resolveModal.id}/resolve`, {
        action,
        notes: resolveModal.notes || '',
      });
      setResolveModal(null);
      fetchDefects();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка обработки');
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Roboto Mono', monospace", padding: 16 }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, color: C.red, margin: 0 }}>🚨 ИЗОЛЯТОР — Бракованные листы</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.dim }}>Статус:</span>
          {['open', 'resolved', 'scrapped', 'all'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              style={{
                background: statusFilter === s ? C.accent : 'transparent',
                color: statusFilter === s ? '#000' : C.dim,
                border: `1px solid ${statusFilter === s ? C.accent : C.panelBd}`,
                borderRadius: 3, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              }}>
              {s === 'all' ? 'Все' : statusLabel[s] || s}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      <div style={{ background: C.panel, border: `1px solid ${C.panelBd}`, borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.panelBd}` }}>
              {['Дата', 'Плавка', 'Партия', 'Пачка', 'Лист', 'Марка', 'Тип дефекта', 'Зона', 'Оператор', 'Статус', ''].map(h => (
                <th key={h} style={{ padding: '6px 8px', color: C.dim, textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 30, textAlign: 'center', color: C.dim }}>Загрузка...</td></tr>
            ) : defects.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 30, textAlign: 'center', color: C.dim }}>Нет записей</td></tr>
            ) : defects.map(d => (
              <tr key={d.id}
                onClick={() => setSelectedDefect(d)}
                style={{ borderBottom: `1px solid ${C.panelBd}22`, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1a2f4a'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '5px 8px', color: C.dim, whiteSpace: 'nowrap' }}>
                  {new Date(d.detectedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{d.sheet?.meltNumber}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{d.sheet?.batchNumber}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{d.sheet?.packNumber}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{d.sheet?.sheetNumber}</td>
                <td style={{ padding: '5px 8px', color: C.yellow }}>{d.sheet?.steelGrade}</td>
                <td style={{ padding: '5px 8px' }}>
                  <span style={{ color: severityColor[d.severity] || C.dim }}>
                    {d.defectType?.name || d.defectCode || '—'}
                  </span>
                </td>
                <td style={{ padding: '5px 8px', color: C.dim }}>{d.detectedAtZone || '—'}</td>
                <td style={{ padding: '5px 8px', color: C.dim, fontSize: 11 }}>{d.detectedBy}</td>
                <td style={{ padding: '5px 8px' }}>
                  <span style={{
                    background: (statusColor[d.status] || C.dim) + '22',
                    color: statusColor[d.status] || C.dim,
                    border: `1px solid ${statusColor[d.status] || C.dim}`,
                    borderRadius: 3, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                  }}>
                    {statusLabel[d.status] || d.status}
                  </span>
                </td>
                <td style={{ padding: '5px 8px' }}>
                  {d.status === 'open' && (
                    <button
                      onClick={e => { e.stopPropagation(); setResolveModal({ id: d.id, matId: d.matId, notes: '' }); }}
                      style={{
                        background: C.btnBg, color: '#fff', border: 'none',
                        borderRadius: 3, padding: '3px 8px', cursor: 'pointer', fontSize: 11,
                      }}>
                      Обработать
                    </button>
                  )}
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

      {/* ── МОДАЛКА: Детали дефекта ── */}
      {selectedDefect && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelectedDefect(null)}>
          <div style={{ background: C.panel, border: `2px solid ${C.red}`, borderRadius: 8, padding: 24, minWidth: 500, maxWidth: 650, color: C.text }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: C.red }}>🚨 Детали брака #{selectedDefect.id}</h2>
              <button onClick={() => setSelectedDefect(null)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 12px', fontSize: 13, fontFamily: 'monospace' }}>
              <span style={{ color: C.dim }}>MatId:</span><span style={{ color: C.accent }}>{selectedDefect.matId}</span>
              <span style={{ color: C.dim }}>Плавка/Лист:</span><span>{selectedDefect.sheet?.meltNumber}/{selectedDefect.sheet?.sheetNumber}</span>
              <span style={{ color: C.dim }}>Марка:</span><span style={{ color: C.yellow }}>{selectedDefect.sheet?.steelGrade}</span>
              <span style={{ color: C.dim }}>Тип дефекта:</span><span style={{ color: severityColor[selectedDefect.severity] }}>{selectedDefect.defectType?.name || selectedDefect.defectCode}</span>
              <span style={{ color: C.dim }}>Описание:</span><span>{selectedDefect.defectDescription || '—'}</span>
              <span style={{ color: C.dim }}>Зона:</span><span>{selectedDefect.detectedAtZone}</span>
              <span style={{ color: C.dim }}>Обнаружил:</span><span>{selectedDefect.detectedBy}</span>
              <span style={{ color: C.dim }}>Дата:</span><span>{new Date(selectedDefect.detectedAt).toLocaleString('ru-RU')}</span>
              <span style={{ color: C.dim }}>Статус:</span>
              <span style={{ color: statusColor[selectedDefect.status] }}>{statusLabel[selectedDefect.status]}</span>
              {selectedDefect.resolvedAt && <>
                <span style={{ color: C.dim }}>Обработал:</span><span>{selectedDefect.resolvedBy}</span>
                <span style={{ color: C.dim }}>Дата решения:</span><span>{new Date(selectedDefect.resolvedAt).toLocaleString('ru-RU')}</span>
                <span style={{ color: C.dim }}>Примечание:</span><span>{selectedDefect.resolutionNotes || '—'}</span>
              </>}
            </div>
          </div>
        </div>
      )}

      {/* ── МОДАЛКА: Обработка брака ── */}
      {resolveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setResolveModal(null)}>
          <div style={{ background: C.panel, border: `2px solid ${C.accent}`, borderRadius: 8, padding: 24, minWidth: 450, color: C.text }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, color: C.accent }}>⚙ Обработка брака — {resolveModal.matId}</h2>
            <label style={{ display: 'block', fontSize: 12, color: C.dim, marginBottom: 4 }}>Примечание:</label>
            <textarea value={resolveModal.notes} onChange={e => setResolveModal(prev => ({ ...prev, notes: e.target.value }))}
              rows={3} placeholder="Причина решения..."
              style={{ width: '100%', background: C.inputBg, color: C.text, border: `1px solid ${C.panelBd}`, borderRadius: 4, padding: 8, fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setResolveModal(null)}
                style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.panelBd}`, borderRadius: 4, padding: '8px 14px', cursor: 'pointer' }}>Отмена</button>
              <button onClick={() => handleResolve('scrap')}
                style={{ background: '#b71c1c', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>🗑 Утилизировать</button>
              <button onClick={() => handleResolve('rework')}
                style={{ background: C.green, color: '#000', border: 'none', borderRadius: 4, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>♻ Вернуть в работу</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}