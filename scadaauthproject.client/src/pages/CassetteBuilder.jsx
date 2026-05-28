import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const C = {
  bg: '#0d1117', panel: '#161b22', panelBd: '#30363d',
  text: '#e6edf3', dim: '#7d8590', accent: '#58a6ff',
  green: '#3fb950', red: '#f85149', yellow: '#d29922',
  inputBg: '#21262d', btnBg: '#1565c0', btnDis: '#37474f',
};

export default function CassetteBuilder() {
  const [cassetteNumber, setCassetteNumber] = useState('');
  const [businessKey, setBusinessKey] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [furnacesStatus, setFurnacesStatus] = useState([]);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheetId, setSelectedSheetId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [furnaceForFinish, setFurnaceForFinish] = useState(1);

  // Модальное окно подтверждения удаления/редактирования
  const [confirmModal, setConfirmModal] = useState(null);

  // Загрузка статуса печей
  const fetchFurnacesStatus = useCallback(async () => {
    try {
      const res = await api.get('/cassettenew/furnaces-status');
      setFurnacesStatus(res.data);
    } catch (err) {
      console.error('Ошибка загрузки статуса печей:', err);
    }
  }, []);

  useEffect(() => { fetchFurnacesStatus(); }, [fetchFurnacesStatus]);

  // Загрузка доступных листов (прошедших закалку)
  const fetchAvailableSheets = async () => {
    try {
      const res = await api.get('/measurement/latest?limit=100');
      // Фильтруем только измеренные и прошедшие закалку
      const measured = res.data.filter(s => s.measuredAt != null);
      setAvailableSheets(measured);
    } catch (err) {
      console.error('Ошибка загрузки листов:', err);
    }
  };

  // Загрузка листов кассеты
  const fetchCassetteSheets = async (key) => {
    try {
      const res = await api.get(`/cassettenew/${encodeURIComponent(key)}/sheets`);
      setSheets(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    }
  };

  // Создание кассеты
  const handleCreate = async () => {
    if (!cassetteNumber || parseInt(cassetteNumber) <= 0) {
      setMessage({ type: 'error', text: 'Введите корректный номер кассеты' });
      return;
    }

    // Проверяем локально, не в печи ли
    const inFurnace = furnacesStatus.find(
      f => f.cassette_id === cassetteNumber.toString()
    );
    if (inFurnace) {
      setMessage({
        type: 'error',
        text: `Кассета №${cassetteNumber} сейчас в печи №${inFurnace.furnace_number}!`
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/cassettenew/create', {
        cassetteNumber: parseInt(cassetteNumber)
      });
      setBusinessKey(res.data.businessKey);
      setSheets([]);
      setMessage({ type: 'success', text: res.data.message });
      fetchAvailableSheets();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Добавление листа
  const handleAddSheet = async () => {
    if (!selectedSheetId || !businessKey) return;
    setLoading(true);
    try {
      await api.post(`/cassettenew/${encodeURIComponent(businessKey)}/add-sheet`, {
        matId: selectedSheetId
      });
      await fetchCassetteSheets(businessKey);
      setSelectedSheetId(null);
      setMessage({ type: 'success', text: 'Лист добавлен в кассету' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Удаление листа (с подтверждением)
  const handleRemoveSheet = (matId) => {
    setConfirmModal({
      type: 'remove',
      matId,
      reason: '',
    });
  };

  const confirmRemove = async () => {
    if (!confirmModal || !businessKey) return;
    setLoading(true);
    try {
      await api.delete(
        `/cassettenew/${encodeURIComponent(businessKey)}/remove-sheet/${confirmModal.matId}`,
        { data: { reason: confirmModal.reason || 'Не указана' } }
      );
      await fetchCassetteSheets(businessKey);
      setConfirmModal(null);
      setMessage({ type: 'success', text: 'Лист удалён из кассеты' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Завершение кассеты
  const handleFinish = async () => {
    if (!businessKey || sheets.length === 0) return;
    if (!window.confirm(`Отправить ${sheets.length} листов в печь №${furnaceForFinish}?`)) return;

    setLoading(true);
    try {
      const res = await api.post(`/cassettenew/${encodeURIComponent(businessKey)}/finish`, {
        furnaceNumber: furnaceForFinish
      });
      setMessage({ type: 'success', text: res.data.message });
      setBusinessKey(null);
      setSheets([]);
      setCassetteNumber('');
      fetchFurnacesStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Кассеты в печах
  const cassettesInFurnaces = furnacesStatus.map(f => f.cassette_id);

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "'Roboto Mono', monospace", padding: 16,
    }}>
      <h1 style={{ fontSize: 20, color: C.accent, marginBottom: 16 }}>
        📦 Формирование кассеты для печи отпуска
      </h1>

      {/* Сообщение */}
      {message && (
        <div style={{
          padding: '8px 16px', marginBottom: 12, borderRadius: 4,
          background: message.type === 'success' ? '#1b5e20' : '#b71c1c',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {!businessKey ? (
        /* ── ЭКРАН СОЗДАНИЯ КАССЕТЫ ── */
        <div style={{
          background: C.panel, border: `1px solid ${C.panelBd}`,
          borderRadius: 8, padding: 24, maxWidth: 500,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            Новая кассета
          </div>

          <label style={{ display: 'block', fontSize: 13, color: C.dim, marginBottom: 5 }}>
            Номер кассеты:
          </label>
          <input
            type="number" min="1"
            value={cassetteNumber}
            onChange={e => setCassetteNumber(e.target.value)}
            placeholder="Например: 12"
            style={{
              width: '100%', padding: 10, fontSize: 18,
              background: C.inputBg, color: C.text,
              border: `1px solid ${C.panelBd}`, borderRadius: 4,
              marginBottom: 12, boxSizing: 'border-box',
            }}
          />

          {/* Предупреждение о занятых кассетах */}
          {cassettesInFurnaces.length > 0 && (
            <div style={{
              background: '#e6510022', border: `1px solid ${C.yellow}`,
              padding: 10, borderRadius: 4, marginBottom: 12, fontSize: 12,
            }}>
              ⚠ Сейчас в печах кассеты: <b>{cassettesInFurnaces.join(', ')}</b>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || !cassetteNumber}
            style={{
              width: '100%', padding: 12, fontSize: 16, fontWeight: 700,
              background: loading || !cassetteNumber ? C.btnDis : C.green,
              color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer',
            }}
          >
            {loading ? '⏳ Создание...' : '✅ Создать кассету'}
          </button>
        </div>
      ) : (
        /* ── ЭКРАН РАБОТЫ С КАССЕТОЙ ── */
        <div>
          {/* Шапка кассеты */}
          <div style={{
            background: C.panel, border: `1px solid ${C.accent}`,
            borderRadius: 6, padding: '12px 16px', marginBottom: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <span style={{ fontSize: 12, color: C.dim }}>КАССЕТА: </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{businessKey}</span>
              <span style={{ marginLeft: 16, fontSize: 14, color: C.dim }}>
                Листов: <b style={{ color: C.text }}>{sheets.length}</b>
              </span>
            </div>
            <button
              onClick={() => { setBusinessKey(null); setSheets([]); }}
              style={{
                background: 'transparent', color: C.dim,
                border: `1px solid ${C.panelBd}`, borderRadius: 4,
                padding: '6px 12px', cursor: 'pointer',
              }}
            >
              ✕ Закрыть
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {/* Левая часть: листы в кассете */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: C.accent,
                marginBottom: 8, letterSpacing: 1,
              }}>
                ЛИСТЫ В КАССЕТЕ ({sheets.length})
              </div>

              {sheets.length === 0 ? (
                <div style={{
                  padding: 30, textAlign: 'center', color: C.dim,
                  border: `1px dashed ${C.panelBd}`, borderRadius: 6,
                }}>
                  Кассета пуста. Добавьте листы справа →
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.panelBd}` }}>
                      {['№', 'Плавка', 'Партия', 'Пачка', 'Лист', 'Марка', 'Толщ.', 'Замеры', ''].map(h => (
                        <th key={h} style={{ padding: '4px 6px', color: C.dim, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map((cs, i) => (
                      <tr key={cs.id} style={{ borderBottom: `1px solid ${C.panelBd}22` }}>
                        <td style={{ padding: '4px 6px', color: C.dim }}>{i + 1}</td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{cs.sheet?.meltNumber}</td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{cs.sheet?.batchNumber}</td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{cs.sheet?.packNumber}</td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>
                          {cs.sheet?.sheetNumber}
                        </td>
                        <td style={{ padding: '4px 6px', color: C.yellow }}>{cs.sheet?.steelGrade}</td>
                        <td style={{ padding: '4px 6px' }}>{cs.sheet?.sheetDimensions}</td>
                        <td style={{ padding: '4px 6px' }}>
                          {cs.measurement ? (
                            <span style={{ color: C.green, fontSize: 11 }}>✓ {new Date(cs.measurement.measuredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                          ) : (
                            <span style={{ color: C.dim, fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <button
                            onClick={() => handleRemoveSheet(cs.matId)}
                            title="Удалить (только мастер)"
                            style={{
                              background: '#b71c1c33', color: C.red,
                              border: `1px solid ${C.red}`, borderRadius: 3,
                              padding: '2px 8px', cursor: 'pointer', fontSize: 11,
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Правая часть: добавление + завершение */}
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Добавление листа */}
              <div style={{
                background: C.panel, border: `1px solid ${C.panelBd}`,
                borderRadius: 6, padding: 12,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>
                  ➕ ДОБАВИТЬ ЛИСТ
                </div>
                <select
                  value={selectedSheetId || ''}
                  onChange={e => setSelectedSheetId(e.target.value)}
                  style={{
                    width: '100%', padding: 8, fontSize: 12,
                    background: C.inputBg, color: C.text,
                    border: `1px solid ${C.panelBd}`, borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <option value="">-- Выберите лист --</option>
                  {availableSheets
                    .filter(s => !sheets.some(cs => cs.matId === s.matId))
                    .map(s => (
                      <option key={s.matId || `${s.melt}-${s.sheet}`} value={s.matId}>
                        {s.melt}/{s.sheet} — {s.alloyCodeText || '?'} ({s.thickness}мм)
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleAddSheet}
                  disabled={!selectedSheetId || loading}
                  style={{
                    width: '100%', padding: 8, fontSize: 13, fontWeight: 700,
                    background: !selectedSheetId || loading ? C.btnDis : C.green,
                    color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  Добавить в кассету
                </button>
              </div>

              {/* Завершение */}
              <div style={{
                background: C.panel, border: `1px solid ${C.panelBd}`,
                borderRadius: 6, padding: 12, marginTop: 'auto',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                  🔥 ОТПРАВИТЬ В ПЕЧЬ
                </div>
                <label style={{ display: 'block', fontSize: 12, color: C.dim, marginBottom: 4 }}>
                  Номер печи:
                </label>
                <select
                  value={furnaceForFinish}
                  onChange={e => setFurnaceForFinish(parseInt(e.target.value))}
                  style={{
                    width: '100%', padding: 8, fontSize: 14,
                    background: C.inputBg, color: C.text,
                    border: `1px solid ${C.panelBd}`, borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>Печь №{n}</option>
                  ))}
                </select>
                <button
                  onClick={handleFinish}
                  disabled={sheets.length === 0 || loading}
                  style={{
                    width: '100%', padding: 12, fontSize: 15, fontWeight: 700,
                    background: sheets.length === 0 || loading ? C.btnDis : C.btnBg,
                    color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  {loading ? '⏳ Отправка...' : `✅ Закончить кассету (${sheets.length} л.)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── МОДАЛКА ПОДТВЕРЖДЕНИЯ ── */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setConfirmModal(null)}>
          <div
            style={{
              background: C.panel, border: `2px solid ${C.red}`,
              borderRadius: 8, padding: 24, minWidth: 400, color: C.text,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.red, marginBottom: 12 }}>
              ⚠ Подтвердите действие
            </div>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Удалить лист <b>{confirmModal.matId}</b> из кассеты?
            </p>
            <label style={{ display: 'block', fontSize: 12, color: C.dim, marginBottom: 4 }}>
              Причина (обязательно):
            </label>
            <textarea
              value={confirmModal.reason}
              onChange={e => setConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
              rows={2}
              style={{
                width: '100%', padding: 8, fontSize: 13,
                background: C.inputBg, color: C.text,
                border: `1px solid ${C.panelBd}`, borderRadius: 4,
                marginBottom: 12, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)}
                style={{
                  background: 'transparent', color: C.dim,
                  border: `1px solid ${C.panelBd}`, borderRadius: 4,
                  padding: '8px 16px', cursor: 'pointer',
                }}>
                Отмена
              </button>
              <button onClick={confirmRemove}
                disabled={!confirmModal.reason}
                style={{
                  background: C.red, color: '#fff',
                  border: 'none', borderRadius: 4,
                  padding: '8px 16px', cursor: 'pointer', fontWeight: 700,
                  opacity: !confirmModal.reason ? 0.5 : 1,
                }}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}