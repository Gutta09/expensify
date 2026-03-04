import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Transaction, Budget, Forecast, Recommendation } from '../models';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/expenseiq';

const CATEGORIES = [
  'Food & Dining', 'Shopping', 'Transportation', 'Entertainment',
  'Bills & Utilities', 'Healthcare', 'Groceries', 'Personal Care',
  'Education', 'Travel', 'Gifts & Donations', 'Insurance',
];

const MERCHANTS: Record<string, string[]> = {
  'Food & Dining': ['Starbucks', 'Chipotle', 'Olive Garden', 'McDonald\'s', 'Domino\'s', 'Panera Bread'],
  'Shopping': ['Amazon', 'Target', 'Walmart', 'Best Buy', 'Nike', 'IKEA'],
  'Transportation': ['Uber', 'Lyft', 'Shell Gas', 'Chevron', 'Parking Authority'],
  'Entertainment': ['Netflix', 'Spotify', 'AMC Theatres', 'Steam', 'Disney+'],
  'Bills & Utilities': ['Verizon', 'ConEd', 'Comcast', 'Water Utility', 'AT&T'],
  'Healthcare': ['CVS Pharmacy', 'Walgreens', 'Dr. Smith Office', 'Quest Diagnostics'],
  'Groceries': ['Whole Foods', 'Trader Joe\'s', 'Costco', 'Safeway', 'Kroger'],
  'Personal Care': ['Great Clips', 'Sephora', 'Gym Membership', 'Spa Visit'],
  'Education': ['Udemy', 'Coursera', 'University Bookstore', 'Chegg'],
  'Travel': ['Delta Airlines', 'Marriott Hotel', 'Airbnb', 'Expedia'],
  'Gifts & Donations': ['Red Cross', 'GoFundMe', 'Hallmark', 'Etsy'],
  'Insurance': ['State Farm', 'Geico', 'Progressive', 'Allstate'],
};

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(daysBack: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Transaction.deleteMany({}),
    Budget.deleteMany({}),
    Forecast.deleteMany({}),
    Recommendation.deleteMany({}),
  ]);

  // Create users
  console.log('👤 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 12);

  const users = await User.create([
    {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@expenseiq.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      preferences: { currency: 'USD', timezone: 'America/New_York' },
    },
    {
      firstName: 'Jane',
      lastName: 'Analyst',
      email: 'analyst@expenseiq.com',
      password: hashedPassword,
      role: 'analyst',
      isActive: true,
      preferences: { currency: 'USD', timezone: 'America/Chicago' },
    },
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: hashedPassword,
      role: 'user',
      isActive: true,
      preferences: { currency: 'USD', timezone: 'America/New_York' },
    },
    {
      firstName: 'Sarah',
      lastName: 'Smith',
      email: 'sarah@example.com',
      password: hashedPassword,
      role: 'user',
      isActive: true,
      preferences: { currency: 'USD', timezone: 'America/Los_Angeles' },
    },
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Generate transactions for each regular user
  const regularUsers = users.filter((u) => u.role === 'user');

  for (const user of regularUsers) {
    console.log(`💰 Generating transactions for ${user.fullName}...`);

    const transactions: any[] = [];
    const daysBack = 180;

    // Generate 200-400 expense transactions
    const expenseCount = Math.floor(randomBetween(200, 400));
    for (let i = 0; i < expenseCount; i++) {
      const category = pickRandom(CATEGORIES);
      const merchant = pickRandom(MERCHANTS[category] || ['Unknown']);

      const amountRanges: Record<string, [number, number]> = {
        'Food & Dining': [5, 80],
        'Shopping': [10, 300],
        'Transportation': [5, 60],
        'Entertainment': [8, 50],
        'Bills & Utilities': [30, 250],
        'Healthcare': [15, 500],
        'Groceries': [20, 200],
        'Personal Care': [15, 100],
        'Education': [10, 200],
        'Travel': [50, 1500],
        'Gifts & Donations': [10, 200],
        'Insurance': [50, 400],
      };

      const [min, max] = amountRanges[category] || [5, 100];
      const amount = parseFloat(randomBetween(min, max).toFixed(2));
      const date = randomDate(daysBack);

      // Occasionally mark as anomaly (3% chance)
      const isAnomaly = Math.random() < 0.03;

      transactions.push({
        user: user._id,
        description: `${merchant} purchase`,
        amount: isAnomaly ? amount * randomBetween(3, 8) : amount,
        type: 'expense',
        category,
        merchant,
        date,
        isAnomaly,
        anomalyScore: isAnomaly ? randomBetween(0.7, 0.99) : randomBetween(0, 0.3),
        categoryConfidence: randomBetween(0.75, 0.99),
        source: 'manual',
      });
    }

    // Generate 6-12 income transactions
    const incomeCount = Math.floor(randomBetween(6, 12));
    for (let i = 0; i < incomeCount; i++) {
      transactions.push({
        user: user._id,
        description: 'Salary deposit',
        amount: parseFloat(randomBetween(3000, 6000).toFixed(2)),
        type: 'income',
        category: 'Income',
        merchant: 'Employer',
        date: randomDate(daysBack),
        source: 'manual',
      });
    }

    // Insert transactions in batch
    const inserted = await Transaction.insertMany(transactions);
    console.log(`  ✅ ${inserted.length} transactions created`);

    // Create budgets
    console.log(`  📊 Creating budgets for ${user.fullName}...`);
    const budgetCategories = CATEGORIES.slice(0, 6); // First 6 categories
    const budgetDocs = budgetCategories.map((category) => {
      const limit = parseFloat(randomBetween(200, 800).toFixed(2));
      const spent = parseFloat(randomBetween(0, limit * 1.2).toFixed(2));
      return {
        user: user._id,
        category,
        limit,
        currentSpend: spent,
        remaining: Math.max(0, limit - spent),
        utilization: (spent / limit) * 100,
        period: 'monthly' as const,
        alertThreshold: 80,
      };
    });

    await Budget.insertMany(budgetDocs);
    console.log(`  ✅ ${budgetDocs.length} budgets created`);

    // Create recommendations
    console.log(`  💡 Creating recommendations for ${user.fullName}...`);
    await Recommendation.create([
      {
        user: user._id,
        type: 'savings',
        title: 'Reduce dining out spending',
        description:
          'Your Food & Dining spending is 35% above your 3-month average. Consider meal prepping to save approximately $150/month.',
        priority: 'high',
        impact: {
          monthlySavings: 150,
          annualSavings: 1800,
          percentReduction: 35,
        },
        actionItems: [
          'Set a weekly meal prep schedule',
          'Use grocery delivery to avoid impulse restaurant visits',
          'Set a $50/week dining out budget',
        ],
        status: 'active',
      },
      {
        user: user._id,
        type: 'budget_adjustment',
        title: 'Adjust transportation budget',
        description:
          'You consistently underspend on transportation by 40%. Reallocating $80 to savings or investment could grow to $960/year.',
        priority: 'medium',
        impact: {
          monthlySavings: 80,
          annualSavings: 960,
          percentReduction: 40,
        },
        actionItems: [
          'Lower transportation budget to $120/month',
          'Redirect savings to an investment account',
        ],
        status: 'active',
      },
      {
        user: user._id,
        type: 'spending_optimization',
        title: 'Subscription audit recommended',
        description:
          'We detected 5 recurring subscriptions totaling $87/month. Review if all are necessary - users typically save 30% after an audit.',
        priority: 'low',
        impact: {
          monthlySavings: 26,
          annualSavings: 312,
          percentReduction: 30,
        },
        actionItems: [
          'Review all active subscriptions',
          'Cancel unused streaming services',
          'Look for annual billing discounts',
        ],
        status: 'active',
      },
    ]);
    console.log(`  ✅ 3 recommendations created`);
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('📋 Test Accounts:');
  console.log('  Admin:   admin@expenseiq.com / password123');
  console.log('  Analyst: analyst@expenseiq.com / password123');
  console.log('  User:    john@example.com / password123');
  console.log('  User:    sarah@example.com / password123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
