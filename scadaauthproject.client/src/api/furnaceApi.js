// src/api/furnaceApi.js
import api from '../api';

export const furnaceApi = {
  // Зоны
  getZoneHistory: ({ from, to, zone, sheet, limit = 500 }) =>
    api.get('/furnace/zones/history', {
      params: { from, to, zone: zone || undefined, sheet: sheet || undefined, limit }
    }),

  getZoneTrack: (sheet, { melt, partNo, pack } = {}) =>
    api.get(`/furnace/zones/track/${sheet}`, { params: { melt, partNo, pack } }),

  // Температуры
  getTemperatures: ({ from, to, intervalMin = 5 }) =>
    api.get('/furnace/temperatures', { params: { from, to, intervalMin } }),

  // Сессии
  getSessions: ({ from, to, slab, melt, alloyCode, page = 1, pageSize = 20 }) =>
    api.get('/furnace/sessions', {
      params: { from: from || undefined, to: to || undefined, slab: slab || undefined,
                melt: melt || undefined, alloyCode: alloyCode || undefined, page, pageSize }
    }),

  getSessionsBySheet: (sheet) =>
    api.get(`/furnace/sessions/sheet/${sheet}`),

  getSessionByKey: (key) =>
    api.get(`/furnace/sessions/key/${encodeURIComponent(key)}`),

  // Отчёты
  getReportByKey: (key) =>
    api.get(`/furnace/report/key/${encodeURIComponent(key)}`),

  getReportBySheet: (sheet, { melt, partNo, pack, reheatNum = 0 } = {}) =>
    api.get(`/furnace/report/sheet/${sheet}`, { params: { melt, partNo, pack, reheatNum } }),
};