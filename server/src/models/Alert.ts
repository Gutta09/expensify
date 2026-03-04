import mongoose, { Document, Schema } from 'mongoose';

export enum AlertType {
  ANOMALY = 'anomaly',
  BUDGET_WARNING = 'budget_warning',
  BUDGET_EXCEEDED = 'budget_exceeded',
  RECURRING_CHANGE = 'recurring_change',
  SPENDING_SPIKE = 'spending_spike',
  SAVINGS_OPPORTUNITY = 'savings_opportunity',
  FORECAST_DEVIATION = 'forecast_deviation',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface IAlert extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data: {
    transactionId?: mongoose.Types.ObjectId;
    budgetId?: mongoose.Types.ObjectId;
    category?: string;
    amount?: number;
    expectedAmount?: number;
    deviationPercent?: number;
  };
  isRead: boolean;
  isDismissed: boolean;
  actionUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(AlertType),
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(AlertSeverity),
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: {
      transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
      budgetId: { type: Schema.Types.ObjectId, ref: 'Budget' },
      category: String,
      amount: Number,
      expectedAmount: Number,
      deviationPercent: Number,
    },
    isRead: { type: Boolean, default: false },
    isDismissed: { type: Boolean, default: false },
    actionUrl: String,
  },
  { timestamps: true }
);

alertSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
alertSchema.index({ userId: 1, type: 1 });

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
