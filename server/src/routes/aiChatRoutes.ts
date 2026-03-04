import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { OpenAIService } from '../services/openaiService';
import { Transaction } from '../models';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

/**
 * POST /api/ai-chat
 * AI Financial Coach — conversational interface powered by GPT-4
 * Answers user questions about their spending data
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Gather user's financial context for the AI
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [recentTransactions, categoryBreakdown, monthlyTotal, anomalyCount] = await Promise.all([
      Transaction.find({
        userId: req.userId,
        date: { $gte: thirtyDaysAgo },
      })
        .sort({ date: -1 })
        .limit(50)
        .select('date amount type category merchant'),

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
            _id: '$category',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),

      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            type: 'expense',
            date: { $gte: thirtyDaysAgo },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      Transaction.countDocuments({
        userId: req.userId,
        isAnomaly: true,
        date: { $gte: thirtyDaysAgo },
      }),
    ]);

    const financialContext = {
      totalSpendLast30Days: monthlyTotal[0]?.total || 0,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c._id,
        total: c.total,
        transactions: c.count,
      })),
      recentTransactions: recentTransactions.slice(0, 20).map((t) => ({
        date: t.date.toISOString().split('T')[0],
        amount: t.amount,
        type: t.type,
        category: t.category,
        merchant: t.merchant,
      })),
      anomalyCount,
      currency: req.user!.preferences.currency,
    };

    // Call OpenAI with user's context
    const aiResponse = await OpenAIService.chat(
      message,
      financialContext,
      conversationHistory
    );

    res.json({
      response: aiResponse.message,
      insights: aiResponse.insights,
      suggestedActions: aiResponse.suggestedActions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai-chat/analyze
 * Deep AI analysis of user's spending patterns
 */
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analysisType = 'comprehensive' } = req.body;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const spendingData = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          date: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            year: { $year: '$date' },
            category: '$category',
            type: '$type',
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avg: { $avg: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const analysis = await OpenAIService.deepAnalysis(spendingData, analysisType);

    res.json({
      analysis: analysis.summary,
      keyFindings: analysis.findings,
      recommendations: analysis.recommendations,
      riskAreas: analysis.risks,
      savingsOpportunities: analysis.savings,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
