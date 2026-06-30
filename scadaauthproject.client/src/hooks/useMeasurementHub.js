// src/hooks/useMeasurementHub.js
import { useEffect, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

const HUB_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace('/api', '/hubs/measurement')
  : 'http://localhost:5000/hubs/measurement';

let _connection = null;
let _connectionPromise = null;
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

    _connection.on('NewMeasurement', (data) => {
      _subscribers.forEach(fn => fn(data));
    });
  }
  return _connection;
}

async function ensureConnected() {
  const conn = getConnection();
  if (conn.state === signalR.HubConnectionState.Connected) return conn;
  if (_connectionPromise) return _connectionPromise;

  _connectionPromise = (async () => {
    try {
      await conn.start();
      console.log('[Measurement Hub] Connected');
      return conn;
    } catch (e) {
      console.error('[Measurement Hub] Connection failed:', e);
      throw e;
    } finally {
      _connectionPromise = null;
    }
  })();

  return _connectionPromise;
}

export function useMeasurementHub() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const conn = getConnection();

    const onReconnected = () => mounted && (setConnected(true), setConnecting(false), setError(null));
    const onReconnecting = () => mounted && (setConnected(false), setConnecting(true));
    const onClose = (err) => mounted && (setConnected(false), setConnecting(false), setError(err?.message || 'Соединение закрыто'));

    conn.onreconnected(onReconnected);
    conn.onreconnecting(onReconnecting);
    conn.onclose(onClose);

    setConnecting(true);
    setError(null);

    ensureConnected()
      .then((c) => {
        if (!mounted) return;
        setConnected(c.state === signalR.HubConnectionState.Connected);
        setConnecting(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setConnected(false);
        setConnecting(false);
        setError(e?.message || 'Ошибка подключения к Measurement Hub');
      });

    return () => {
      mounted = false;
      conn.off('reconnected', onReconnected);
      conn.off('reconnecting', onReconnecting);
      conn.off('close', onClose);
    };
  }, []);

  const subscribe = useCallback((callback) => {
    _subscribers.add(callback);
    return () => _subscribers.delete(callback);
  }, []);

  return { connected, connecting, error, subscribe };
}