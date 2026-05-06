// src/hooks/useOpcUa.js
import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

const HUB_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace('/api', '/hubs/opc')
  : 'http://localhost:5000/hubs/opc';

// Синглтон соединения — одно на всё приложение
let _connection = null;
let _connecting = false;
const _subscribers = new Set();

function getConnection() {
  if (!_connection) {
    _connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => localStorage.getItem('token') || '',
      })
      .withAutomaticReconnect([1000, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Все подписчики получают обновления
    _connection.on('TagUpdate', ({ alias, value }) => {
      _subscribers.forEach(fn => fn(alias, value));
    });
  }
  return _connection;
}

async function ensureConnected() {
  const conn = getConnection();
  if (conn.state === signalR.HubConnectionState.Connected) return conn;
  if (_connecting) return conn;

  _connecting = true;
  try {
    await conn.start();
    console.log('[OPC UA] SignalR connected');
  } catch (e) {
    console.error('[OPC UA] Connection failed', e);
  } finally {
    _connecting = false;
  }
  return conn;
}

// ---------------------------------------------------------------------------
// Основной хук
// ---------------------------------------------------------------------------
export function useOpcUa(aliases = []) {
  // values: { f1_occup: { value, timestamp, isGood }, ... }
  const [values,    setValues]    = useState({});
  const [connected, setConnected] = useState(false);
  const [snapshot,  setSnapshot]  = useState(false);

  const aliasSet = useRef(new Set(aliases));

  useEffect(() => {
    aliasSet.current = new Set(aliases);
  }, [aliases.join(',')]); // eslint-disable-line

  useEffect(() => {
    let mounted = true;
    const conn = getConnection();

    // Snapshot — все текущие значения при подключении
    conn.on('Snapshot', (all) => {
      if (!mounted) return;
      const filtered = {};
      for (const [alias, val] of Object.entries(all)) {
        if (aliasSet.current.size === 0 || aliasSet.current.has(alias))
          filtered[alias] = val;
      }
      setValues(filtered);
      setSnapshot(true);
    });

    // Подписчик на отдельные обновления
    const handler = (alias, val) => {
      if (!mounted) return;
      if (aliasSet.current.size > 0 && !aliasSet.current.has(alias)) return;
      setValues(prev => ({ ...prev, [alias]: val }));
    };
    _subscribers.add(handler);

    // Состояние соединения
    const onReconnected = () => mounted && setConnected(true);
    const onReconnecting = () => mounted && setConnected(false);
    const onClose = () => mounted && setConnected(false);

    conn.onreconnected(onReconnected);
    conn.onreconnecting(onReconnecting);
    conn.onclose(onClose);

    ensureConnected().then(async (c) => {
      if (!mounted) return;
      setConnected(c.state === signalR.HubConnectionState.Connected);
      // Подписываемся только на нужные теги
      if (aliases.length > 0) {
        try { await c.invoke('Subscribe', aliases); }
        catch (e) { console.warn('[OPC UA] Subscribe failed', e); }
      }
    });

    return () => {
      mounted = false;
      _subscribers.delete(handler);
      conn.off('Snapshot');
      // Отписываемся от тегов при размонтировании
      if (aliases.length > 0 && conn.state === signalR.HubConnectionState.Connected) {
        conn.invoke('Unsubscribe', aliases).catch(() => {});
      }
    };
  }, []); // eslint-disable-line

  // Функция записи
  const write = useCallback(async (alias, value) => {
    const conn = getConnection();
    if (conn.state !== signalR.HubConnectionState.Connected) {
      console.warn('[OPC UA] Write failed: not connected');
      return false;
    }
    try {
      return await conn.invoke('Write', alias, value);
    } catch (e) {
      console.error('[OPC UA] Write error', e);
      return false;
    }
  }, []);

  return { values, connected, snapshot, write };
}

// ---------------------------------------------------------------------------
// Упрощённый хук — только одно значение
// ---------------------------------------------------------------------------
export function useOpcTag(alias) {
  const { values, connected, write } = useOpcUa([alias]);
  return {
    value:     values[alias]?.value ?? null,
    timestamp: values[alias]?.timestamp,
    isGood:    values[alias]?.isGood ?? false,
    connected,
    write: (val) => write(alias, val),
  };
}