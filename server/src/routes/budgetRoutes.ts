import { Router, Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Budget } from '../models';
import { authenticate } from '../middleware/auth';
import { createBudgetValidator } from '../middleware/validators';
import { Transaction } from '../models';

const router = Router();
router.use(authenticate);

/**
 * GET /api/budgets
 * Get all budgets for the authenticated user
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = req.query;
    const query: any = { userId: req.userId };
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const budgets = await Budget.find(query).sort({ category: 1 });
    res.json({ budgets });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/budgets
 * Create a new budget
 */
router.post('/', createBudgetValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const budget = new Budget({
      ...req.body,
      userId: req.userId,
      alerts: [
        { threshold: req.body.alertThreshold || 80, triggered: false },
      ],
    });
    await budget.save();

    res.status(201).json({ budget });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/budgets/:id
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }
    res.json({ budget });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/budgets/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }
    res.json({ message: 'Budget deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/budgets/variance
 * Returns actual vs. budget aggregates per category for Power BI dashboards
 */
router.get('/variance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeBudgets = await Budget.find({
      userId: req.userId,
      isActive: true,
    });

    const variance = await Promise.all(
      activeBudgets.map(async (budget) => {
        const actualSpend = await Transaction.aggregate([
          {
            $match: {
              userId: req.user!._id,
              category: budget.category,
              type: 'expense',
              date: { $gte: budget.startDate, $lte: budget.endDate },
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        const actual = actualSpend[0]?.total || 0;
        const varianceAmount = budget.limitAmount - actual;
        const variancePercent = budget.limitAmount > 0
          ? ((varianceAmount / budget.limitAmount) * 100).toFixed(1)
          : 0;

        return {
          budgetId: budget._id,
          category: budget.category,
          period: budget.period,
          budgeted: budget.limitAmount,
          actual,
          variance: varianceAmount,
          variancePercent: Number(variancePercent),
          status: actual > budget.limitAmount ? 'exceeded' : actual > budget.limitAmount * 0.8 ? 'warning' : 'on_track',
        };
      })
    );

    res.json({ variance });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/budgets/ai-suggestions
 * Get AI-suggested budget limits based on spending patterns
 */
router.get('/ai-suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Analyze last 3 months of spending per category
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const categorySpending = await Transaction.aggregate([
      {
        $match: {
          userId: req.user!._id,
          type: 'expense',
          date: { $gte: threeMonthsAgo },
        },
      },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$amount' },
          avgMonthly: { $avg: '$amount' },
          transactionCount: { $sum: 1 },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' },
        },
      },
      { $sort: { totalSpent: -1 } },
    ]);

    const suggestions = categorySpending.map((cat) => ({
      category: cat._id,
      suggestedMonthlyBudget: Math.ceil((cat.totalSpent / 3) * 1.1), // 10% buffer
      averageMonthlySpend: Math.round(cat.totalSpent / 3),
      transactionCount: cat.transactionCount,
      reasoning: `Based on $${Math.round(cat.totalSpent / 3)}/month average over 3 months with 10% buffer`,
    }));

    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

export default router;
