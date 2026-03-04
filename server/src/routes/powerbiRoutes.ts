import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PowerBIService } from '../services/powerbiService';
import { UserRole } from '../models';

const router = Router();
router.use(authenticate);

/**
 * GET /api/powerbi/embed-token
 * Generate a Power BI embed token for the authenticated user
 * The token is scoped to the user's data via Row-Level Security
 */
router.get('/embed-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reportId } = req.query;

    const embedConfig = await PowerBIService.getEmbedToken(
      req.userId!,
      req.user!.email,
      req.userRole!,
      reportId as string
    );

    res.json({
      embedUrl: embedConfig.embedUrl,
      embedToken: embedConfig.token,
      reportId: embedConfig.reportId,
      tokenExpiry: embedConfig.expiry,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/powerbi/reports
 * List available Power BI reports for the user's role
 */
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await PowerBIService.listReports(req.userRole!);
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/powerbi/refresh
 * Trigger a dataset refresh in Power BI (Admin/Analyst only)
 */
router.post(
  '/refresh',
  authorize(UserRole.ADMIN, UserRole.ANALYST),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await PowerBIService.refreshDataset();
      res.json({ message: 'Dataset refresh triggered' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/powerbi/push-data
 * Push latest transaction data to Power BI dataset
 */
router.post(
  '/push-data',
  authorize(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await PowerBIService.pushTransactionData();
      res.json({
        message: 'Data pushed to Power BI',
        rowsPushed: result.rowCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
