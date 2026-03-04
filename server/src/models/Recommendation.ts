import mongoose, { Document, Schema } from 'mongoose';

export enum RecommendationType {
  SAVINGS = 'savings',
  BUDGET_ADJUSTMENT = 'budget_adjustment',
  SPENDING_REDUCTION = 'spending_reduction',
  INVESTMENT = 'investment',
  SUBSCRIPTION_REVIEW = 'subscription_review',
  BEHAVIORAL = 'behavioral',
}

export interface IRecommendation extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: RecommendationType;
  title: string;
  description: string;
  impact: {
    estimatedMonthlySavings: number;
    confidenceScore: number;
    timeframeWeeks: number;
  };
  actionItems: string[];
  relatedCategories: string[];
  basedOn: {
    dataRange: { start: Date; end: Date };
    transactionCount: number;
    patterns: string[];
  };
  status: 'active' | 'accepted' | 'dismissed' | 'completed';
  feedback?: {
    helpful: boolean;
    comment?: string;
    ratedAt: Date;
  };
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationSchema = new Schema<IRecommendation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(RecommendationType),
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    impact: {
      estimatedMonthlySavings: { type: Number, default: 0 },
      confidenceScore: { type: Number, min: 0, max: 1 },
      timeframeWeeks: { type: Number, default: 4 },
    },
    actionItems: [String],
    relatedCategories: [String],
    basedOn: {
      dataRange: {
        start: Date,
        end: Date,
      },
      transactionCount: Number,
      patterns: [String],
    },
    status: {
      type: String,
      enum: ['active', 'accepted', 'dismissed', 'completed'],
      default: 'active',
    },
    feedback: {
      helpful: Boolean,
      comment: String,
      ratedAt: Date,
    },
    expiresAt: Date,
  },
  { timestamps: true }
);

recommendationSchema.index({ userId: 1, status: 1 });
recommendationSchema.index({ userId: 1, type: 1 });

export const Recommendation = mongoose.model<IRecommendation>(
  'Recommendation',
  recommendationSchema
);
