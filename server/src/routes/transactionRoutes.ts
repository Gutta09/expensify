import { Router, Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Transaction, Budget, TransactionType } from '../models';
import { authenticate } from '../middleware/auth';
import { createTransactionValidator, transactionQueryValidator, mongoIdValidator } from '../middleware/validators';
import { MLService } from '../services/mlService';
import { AnomalyService } from '../services/anomalyService';
import { BudgetTracker } from '../services/budgetTracker';
import { emitToUser, SocketEvents } from '../config/socket';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/transactions
 * List user's transactions with filtering, pagination, and search
 */
router.get('/', transactionQueryValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const {
      startDate,
      endDate,
      category,
      type,
      merchant,
      minAmount,
      maxAmount,
      isAnomaly,
      page = 1,
      limit = 25,
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    const query: any = { userId: req.userId };

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    if (category) query.category = category;
    if (type) query.type = type;
    if (merchant) query.merchant = { $regex: merchant, $options: 'i' };
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }
    if (isAnomaly === 'true') query.isAnomaly = true;

    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Transaction.countDocuments(query);

    // Aggregate summary for the filtered set
    const summary = await Transaction.aggregate([
      { $match: { ...query, userId: req.user!._id } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
    ]);

    res.json({
      transactions,
      summary,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/transactions
 * Add a new transaction with AI-powered processing:
 * - Auto-categorization via ML
 * - Anomaly detection
 * - Budget impact check
 * - Recurring pattern detection
 */
router.post('/', createTransactionValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const transactionData = {
      ...req.body,
      userId: req.userId,
      source: req.body.source || 'manual',
    };

    // ─── AI Processing Pipeline ──────────────────────────
    try {
      // 1. Smart categorization (if category not provided or is generic)
      if (!transactionData.category || transactionData.category === 'Miscellaneous') {
        const mlResult = await MLService.categorize({
          merchant: transactionData.merchant,
          amount: transactionData.amount,
          description: transactionData.description,
        });
        transactionData.suggestedCategory = mlResult.category;
        transactionData.categoryConfidence = mlResult.confidence;
        if (mlResult.confidence > 0.8) {
          transactionData.category = mlResult.category;
        }
      }

      // 2. Anomaly detection
      const anomalyResult = await AnomalyService.checkTransaction(
        req.userId!,
        transactionData
      );
      transactionData.anomalyScore = anomalyResult.score;
      transactionData.isAnomaly = anomalyResult.isAnomaly;
      transactionData.anomalyReason = anomalyResult.reason;

      // 3. Spending sentiment classification
      transactionData.sentiment = classifySpendingSentiment(
        transactionData.category,
        transactionData.amount
      );
    } catch (mlError) {
      logger.warn('AI processing failed, saving transaction without ML enrichment:', mlError);
    }

    // Save transaction
    const transaction = new Transaction(transactionData);
    await transaction.save();

    // ─── Post-Save Processing ────────────────────────────
    // 4. Update budget tracking
    if (transactionData.type === TransactionType.EXPENSE) {
      await BudgetTracker.updateSpend(req.userId!, transactionData.category, transactionData.amount);
    }

    // 5. Emit real-time notifications
    emitToUser(req.userId!, SocketEvents.NEW_TRANSACTION, {
      transaction,
      anomaly: transactionData.isAnomaly
        ? { score: transactionData.anomalyScore, reason: transactionData.anomalyReason }
        : null,
    });

    if (transactionData.isAnomaly) {
      emitToUser(req.userId!, SocketEvents.ANOMALY_DETECTED, {
        transactionId: transaction._id,
        score: transactionData.anomalyScore,
        reason: transactionData.anomalyReason,
      });
    }

    logger.info(`Transaction created: ${transaction._id} for user ${req.userId}`);

    res.status(201).json({
      transaction,
      aiInsights: {
        suggestedCategory: transactionData.suggestedCategory,
        categoryConfidence: transactionData.categoryConfidence,
        anomalyScore: transactionData.anomalyScore,
        isAnomaly: transactionData.isAnomaly,
        anomalyReason: transactionData.anomalyReason,
        sentiment: transactionData.sentiment,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/transactions/:id
 */
router.get('/:id', mongoIdValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.json({ transaction });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/transactions/:id
 * Update transaction — re-runs ML if category is corrected (feedback loop)
 */
router.put('/:id', mongoIdValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const oldCategory = transaction.category;
    const oldAmount = transaction.amount;

    // Apply updates
    Object.assign(transaction, req.body);
    await transaction.save();

    // If category was corrected, feed back to ML model
    if (req.body.category && req.body.category !== oldCategory) {
      try {
        await MLService.submitFeedback({
          merchant: transaction.merchant,
          oldCategory,
          correctCategory: req.body.category,
          userId: req.userId!,
        });
      } catch {
        logger.warn('ML feedback submission failed');
      }
    }

    // Update budget if amount or category changed
    if (transaction.type === TransactionType.EXPENSE) {
      if (req.body.amount !== undefined || req.body.category !== undefined) {
        await BudgetTracker.adjustSpend(
          req.userId!,
          oldCategory,
          oldAmount,
          transaction.category,
          transaction.amount
        );
      }
    }

    res.json({ transaction });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/transactions/:id
 */
router.delete('/:id', mongoIdValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Reverse budget impact
    if (transaction.type === TransactionType.EXPENSE) {
      await BudgetTracker.reverseSpend(req.userId!, transaction.category, transaction.amount);
    }

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Helper Functions ────────────────────────────────────────
function classifySpendingSentiment(
  category: string,
  _amount: number
): 'essential' | 'discretionary' | 'luxury' {
  const essentialCategories = ['Housing', 'Utilities', 'Groceries', 'Healthcare', 'Insurance', 'Transportation'];
  const luxuryCategories = ['Travel', 'Entertainment', 'Shopping'];

  if (essentialCategories.includes(category)) return 'essential';
  if (luxuryCategories.includes(category)) return 'luxury';
  return 'discretionary';
}

export default router;
