import mongoose, { Document, Schema } from 'mongoose';

export enum BudgetPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

export interface IBudget extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  category: string;
  period: BudgetPeriod;
  limitAmount: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  // Computed tracking fields (updated via aggregation)
  currentSpend: number;
  remainingAmount: number;
  utilizationPercent: number;
  // AI-suggested fields
  aiSuggestedLimit?: number;
  aiConfidence?: number;
  aiReasoning?: string;
  alerts: {
    threshold: number; // e.g., 80%
    triggered: boolean;
    triggeredAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IBudget>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Budget category is required'],
      trim: true,
    },
    period: {
      type: String,
      enum: Object.values(BudgetPeriod),
      required: true,
    },
    limitAmount: {
      type: Number,
      required: [true, 'Budget limit is required'],
      min: [0, 'Budget limit must be positive'],
    },
    currency: { type: String, default: 'USD' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    currentSpend: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    utilizationPercent: { type: Number, default: 0 },
    aiSuggestedLimit: Number,
    aiConfidence: { type: Number, min: 0, max: 1 },
    aiReasoning: String,
    alerts: [
      {
        threshold: { type: Number, required: true },
        triggered: { type: Boolean, default: false },
        triggeredAt: Date,
      },
    ],
  },
  { timestamps: true }
);

budgetSchema.index({ userId: 1, category: 1, period: 1 });
budgetSchema.index({ userId: 1, isActive: 1 });

// Pre-save: compute remaining and utilization
budgetSchema.pre<IBudget>('save', function (next) {
  this.remainingAmount = Math.max(0, this.limitAmount - this.currentSpend);
  this.utilizationPercent =
    this.limitAmount > 0
      ? Math.round((this.currentSpend / this.limitAmount) * 100)
      : 0;
  next();
});

export const Budget = mongoose.model<IBudget>('Budget', budgetSchema);
