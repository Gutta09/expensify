import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppSelector, useAppDispatch } from '../store/store';
import { addRealtimeTransaction } from '../store/slices/transactionSlice';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('transaction:created', (data) => {
      dispatch(addRealtimeTransaction(data.transaction));
    });

    socket.on('anomaly:detected', (data) => {
      // Could integrate with a toast notification system
      console.log('[Socket] Anomaly detected:', data);
    });

    socket.on('budget:warning', (data) => {
      console.log('[Socket] Budget warning:', data);
    });

    socket.on('budget:exceeded', (data) => {
      console.log('[Socket] Budget exceeded:', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, dispatch]);

  return socketRef.current;
}
