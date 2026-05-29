// src/hooks/useOpcUa.js
import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

const HUB_URL = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace('/api', '/hubs/opc')
    : 'http://localhost:5000/hubs/opc';

// Синглтон соединения
let _connection = null;
let _connectionPromise = null; // ← Фикс race condition
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

        // Глобальный диспетчер тегов
        _connection.on('TagUpdate', ({ alias, value }) => {
            _subscribers.forEach(fn => fn(alias, value));
        });
    }
    return _connection;
}

// Фикс: Promise-based ensureConnected — все ждут ОДНО подключение
async function ensureConnected() {
    const conn = getConnection();
    if (conn.state === signalR.HubConnectionState.Connected) return conn;
    
    // Если уже идёт подключение — ждём тот же Promise
    if (_connectionPromise) return _connectionPromise;

    _connectionPromise = (async () => {
        try {
            await conn.start();
            console.log('[OPC UA] SignalR connected');
            return conn;
        } catch (e) {
            console.error('[OPC UA] Connection failed:', e);
            throw e;
        } finally {
            _connectionPromise = null;
        }
    })();

    return _connectionPromise;
}

export function useOpcUa(aliases = []) {
    const [values, setValues] = useState({});
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false); // ← Новое состояние
    const [error, setError] = useState(null);              // ← Новое состояние
    const [snapshot, setSnapshot] = useState(false);

    const aliasSet = useRef(new Set(aliases));

    useEffect(() => {
        aliasSet.current = new Set(aliases);
    }, [aliases.join(',')]); // eslint-disable-line

    useEffect(() => {
        let mounted = true;
        const conn = getConnection();

        // ✅ ИМЕНОВАННАЯ функция для Snapshot — чтобы корректно отписаться
        const snapshotHandler = (all) => {
            if (!mounted) return;
            const filtered = {};
            for (const [alias, val] of Object.entries(all)) {
                if (aliasSet.current.size === 0 || aliasSet.current.has(alias))
                    filtered[alias] = val;
            }
            setValues(filtered);
            setSnapshot(true);
        };
        conn.on('Snapshot', snapshotHandler);

        const handler = (alias, val) => {
            if (!mounted) return;
            if (aliasSet.current.size > 0 && !aliasSet.current.has(alias)) return;
            setValues(prev => ({ ...prev, [alias]: val }));
        };
        _subscribers.add(handler);

        // Состояние соединения
        const onReconnected = () => mounted && (setConnected(true), setConnecting(false), setError(null));
        const onReconnecting = () => mounted && (setConnected(false), setConnecting(true));
        const onClose = (err) => mounted && (setConnected(false), setConnecting(false), setError(err?.message || 'Соединение закрыто'));

        conn.onreconnected(onReconnected);
        conn.onreconnecting(onReconnecting);
        conn.onclose(onClose);

        // Подключаемся
        setConnecting(true);
        setError(null);

        ensureConnected()
            .then(async (c) => {
                if (!mounted) return;
                setConnected(c.state === signalR.HubConnectionState.Connected);
                setConnecting(false);
                
                if (aliases.length > 0) {
                    try { await c.invoke('Subscribe', aliases); } 
                    catch (e) { console.warn('[OPC UA] Subscribe failed', e); }
                }
                try { await c.invoke('GetSnapshot'); } 
                catch (e) { console.warn('[OPC UA] GetSnapshot failed', e); }
            })
            .catch((e) => {
                if (!mounted) return;
                setConnected(false);
                setConnecting(false);
                setError(e?.message || 'Ошибка подключения к OPC UA серверу');
            });

        return () => {
            mounted = false;
            _subscribers.delete(handler);
            // ✅ Корректная отписка — только наш handler
            conn.off('Snapshot', snapshotHandler);
            conn.off('reconnected', onReconnected);
            conn.off('reconnecting', onReconnecting);
            conn.off('close', onClose);
            
            if (aliases.length > 0 && conn.state === signalR.HubConnectionState.Connected) {
                conn.invoke('Unsubscribe', aliases).catch(() => { });
            }
        };
    }, []); // eslint-disable-line

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

    return { values, connected, connecting, error, snapshot, write };
}

export function useOpcTag(alias) {
    const { values, connected, connecting, error, write } = useOpcUa([alias]);
    return {
        value: values[alias]?.value ?? null,
        timestamp: values[alias]?.timestamp,
        isGood: values[alias]?.isGood ?? false,
        connected,
        connecting,
        error,
        write: (val) => write(alias, val),
    };
}