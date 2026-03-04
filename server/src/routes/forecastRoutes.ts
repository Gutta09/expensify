import { Router, Request, Response, NextFunction } from 'express';
import { Forecast } from '../models';
import { authenticate } from '../middleware/auth';
import { MLService } from '../services/mlService';

const router = Router();
router.use(authenticate);

/**
 * GET /api/forecast
 * Get the user's latest spending forecast
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, horizon = 30 } = req.query;

    const query: any = { userId: req.userId, isActive: true };
    if (category) query.category = category;

    const forecast = await Forecast.findOne(query)
      .sort({ generatedAt: -1 });

    if (!forecast) {
      res.status(404).json({
        error: 'No forecast available. Need at least 30 days of transaction data.',
        hint: 'Forecasts are generated automatically once sufficient data is collected.',
      });
      return;
    }

    res.json({ forecast });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/forecast/generate
 * Trigger forecast generation for the user (on-demand)
 */
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, horizon = 30 } = req.body;

    // Call ML service to generate forecast
    const forecastResult = await MLService.generateForecast(
      req.userId!,
      Number(horizon),
      category
    );

    // Deactivate old forecasts for the same category
    await Forecast.updateMany(
      { userId: req.userId, category: category || null, isActive: true },
      { isActive: false }
    );

    // Save new forecast
    const forecast = new Forecast({
      userId: req.userId,
      modelName: forecastResult.modelName,
      modelVersion: forecastResult.modelVersion,
      forecastHorizon: Number(horizon),
      category: category || null,
      forecastData: forecastResult.predictions,
      accuracy: forecastResult.accuracy,
      metadata: forecastResult.metadata,
      isActive: true,
    });
    await forecast.save();

    res.status(201).json({ forecast });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/forecast/categories
 * Get forecasts broken down by category
 */
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forecasts = await Forecast.find({
      userId: req.userId,
      isActive: true,
      category: { $ne: null },
    }).sort({ category: 1 });

    res.json({ forecasts });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/forecast/accuracy
 * Get historical accuracy of forecasts vs actual spending
 */
router.get('/accuracy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forecasts = await Forecast.find({
      userId: req.userId,
    })
      .sort({ generatedAt: -1 })
      .limit(10)
      .select('modelName accuracy generatedAt category');

    res.json({ forecasts });
  } catch (error) {
    next(error);
  }
});

export default router;
