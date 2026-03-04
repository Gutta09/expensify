import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

let io: Server;

export const initializeSocket = (httpServer: HttpServer): void => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authenticate socket connections with JWT
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      (socket as any).userId = (decoded as any).userId;
      (socket as any).role = (decoded as any).role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.info(`Socket connected: user ${userId}`);

    // Join user-specific room for targeted notifications
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user ${userId}`);
    });
  });
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

// Emit events to specific users
export const emitToUser = (userId: string, event: string, data: any): void => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Event types for the application
export const SocketEvents = {
  NEW_TRANSACTION: 'transaction:new',
  ANOMALY_DETECTED: 'anomaly:detected',
  BUDGET_ALERT: 'budget:alert',
  FORECAST_UPDATED: 'forecast:updated',
  RECOMMENDATION: 'recommendation:new',
  PLAID_SYNC: 'plaid:sync_complete',
} as const;
