import mongoose, { Document, Schema } from 'mongoose';

export enum TransactionType {
  EXPENSE = 'expense',
  INCOME = 'income',
  TRANSFER = 'transfer',
}

export enum TransactionSource {
  MANUAL = 'manual',
  PLAID = 'plaid',
  IMPORT = 'import',
}

// Predefined intelligent categories
export const SPENDING_CATEGORIES = [
  'Housing', 'Transportation', 'Food & Dining', 'Groceries',
  'Utilities', 'Healthcare', 'Insurance', 'Entertainment',
  'Shopping', 'Personal Care', 'Education', 'Travel',
  'Subscriptions', 'Investments', 'Gifts & Donations',
  'Business Expenses', 'Taxes', 'Miscellaneous',
] as const;

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  amount: number;
  type: TransactionType;
  category: string;
  suggestedCategory?: string; // AI-suggested category
  categoryConfidence?: number; // ML confidence score 0-1
  merchant: string;
  description?: string;
  currency: string;
  accountId?: string; // Plaid account ID
  source: TransactionSource;
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
  tags: string[];
  isRecurring: boolean;
  recurringPattern?: {
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
    nextExpected: Date;
  };
  // AI/ML fields
  anomalyScore: number; // 0 = normal, 1 = highly anomalous
  isAnomaly: boolean;
  anomalyReason?: string;
  sentiment?: 'essential' | 'discretionary' | 'luxury';
  // Plaid metadata
  plaidTransactionId?: string;
  plaidCategory?: string[];
  pending: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Transaction date is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      validate: {
        validator: (v: number) => v !== 0,
        message: 'Amount cannot be zero',
      },
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    suggestedCategory: String,
    categoryConfidence: { type: Number, min: 0, max: 1 },
    merchant: {
      type: String,
      required: [true, 'Merchant name is required'],
      trim: true,
    },
    description: { type: String, trim: true },
    currency: { type: String, default: 'USD', uppercase: true },
    accountId: String,
    source: {
      type: String,
      enum: Object.values(TransactionSource),
      default: TransactionSource.MANUAL,
    },
    location: {
      city: String,
      region: String,
      country: String,
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    isRecurring: { type: Boolean, default: false },
    recurringPattern: {
      frequency: {
        type: String,
        enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'],
      },
      nextExpected: Date,
    },
    // AI/ML fields
    anomalyScore: { type: Number, default: 0, min: 0, max: 1 },
    isAnomaly: { type: Boolean, default: false },
    anomalyReason: String,
    sentiment: {
      type: String,
      enum: ['essential', 'discretionary', 'luxury'],
    },
    // Plaid
    plaidTransactionId: { type: String, unique: true, sparse: true },
    plaidCategory: [String],
    pending: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1, date: -1 });
transactionSchema.index({ userId: 1, isAnomaly: 1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ merchant: 'text', description: 'text' });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
