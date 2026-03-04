import mongoose, { Document, Schema } from 'mongoose';

export interface IForecastDataPoint {
  date: Date;
  predictedAmount: number;
  lowerBound: number;
  upperBound: number;
}

export interface IForecast extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  modelName: string; // e.g., 'prophet', 'lstm', 'arima'
  modelVersion: string;
  generatedAt: Date;
  forecastHorizon: number; // days into the future
  category?: string; // null = total spending forecast
  forecastData: IForecastDataPoint[];
  accuracy: {
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Squared Error
    r2Score: number;
  };
  metadata: {
    trainingDataStart: Date;
    trainingDataEnd: Date;
    dataPointsUsed: number;
    features: string[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const forecastSchema = new Schema<IForecast>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    modelName: {
      type: String,
      required: true,
      enum: ['prophet', 'lstm', 'arima', 'ensemble'],
    },
    modelVersion: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
    forecastHorizon: { type: Number, required: true },
    category: { type: String, default: null },
    forecastData: [
      {
        date: { type: Date, required: true },
        predictedAmount: { type: Number, required: true },
        lowerBound: { type: Number, required: true },
        upperBound: { type: Number, required: true },
      },
    ],
    accuracy: {
      mape: { type: Number, default: 0 },
      rmse: { type: Number, default: 0 },
      r2Score: { type: Number, default: 0 },
    },
    metadata: {
      trainingDataStart: Date,
      trainingDataEnd: Date,
      dataPointsUsed: Number,
      features: [String],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

forecastSchema.index({ userId: 1, isActive: 1, category: 1 });
forecastSchema.index({ userId: 1, generatedAt: -1 });

export const Forecast = mongoose.model<IForecast>('Forecast', forecastSchema);
