import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import app from './app';
import { connectDB } from './config/database';
import { createServer } from 'http';
import { initializeSocket } from './config/socket';
import { initCronJobs } from './services/cronService';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('MongoDB connected successfully');

    // Create HTTP server and attach Socket.IO
    const httpServer = createServer(app);
    initializeSocket(httpServer);
    logger.info('WebSocket server initialized');

    // Initialize scheduled jobs (ML model retraining, data sync)
    initCronJobs();
    logger.info('Cron jobs initialized');

    httpServer.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
