// src/api/quenchingApi.js
import api from '../api';

export const quenchingApi = {
  /**
   * Получить все сессии закалки для конкретного листа
   */
  getSessionsBySheet: (sheet) => api.get(`/quenching/by-sheet/${sheet}`),

  /**
   * Получить сессию по бизнес-ключу (например, "44|0|102247|412|3|0")
   */
  getSessionByKey: (key) => api.get(`/quenching/${encodeURIComponent(key)}`),
};