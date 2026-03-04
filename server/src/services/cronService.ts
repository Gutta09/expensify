import cron from 'node-cron';
import { User, Transaction } from '../models';
import { MLService } from './mlService';
import { PowerBIService } from './powerbiService';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export const initCronJobs = (): void => {
  // ─── Daily: Retrain ML models per user (2 AM) ─────────────
  cron.schedule('0 2 * * *', async () => {
    logger.info('Cron: Starting daily ML model retraining');
    try {
      const users = await User.find({ isActive: true }).select('_id');
      for (const user of users) {
        const txCount = await Transaction.countDocuments({ userId: user._id });
        if (txCount >= 30) {
          // Minimum data threshold
          try {
            await MLService.retrain(user._id.toString());
            logger.info(`ML retrained for user ${user._id}`);
          } catch (err) {
            logger.warn(`ML retraining failed for user ${user._id}:`, err);
          }
        }
      }
    } catch (error) {
      logger.error('Cron: ML retraining job failed:', error);
    }
  });

  // ─── Daily: Generate forecasts (3 AM) ──────────────────────
  cron.schedule('0 3 * * *', async () => {
    logger.info('Cron: Starting daily forecast generation');
    try {
      const users = await User.find({ isActive: true }).select('_id');
      for (const user of users) {
        const txCount = await Transaction.countDocuments({ userId: user._id });
        if (txCount >= 30) {
          try {
            await MLService.generateForecast(user._id.toString(), 30);
            logger.info(`Forecast generated for user ${user._id}`);
          } catch (err) {
            logger.warn(`Forecast generation failed for user ${user._id}:`, err);
          }
        }
      }
    } catch (error) {
      logger.error('Cron: Forecast generation job failed:', error);
    }
  });

  // ─── Every 6 hours: Push data to Power BI ──────────────────
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Cron: Pushing data to Power BI');
    try {
      await PowerBIService.pushTransactionData();
      await PowerBIService.refreshDataset();
      logger.info('Cron: Power BI data push complete');
    } catch (error) {
      logger.error('Cron: Power BI push failed:', error);
    }
  });

  // ─── Weekly: Update user ML profiles (Sunday 4 AM) ─────────
  cron.schedule('0 4 * * 0', async () => {
    logger.info('Cron: Updating user ML profiles');
    try {
      const users = await User.find({ isActive: true });
      for (const user of users) {
        const stats = await Transaction.aggregate([
          { $match: { userId: user._id } },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              total: { $sum: '$amount' },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 5 },
        ]);

        const totalCount = await Transaction.countDocuments({ userId: user._id });

        user.mlProfile.dataPointCount = totalCount;
        user.mlProfile.topCategories = stats.map((s) => s._id);
        user.mlProfile.lastTrained = new Date();
        await user.save();
      }
      logger.info('Cron: User ML profiles updated');
    } catch (error) {
      logger.error('Cron: ML profile update failed:', error);
    }
  });

  logger.info('All cron jobs scheduled');
};
