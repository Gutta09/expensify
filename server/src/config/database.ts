import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/expenseiq';

  try {
    const conn = await mongoose.connect(mongoURI, {
      // MongoDB time-series optimization
      autoIndex: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Optionally create time-series collection for transactions
    const db = conn.connection.db;
    if (db) {
      const collections = await db.listCollections({ name: 'transactions' }).toArray();
      if (collections.length === 0) {
        try {
          await db.createCollection('transactions', {
            timeseries: {
              timeField: 'date',
              metaField: 'userId',
              granularity: 'hours',
            },
          });
          logger.info('Created time-series collection: transactions');
        } catch (tsErr: any) {
          // Collection may have been auto-created by mongoose; that's fine
          if (tsErr.code !== 48) throw tsErr;
          logger.info('Transactions collection already exists, skipping time-series creation');
        }
      } else {
        logger.info('Transactions collection already exists');
      }
    }

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};
