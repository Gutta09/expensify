import { Budget } from '../models';
import { Alert, AlertType, AlertSeverity } from '../models';
import { emitToUser, SocketEvents } from '../config/socket';
import { logger } from '../utils/logger';

export class BudgetTracker {
  /**
   * Update budget spend when a new expense is added
   */
  static async updateSpend(
    userId: string,
    category: string,
    amount: number
  ): Promise<void> {
    try {
      const now = new Date();
      const activeBudgets = await Budget.find({
        userId,
        category,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      });

      for (const budget of activeBudgets) {
        budget.currentSpend += amount;
        await budget.save(); // triggers pre-save to update utilization

        // Check alert thresholds
        for (const alert of budget.alerts) {
          if (!alert.triggered && budget.utilizationPercent >= alert.threshold) {
            alert.triggered = true;
            alert.triggeredAt = new Date();
            await budget.save();

            // Create alert
            const alertType = budget.utilizationPercent >= 100
              ? AlertType.BUDGET_EXCEEDED
              : AlertType.BUDGET_WARNING;
            const severity = budget.utilizationPercent >= 100
              ? AlertSeverity.HIGH
              : AlertSeverity.MEDIUM;

            const alertDoc = new Alert({
              userId,
              type: alertType,
              severity,
              title: `${category} Budget ${budget.utilizationPercent >= 100 ? 'Exceeded' : 'Warning'}`,
              message: `You've used ${budget.utilizationPercent}% of your $${budget.limitAmount} ${category} budget. ${budget.remainingAmount > 0 ? `$${budget.remainingAmount.toFixed(2)} remaining.` : `Exceeded by $${Math.abs(budget.remainingAmount).toFixed(2)}.`}`,
              data: {
                budgetId: budget._id,
                category,
                amount: budget.currentSpend,
                expectedAmount: budget.limitAmount,
                deviationPercent: budget.utilizationPercent - 100,
              },
            });
            await alertDoc.save();

            emitToUser(userId, SocketEvents.BUDGET_ALERT, {
              budget: {
                category,
                utilization: budget.utilizationPercent,
                remaining: budget.remainingAmount,
              },
              alert: alertDoc,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Budget tracking error:', error);
    }
  }

  /**
   * Adjust budget spend when a transaction is updated
   */
  static async adjustSpend(
    userId: string,
    oldCategory: string,
    oldAmount: number,
    newCategory: string,
    newAmount: number
  ): Promise<void> {
    // Reverse old amount
    await this.reverseSpend(userId, oldCategory, oldAmount);
    // Apply new amount
    await this.updateSpend(userId, newCategory, newAmount);
  }

  /**
   * Reverse budget spend when a transaction is deleted
   */
  static async reverseSpend(
    userId: string,
    category: string,
    amount: number
  ): Promise<void> {
    try {
      const now = new Date();
      const activeBudgets = await Budget.find({
        userId,
        category,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      });

      for (const budget of activeBudgets) {
        budget.currentSpend = Math.max(0, budget.currentSpend - amount);
        await budget.save();
      }
    } catch (error) {
      logger.error('Budget reversal error:', error);
    }
  }
}
