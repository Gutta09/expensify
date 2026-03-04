import { Router, Request, Response, NextFunction } from 'express';
import { Transaction, Alert, UserRole } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

/**
 * GET /api/analytics/trends
 * Spending trends over time (monthly, weekly)
 */
router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { granularity = 'monthly', months = 12 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - Number(months));

    const dateFormat = granularity === 'weekly'
      ? { $isoWeek: '$date' }
      : { $month: '$date' };
    const yearFormat = { $year: '$date' };

    const trends = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          type: 'expense',
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            period: dateFormat,
            year: yearFormat,
            category: '$category',
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.period': 1 } },
    ]);

    // Also get overall monthly totals
    const monthlyTotals = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          type: 'expense',
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { month: { $month: '$date' }, year: { $year: '$date' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({ trends, monthlyTotals });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/categories
 * Category-wise spending breakdown
 */
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    const match: any = {
      userId: new mongoose.Types.ObjectId(req.userId),
      type: 'expense',
    };
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate as string);
      if (endDate) match.date.$lte = new Date(endDate as string);
    }

    const categories = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 },
          avgTransaction: { $avg: '$amount' },
          maxTransaction: { $max: '$amount' },
          minTransaction: { $min: '$amount' },
        },
      },
      { $sort: { totalSpent: -1 } },
    ]);

    // Calculate percentages
    const totalSpend = categories.reduce((sum, cat) => sum + cat.totalSpent, 0);
    const enrichedCategories = categories.map((cat) => ({
      ...cat,
      category: cat._id,
      percentOfTotal: totalSpend > 0 ? ((cat.totalSpent / totalSpend) * 100).toFixed(1) : 0,
    }));

    res.json({ categories: enrichedCategories, totalSpend });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/anomalies
 * List detected anomalies with context
 */
router.get('/anomalies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const anomalies = await Transaction.find({
      userId: req.userId,
      isAnomaly: true,
    })
      .sort({ date: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Transaction.countDocuments({
      userId: req.userId,
      isAnomaly: true,
    });

    // Get related alerts
    const alerts = await Alert.find({
      userId: req.userId,
      type: 'anomaly',
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({
      anomalies,
      alerts,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/recurring
 * Detect and list recurring transactions
 */
router.get('/recurring', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recurring = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          type: 'expense',
        },
      },
      {
        $group: {
          _id: { merchant: '$merchant', category: '$category' },
          count: { $sum: 1 },
          totalSpent: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          dates: { $push: '$date' },
          amounts: { $push: '$amount' },
        },
      },
      { $match: { count: { $gte: 3 } } }, // At least 3 occurrences
      { $sort: { count: -1 } },
    ]);

    // Analyze frequency patterns
    const analyzed = recurring.map((r) => {
      const sortedDates = r.dates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
      const intervals: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        intervals.push(
          (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
        );
      }
      const avgInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;

      let frequency = 'irregular';
      if (avgInterval >= 25 && avgInterval <= 35) frequency = 'monthly';
      else if (avgInterval >= 6 && avgInterval <= 8) frequency = 'weekly';
      else if (avgInterval >= 13 && avgInterval <= 16) frequency = 'biweekly';
      else if (avgInterval >= 85 && avgInterval <= 95) frequency = 'quarterly';

      return {
        merchant: r._id.merchant,
        category: r._id.category,
        occurrences: r.count,
        totalSpent: r.totalSpent,
        avgAmount: Math.round(r.avgAmount * 100) / 100,
        frequency,
        avgIntervalDays: Math.round(avgInterval),
        annualEstimate: frequency === 'monthly' ? r.avgAmount * 12 :
          frequency === 'weekly' ? r.avgAmount * 52 :
            frequency === 'biweekly' ? r.avgAmount * 26 : r.totalSpent,
      };
    });

    res.json({ recurring: analyzed });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/spending-velocity
 * Real-time spending velocity (rate of spend) analysis
 */
router.get('/spending-velocity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentPeriod, previousPeriod] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            type: 'expense',
            date: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            avgDaily: { $avg: '$amount' },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            type: 'expense',
            date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const current = currentPeriod[0] || { total: 0, count: 0 };
    const previous = previousPeriod[0] || { total: 0, count: 0 };

    const velocityChange = previous.total > 0
      ? ((current.total - previous.total) / previous.total * 100).toFixed(1)
      : 0;

    res.json({
      currentPeriod: {
        totalSpend: current.total,
        transactionCount: current.count,
        dailyAverage: current.total / 30,
      },
      previousPeriod: {
        totalSpend: previous.total,
        transactionCount: previous.count,
        dailyAverage: previous.total / 30,
      },
      velocityChangePercent: Number(velocityChange),
      trend: Number(velocityChange) > 10 ? 'increasing' :
        Number(velocityChange) < -10 ? 'decreasing' : 'stable',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/aggregate
 * Platform-wide analytics (Admin/Analyst only)
 */
router.get(
  '/aggregate',
  authorize(UserRole.ADMIN, UserRole.ANALYST),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [totalTransactions, categoryBreakdown, monthlyVolume] = await Promise.all([
        Transaction.countDocuments(),
        Transaction.aggregate([
          { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $limit: 10 },
        ]),
        Transaction.aggregate([
          {
            $group: {
              _id: { month: { $month: '$date' }, year: { $year: '$date' } },
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 },
        ]),
      ]);

      res.json({ totalTransactions, categoryBreakdown, monthlyVolume });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
