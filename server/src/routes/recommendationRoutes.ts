import { Router, Request, Response, NextFunction } from 'express';
import { Recommendation } from '../models';
import { authenticate } from '../middleware/auth';
import { OpenAIService } from '../services/openaiService';
import { Transaction } from '../models';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

/**
 * GET /api/recommendations
 * Get personalized AI-generated recommendations
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status = 'active', type } = req.query;
    const query: any = { userId: req.userId };
    if (status) query.status = status;
    if (type) query.type = type;

    const recommendations = await Recommendation.find(query)
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ recommendations });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/recommendations/generate
 * Generate fresh AI recommendations based on current spending patterns
 */
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Gather user's spending data for AI analysis
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [categorySpending, recurringExpenses, recentAnomalies, monthlyTrend] = await Promise.all([
      // Category breakdown
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            type: 'expense',
            date: { $gte: threeMonthsAgo },
          },
        },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            avg: { $avg: '$amount' },
          },
        },
        { $sort: { total: -1 } },
      ]),
      // Recurring expenses
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            type: 'expense',
            isRecurring: true,
          },
        },
        {
          $group: {
            _id: '$merchant',
            totalSpent: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      // Recent anomalies
      Transaction.find({
        userId: req.userId,
        isAnomaly: true,
        date: { $gte: threeMonthsAgo },
      }).limit(10),
      // Monthly spending trend
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            type: 'expense',
            date: { $gte: threeMonthsAgo },
          },
        },
        {
          $group: {
            _id: { month: { $month: '$date' }, year: { $year: '$date' } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    // Use OpenAI to generate intelligent recommendations
    const aiRecommendations = await OpenAIService.generateRecommendations({
      categorySpending,
      recurringExpenses,
      recentAnomalies: recentAnomalies.map((a) => ({
        merchant: a.merchant,
        amount: a.amount,
        category: a.category,
        anomalyReason: a.anomalyReason,
      })),
      monthlyTrend,
      userPreferences: req.user!.preferences,
    });

    // Save recommendations to DB
    const savedRecommendations = await Promise.all(
      aiRecommendations.map((rec: any) =>
        new Recommendation({
          userId: req.userId,
          ...rec,
          basedOn: {
            dataRange: { start: threeMonthsAgo, end: new Date() },
            transactionCount: categorySpending.reduce((s: number, c: any) => s + c.count, 0),
            patterns: rec.patterns || [],
          },
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        }).save()
      )
    );

    res.status(201).json({ recommendations: savedRecommendations });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/recommendations/:id/feedback
 * Provide feedback on a recommendation (helps improve future suggestions)
 */
router.put('/:id/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { helpful, comment, status } = req.body;

    const recommendation = await Recommendation.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      {
        feedback: { helpful, comment, ratedAt: new Date() },
        ...(status && { status }),
      },
      { new: true }
    );

    if (!recommendation) {
      res.status(404).json({ error: 'Recommendation not found' });
      return;
    }

    res.json({ recommendation });
  } catch (error) {
    next(error);
  }
});

export default router;
