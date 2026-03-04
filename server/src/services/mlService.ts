import axios from 'axios';
import { logger } from '../utils/logger';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

interface CategorizationInput {
  merchant: string;
  amount: number;
  description?: string;
}

interface CategorizationResult {
  category: string;
  confidence: number;
  alternatives: { category: string; confidence: number }[];
}

interface ForecastResult {
  modelName: string;
  modelVersion: string;
  predictions: { date: Date; predictedAmount: number; lowerBound: number; upperBound: number }[];
  accuracy: { mape: number; rmse: number; r2Score: number };
  metadata: {
    trainingDataStart: Date;
    trainingDataEnd: Date;
    dataPointsUsed: number;
    features: string[];
  };
}

export class MLService {
  /**
   * Categorize a transaction using the ML model
   */
  static async categorize(input: CategorizationInput): Promise<CategorizationResult> {
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/api/categorize`, {
        merchant: input.merchant,
        amount: input.amount,
        description: input.description,
      }, { timeout: 5000 });

      return response.data;
    } catch (error) {
      logger.warn('ML categorization service unavailable, using fallback');
      return fallbackCategorize(input);
    }
  }

  /**
   * Generate spending forecast for a user
   */
  static async generateForecast(
    userId: string,
    horizon: number = 30,
    category?: string
  ): Promise<ForecastResult> {
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/api/forecast`, {
        userId,
        horizon,
        category,
      }, { timeout: 30000 }); // Forecast may take longer

      return response.data;
    } catch (error) {
      logger.error('ML forecast service error:', error);
      throw new Error('Forecast generation failed. Please try again later.');
    }
  }

  /**
   * Submit categorization feedback for model retraining
   */
  static async submitFeedback(feedback: {
    merchant: string;
    oldCategory: string;
    correctCategory: string;
    userId: string;
  }): Promise<void> {
    try {
      await axios.post(`${ML_SERVICE_URL}/api/feedback`, feedback, {
        timeout: 5000,
      });
    } catch (error) {
      logger.warn('ML feedback submission failed:', error);
    }
  }

  /**
   * Trigger model retraining for a user
   */
  static async retrain(userId: string): Promise<{ status: string; version: string }> {
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/api/retrain`, {
        userId,
      }, { timeout: 60000 });

      return response.data;
    } catch (error) {
      logger.error('ML retraining error:', error);
      throw new Error('Model retraining failed');
    }
  }

  /**
   * Health check for ML service
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// ─── Fallback Categorization (Rule-Based) ────────────────────
function fallbackCategorize(input: CategorizationInput): CategorizationResult {
  const merchantLower = input.merchant.toLowerCase();
  const rules: { patterns: string[]; category: string }[] = [
    { patterns: ['amazon', 'walmart', 'target', 'costco', 'ebay'], category: 'Shopping' },
    { patterns: ['uber', 'lyft', 'gas', 'shell', 'chevron', 'exxon', 'parking'], category: 'Transportation' },
    { patterns: ['starbucks', 'mcdonald', 'chipotle', 'doordash', 'grubhub', 'uber eats', 'restaurant'], category: 'Food & Dining' },
    { patterns: ['kroger', 'safeway', 'whole foods', 'trader joe', 'grocery', 'aldi'], category: 'Groceries' },
    { patterns: ['netflix', 'spotify', 'hulu', 'disney', 'apple', 'google play', 'subscription'], category: 'Subscriptions' },
    { patterns: ['rent', 'mortgage', 'apartment'], category: 'Housing' },
    { patterns: ['electric', 'water', 'gas bill', 'internet', 'comcast', 'verizon', 'at&t'], category: 'Utilities' },
    { patterns: ['doctor', 'pharmacy', 'cvs', 'walgreens', 'hospital', 'dental', 'medical'], category: 'Healthcare' },
    { patterns: ['gym', 'fitness', 'planet fitness', 'movie', 'theater', 'concert'], category: 'Entertainment' },
    { patterns: ['airline', 'hotel', 'airbnb', 'booking', 'expedia', 'travel'], category: 'Travel' },
    { patterns: ['insurance', 'geico', 'progressive', 'state farm'], category: 'Insurance' },
    { patterns: ['tuition', 'university', 'school', 'course', 'udemy', 'coursera'], category: 'Education' },
  ];

  for (const rule of rules) {
    if (rule.patterns.some((p) => merchantLower.includes(p))) {
      return {
        category: rule.category,
        confidence: 0.65,
        alternatives: [],
      };
    }
  }

  return {
    category: 'Miscellaneous',
    confidence: 0.3,
    alternatives: [],
  };
}
