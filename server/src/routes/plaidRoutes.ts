import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { PlaidService } from '../services/plaidService';
import { User, Transaction, TransactionSource } from '../models';
import { MLService } from '../services/mlService';
import { AnomalyService } from '../services/anomalyService';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

/**
 * POST /api/plaid/create-link-token
 * Generate a Plaid Link token for the frontend to open Link UI
 */
router.post('/create-link-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linkToken = await PlaidService.createLinkToken(req.userId!);
    res.json({ linkToken });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/plaid/exchange-token
 * Exchange Plaid public token for access token after user links their bank
 */
router.post('/exchange-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publicToken, institutionId, institutionName } = req.body;

    if (!publicToken) {
      res.status(400).json({ error: 'Public token is required' });
      return;
    }

    const { accessToken, itemId } = await PlaidService.exchangePublicToken(publicToken);

    // Get account details
    const accounts = await PlaidService.getAccounts(accessToken);

    // Save linked account to user profile
    const user = await User.findById(req.userId).select('+linkedAccounts.plaidAccessToken');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.linkedAccounts.push({
      plaidItemId: itemId,
      plaidAccessToken: accessToken,
      institutionName: institutionName || 'Unknown',
      institutionId: institutionId || '',
      accountIds: accounts.map((a: any) => a.account_id),
      lastSynced: new Date(),
    });
    await user.save();

    logger.info(`Bank linked for user ${req.userId}: ${institutionName}`);

    res.json({
      message: 'Bank account linked successfully',
      institution: institutionName,
      accounts: accounts.map((a: any) => ({
        id: a.account_id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/plaid/sync-transactions
 * Fetch and sync new transactions from Plaid
 */
router.post('/sync-transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId).select('+linkedAccounts.plaidAccessToken');
    if (!user || user.linkedAccounts.length === 0) {
      res.status(400).json({ error: 'No linked bank accounts found' });
      return;
    }

    let totalImported = 0;
    let totalSkipped = 0;

    for (const account of user.linkedAccounts) {
      try {
        const transactions = await PlaidService.getTransactions(
          account.plaidAccessToken,
          account.lastSynced || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );

        for (const plaidTx of transactions) {
          // Skip if already imported
          const exists = await Transaction.findOne({
            plaidTransactionId: plaidTx.transaction_id,
          });
          if (exists) {
            totalSkipped++;
            continue;
          }

          // AI-powered categorization
          let category = 'Miscellaneous';
          let categoryConfidence = 0;
          try {
            const mlResult = await MLService.categorize({
              merchant: plaidTx.merchant_name || plaidTx.name,
              amount: Math.abs(plaidTx.amount),
              description: plaidTx.name,
            });
            category = mlResult.category;
            categoryConfidence = mlResult.confidence;
          } catch {
            // Use Plaid's category as fallback
            category = plaidTx.category?.[0] || 'Miscellaneous';
          }

          // Anomaly detection
          let anomalyResult = { score: 0, isAnomaly: false, reason: '' };
          try {
            anomalyResult = await AnomalyService.checkTransaction(req.userId!, {
              amount: Math.abs(plaidTx.amount),
              category,
              merchant: plaidTx.merchant_name || plaidTx.name,
              date: new Date(plaidTx.date),
            });
          } catch {
            // Continue without anomaly detection
          }

          // Create transaction
          const transaction = new Transaction({
            userId: req.userId,
            date: new Date(plaidTx.date),
            amount: Math.abs(plaidTx.amount),
            type: plaidTx.amount > 0 ? 'expense' : 'income',
            category,
            suggestedCategory: category,
            categoryConfidence,
            merchant: plaidTx.merchant_name || plaidTx.name,
            description: plaidTx.name,
            currency: plaidTx.iso_currency_code || 'USD',
            accountId: plaidTx.account_id,
            source: TransactionSource.PLAID,
            location: plaidTx.location ? {
              city: plaidTx.location.city,
              region: plaidTx.location.region,
              country: plaidTx.location.country,
            } : undefined,
            plaidTransactionId: plaidTx.transaction_id,
            plaidCategory: plaidTx.category,
            pending: plaidTx.pending,
            anomalyScore: anomalyResult.score,
            isAnomaly: anomalyResult.isAnomaly,
            anomalyReason: anomalyResult.reason,
          });
          await transaction.save();
          totalImported++;
        }

        // Update last synced timestamp
        account.lastSynced = new Date();
      } catch (err) {
        logger.error(`Failed to sync from ${account.institutionName}:`, err);
      }
    }

    await user.save();

    res.json({
      message: 'Transaction sync complete',
      imported: totalImported,
      skipped: totalSkipped,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/plaid/accounts
 * List linked bank accounts
 */
router.get('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const accounts = user.linkedAccounts.map((a) => ({
      itemId: a.plaidItemId,
      institution: a.institutionName,
      accountIds: a.accountIds,
      lastSynced: a.lastSynced,
    }));

    res.json({ accounts });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/plaid/accounts/:itemId
 * Unlink a bank account
 */
router.delete('/accounts/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId).select('+linkedAccounts.plaidAccessToken');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const accountIndex = user.linkedAccounts.findIndex(
      (a) => a.plaidItemId === req.params.itemId
    );
    if (accountIndex === -1) {
      res.status(404).json({ error: 'Linked account not found' });
      return;
    }

    // Remove from Plaid
    try {
      await PlaidService.removeItem(user.linkedAccounts[accountIndex].plaidAccessToken);
    } catch {
      logger.warn('Failed to remove item from Plaid');
    }

    user.linkedAccounts.splice(accountIndex, 1);
    await user.save();

    res.json({ message: 'Bank account unlinked' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/plaid/webhook
 * Handle Plaid webhooks for real-time transaction updates
 */
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { webhook_type, webhook_code, item_id } = req.body;

    logger.info(`Plaid webhook: ${webhook_type} - ${webhook_code} for item ${item_id}`);

    if (webhook_type === 'TRANSACTIONS') {
      if (webhook_code === 'DEFAULT_UPDATE' || webhook_code === 'INITIAL_UPDATE') {
        // Find the user with this item and trigger sync
        const user = await User.findOne({ 'linkedAccounts.plaidItemId': item_id });
        if (user) {
          // In production, queue this for background processing
          logger.info(`Triggering transaction sync for user ${user._id}`);
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

export default router;
