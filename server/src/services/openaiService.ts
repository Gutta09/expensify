import OpenAI from 'openai';
import { logger } from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface FinancialContext {
  totalSpendLast30Days: number;
  categoryBreakdown: { category: string; total: number; transactions: number }[];
  recentTransactions: { date: string; amount: number; type: string; category: string; merchant: string }[];
  anomalyCount: number;
  currency: string;
}

interface SpendingData {
  categorySpending: any[];
  recurringExpenses: any[];
  recentAnomalies: any[];
  monthlyTrend: any[];
  userPreferences: any;
}

export class OpenAIService {
  /**
   * AI Financial Coach — conversational chat about user's finances
   */
  static async chat(
    userMessage: string,
    context: FinancialContext,
    conversationHistory: { role: string; content: string }[]
  ) {
    try {
      const systemPrompt = `You are an expert AI Financial Coach integrated into the ExpenseIQ intelligent expense tracker. You have access to the user's real financial data and provide personalized, actionable insights.

FINANCIAL CONTEXT:
- Total spending (last 30 days): ${context.currency} ${context.totalSpendLast30Days.toFixed(2)}
- Spending by category: ${JSON.stringify(context.categoryBreakdown)}
- Recent transactions: ${JSON.stringify(context.recentTransactions)}
- Anomalous transactions detected: ${context.anomalyCount}

GUIDELINES:
1. Always reference the user's actual data when providing insights
2. Be specific with numbers and percentages
3. Provide actionable recommendations, not generic advice
4. Identify spending patterns and trends
5. Flag potential areas for savings
6. Use a supportive, non-judgmental tone
7. When the user asks about specific categories or merchants, analyze their data precisely
8. Suggest concrete dollar amounts for savings goals
9. Compare current spending to previous periods when relevant
10. If asked about forecasts, explain the prediction methodology`;

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: userMessage },
      ];

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        functions: [
          {
            name: 'provide_financial_insight',
            description: 'Structure the financial insight with main message, key insights, and suggested actions',
            parameters: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The main conversational response to the user',
                },
                insights: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Key data-driven insights (2-4 bullet points)',
                },
                suggestedActions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific actionable steps the user can take',
                },
              },
              required: ['message'],
            },
          },
        ],
        function_call: { name: 'provide_financial_insight' },
      });

      const functionCall = completion.choices[0].message.function_call;
      if (functionCall) {
        const result = JSON.parse(functionCall.arguments);
        return {
          message: result.message,
          insights: result.insights || [],
          suggestedActions: result.suggestedActions || [],
        };
      }

      return {
        message: completion.choices[0].message.content || 'I could not generate a response.',
        insights: [],
        suggestedActions: [],
      };
    } catch (error) {
      logger.error('OpenAI chat error:', error);
      throw new Error('AI service temporarily unavailable');
    }
  }

  /**
   * Generate personalized spending recommendations
   */
  static async generateRecommendations(data: SpendingData): Promise<any[]> {
    try {
      const prompt = `Analyze the following financial data and generate 3-5 specific, personalized spending recommendations.

SPENDING DATA:
- Category spending (3 months): ${JSON.stringify(data.categorySpending)}
- Recurring expenses: ${JSON.stringify(data.recurringExpenses)}
- Detected anomalies: ${JSON.stringify(data.recentAnomalies)}
- Monthly trend: ${JSON.stringify(data.monthlyTrend)}
- User currency: ${data.userPreferences?.currency || 'USD'}

For each recommendation, provide:
1. Type: one of [savings, budget_adjustment, spending_reduction, subscription_review, behavioral, investment]
2. Title: concise 5-10 word title
3. Description: 2-3 sentence explanation referencing specific data
4. Estimated monthly savings amount
5. Confidence score (0-1) based on data strength
6. 2-3 specific action items
7. Related spending categories

Format as JSON array.`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst AI. Return ONLY valid JSON arrays with no markdown formatting.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });

      const content = completion.choices[0].message.content || '[]';
      // Parse the JSON response
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const recommendations = JSON.parse(cleaned);

      return recommendations.map((rec: any) => ({
        type: rec.type || 'savings',
        title: rec.title,
        description: rec.description,
        impact: {
          estimatedMonthlySavings: rec.estimatedMonthlySavings || rec.estimated_monthly_savings || 0,
          confidenceScore: rec.confidenceScore || rec.confidence_score || 0.5,
          timeframeWeeks: rec.timeframeWeeks || 4,
        },
        actionItems: rec.actionItems || rec.action_items || [],
        relatedCategories: rec.relatedCategories || rec.related_categories || [],
        patterns: rec.patterns || [],
      }));
    } catch (error) {
      logger.error('OpenAI recommendation generation error:', error);
      // Return basic rule-based recommendations as fallback
      return generateFallbackRecommendations(data);
    }
  }

  /**
   * Deep spending analysis
   */
  static async deepAnalysis(spendingData: any[], analysisType: string) {
    try {
      const prompt = `Perform a ${analysisType} financial analysis on this 6-month spending data:

DATA: ${JSON.stringify(spendingData)}

Provide:
1. Summary: 3-4 sentence overview of financial health
2. Key Findings: 4-6 specific data-driven findings
3. Recommendations: 3-5 actionable recommendations
4. Risk Areas: categories or patterns that need attention
5. Savings Opportunities: specific ways to reduce spending

Format as JSON with keys: summary, findings, recommendations, risks, savings`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a senior financial analyst. Return ONLY valid JSON with no markdown.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      });

      const content = completion.choices[0].message.content || '{}';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      logger.error('OpenAI deep analysis error:', error);
      return {
        summary: 'Analysis temporarily unavailable. Please try again later.',
        findings: [],
        recommendations: [],
        risks: [],
        savings: [],
      };
    }
  }
}

// Fallback rule-based recommendations when AI is unavailable
function generateFallbackRecommendations(data: SpendingData): any[] {
  const recommendations: any[] = [];
  const categories = data.categorySpending;

  // Find highest spending category
  if (categories.length > 0) {
    const highest = categories[0];
    recommendations.push({
      type: 'spending_reduction',
      title: `Reduce ${highest._id} spending`,
      description: `${highest._id} is your highest expense category at $${highest.total.toFixed(2)} over 3 months. Consider setting a monthly budget to control this spending.`,
      impact: {
        estimatedMonthlySavings: Math.round(highest.total * 0.1 / 3),
        confidenceScore: 0.6,
        timeframeWeeks: 4,
      },
      actionItems: [
        `Set a monthly budget of $${Math.round(highest.total / 3 * 0.9)} for ${highest._id}`,
        'Track daily spending in this category',
      ],
      relatedCategories: [highest._id],
    });
  }

  // Check for subscription review
  if (data.recurringExpenses.length > 3) {
    const totalRecurring = data.recurringExpenses.reduce((s: number, e: any) => s + e.avgAmount, 0);
    recommendations.push({
      type: 'subscription_review',
      title: 'Review recurring subscriptions',
      description: `You have ${data.recurringExpenses.length} recurring expenses totaling approximately $${totalRecurring.toFixed(2)}/month. Review these for unused or redundant subscriptions.`,
      impact: {
        estimatedMonthlySavings: Math.round(totalRecurring * 0.15),
        confidenceScore: 0.7,
        timeframeWeeks: 2,
      },
      actionItems: [
        'List all active subscriptions',
        'Cancel any unused subscriptions',
        'Look for cheaper alternatives',
      ],
      relatedCategories: ['Subscriptions'],
    });
  }

  return recommendations;
}
