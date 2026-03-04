import { Transaction } from '../models';
import { Alert, AlertType, AlertSeverity } from '../models';
import { emitToUser, SocketEvents } from '../config/socket';
import { logger } from '../utils/logger';
import axios from 'axios';
import mongoose from 'mongoose';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

interface AnomalyResult {
  score: number;
  isAnomaly: boolean;
  reason: string;
}

export class AnomalyService {
  /**
   * Check a new transaction for anomalies
   * Uses both ML-based and rule-based detection
   */
  static async checkTransaction(
    userId: string,
    transactionData: any
  ): Promise<AnomalyResult> {
    try {
      // Try ML-based anomaly detection first
      const mlResult = await this.mlAnomalyCheck(userId, transactionData);
      if (mlResult) return mlResult;
    } catch {
      logger.warn('ML anomaly detection unavailable, using rule-based fallback');
    }

    // Rule-based fallback
    return this.ruleBasedAnomalyCheck(userId, transactionData);
  }

  /**
   * ML-based anomaly detection via Python microservice
   */
  private static async mlAnomalyCheck(
    userId: string,
    transactionData: any
  ): Promise<AnomalyResult | null> {
    try {
      const response = await axios.post(
        `${ML_SERVICE_URL}/api/detect-anomaly`,
        {
          userId,
          amount: transactionData.amount,
          category: transactionData.category,
          merchant: transactionData.merchant,
          date: transactionData.date,
        },
        { timeout: 5000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Rule-based anomaly detection
   * Compares transaction to user's historical patterns
   */
  private static async ruleBasedAnomalyCheck(
    userId: string,
    transactionData: any
  ): Promise<AnomalyResult> {
    const { amount, category, merchant } = transactionData;
    const reasons: string[] = [];
    let score = 0;

    // Get historical stats for this user and category
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          category,
          type: 'expense',
          date: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          avgAmount: { $avg: '$amount' },
          stdDev: { $stdDevPop: '$amount' },
          maxAmount: { $max: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0 && stats[0].count >= 3) {
      const { avgAmount, stdDev, maxAmount } = stats[0];

      // Check 1: Amount is more than 2 standard deviations above mean
      if (stdDev > 0 && amount > avgAmount + 2 * stdDev) {
        const deviation = ((amount - avgAmount) / stdDev).toFixed(1);
        reasons.push(`Amount is ${deviation}σ above your average of $${avgAmount.toFixed(2)} in ${category}`);
        score += 0.4;
      }

      // Check 2: Amount is more than 3x the average
      if (amount > avgAmount * 3) {
        reasons.push(`Amount is ${(amount / avgAmount).toFixed(1)}x your average ${category} transaction`);
        score += 0.3;
      }

      // Check 3: New record high for this category
      if (amount > maxAmount) {
        reasons.push(`This is your highest ${category} transaction — exceeds previous max of $${maxAmount.toFixed(2)}`);
        score += 0.2;
      }
    }

    // Check 4: Overall unusual amount (> $500 for any single transaction)
    if (amount > 500) {
      const overallStats = await Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            type: 'expense',
            date: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            avgAmount: { $avg: '$amount' },
            p95: { $percentile: { input: '$amount', p: [0.95], method: 'approximate' } },
          },
        },
      ] as any[]);

      if (overallStats.length > 0) {
        const avg = overallStats[0].avgAmount;
        if (amount > avg * 5) {
          reasons.push(`Unusually large transaction: 5x your overall average spend`);
          score += 0.3;
        }
      }
    }

    // Check 5: New merchant not seen before
    const merchantCount = await Transaction.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      merchant: { $regex: new RegExp(merchant, 'i') },
    });
    if (merchantCount === 0 && amount > 100) {
      reasons.push(`First transaction from "${merchant}" with amount > $100`);
      score += 0.15;
    }

    score = Math.min(score, 1);
    const isAnomaly = score >= 0.5;
    const reason = reasons.join('; ') || 'No anomalies detected';

    // Create alert if anomaly detected
    if (isAnomaly) {
      await this.createAnomalyAlert(userId, transactionData, score, reason);
    }

    return { score, isAnomaly, reason };
  }

  /**
   * Create an alert for detected anomalies
   */
  private static async createAnomalyAlert(
    userId: string,
    transactionData: any,
    score: number,
    reason: string
  ): Promise<void> {
    try {
      const severity =
        score >= 0.8 ? AlertSeverity.CRITICAL :
        score >= 0.6 ? AlertSeverity.HIGH :
        AlertSeverity.MEDIUM;

      const alert = new Alert({
        userId,
        type: AlertType.ANOMALY,
        severity,
        title: `Unusual ${transactionData.category} Transaction`,
        message: `$${transactionData.amount.toFixed(2)} at ${transactionData.merchant} flagged as unusual. ${reason}`,
        data: {
          category: transactionData.category,
          amount: transactionData.amount,
        },
      });
      await alert.save();

      emitToUser(userId, SocketEvents.ANOMALY_DETECTED, {
        alert,
        transaction: transactionData,
      });
    } catch (error) {
      logger.error('Failed to create anomaly alert:', error);
    }
  }
}
