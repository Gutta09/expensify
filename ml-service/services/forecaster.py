"""
Spending Forecast Service
Uses Facebook Prophet for time-series forecasting of user spending.
Generates predictions with confidence intervals.
Supports both total and per-category forecasting.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from prophet import Prophet
from pymongo import MongoClient
from bson import ObjectId

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')


class ForecastService:
    def __init__(self):
        os.makedirs(MODEL_DIR, exist_ok=True)
        self.db = self._get_db()

    def _get_db(self):
        try:
            mongo_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/expenseiq')
            client = MongoClient(mongo_uri)
            return client.get_database()
        except Exception:
            return None

    def generate(self, user_id: str, horizon: int = 30, category: Optional[str] = None) -> dict:
        """
        Generate spending forecast for a user using Prophet.

        Args:
            user_id: MongoDB user ID
            horizon: Number of days to forecast
            category: Optional category filter (None = total spending)

        Returns:
            Forecast result with predictions and accuracy metrics
        """
        if not self.db:
            raise ValueError("Database connection not available")

        # Fetch historical transaction data
        match_query = {
            'userId': ObjectId(user_id),
            'type': 'expense',
        }
        if category:
            match_query['category'] = category

        pipeline = [
            {'$match': match_query},
            {
                '$group': {
                    '_id': {
                        '$dateToString': {'format': '%Y-%m-%d', 'date': '$date'}
                    },
                    'total': {'$sum': '$amount'},
                    'count': {'$sum': 1}
                }
            },
            {'$sort': {'_id': 1}}
        ]

        results = list(self.db.transactions.aggregate(pipeline))

        if len(results) < 30:
            raise ValueError(
                f"Insufficient data for forecasting. Need at least 30 days, got {len(results)}. "
                "Continue logging transactions to enable predictions."
            )

        # Prepare data for Prophet
        df = pd.DataFrame(results)
        df.columns = ['ds', 'y', 'count']
        df['ds'] = pd.to_datetime(df['ds'])

        # Fill missing days with 0 spending
        date_range = pd.date_range(start=df['ds'].min(), end=df['ds'].max(), freq='D')
        df = df.set_index('ds').reindex(date_range, fill_value=0).reset_index()
        df.columns = ['ds', 'y', 'count']

        # Train Prophet model
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10,
            interval_width=0.9,  # 90% confidence interval
        )

        # Add custom seasonality for monthly patterns (payday effects)
        model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5
        )

        model.fit(df[['ds', 'y']])

        # Generate forecast
        future = model.make_future_dataframe(periods=horizon)
        forecast = model.predict(future)

        # Extract future predictions only
        future_forecast = forecast[forecast['ds'] > df['ds'].max()]

        predictions = []
        for _, row in future_forecast.iterrows():
            predictions.append({
                'date': row['ds'].isoformat(),
                'predictedAmount': round(max(0, float(row['yhat'])), 2),
                'lowerBound': round(max(0, float(row['yhat_lower'])), 2),
                'upperBound': round(max(0, float(row['yhat_upper'])), 2),
            })

        # Calculate accuracy metrics using cross-validation on historical data
        accuracy = self._calculate_accuracy(df, model)

        # Get training metadata
        metadata = {
            'trainingDataStart': df['ds'].min().isoformat(),
            'trainingDataEnd': df['ds'].max().isoformat(),
            'dataPointsUsed': len(df),
            'features': ['daily_amount', 'weekly_seasonality', 'yearly_seasonality', 'monthly_pattern'],
        }

        return {
            'modelName': 'prophet',
            'modelVersion': 'v1.1.5',
            'predictions': predictions,
            'accuracy': accuracy,
            'metadata': metadata,
        }

    def _calculate_accuracy(self, df: pd.DataFrame, model: Prophet) -> dict:
        """Calculate forecast accuracy metrics on historical data"""
        try:
            # Use last 20% of data as test set
            split_idx = int(len(df) * 0.8)
            if split_idx < 30:
                return {'mape': 0, 'rmse': 0, 'r2Score': 0}

            train = df[:split_idx][['ds', 'y']]
            test = df[split_idx:][['ds', 'y']]

            test_model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
            )
            test_model.fit(train)

            future = test_model.make_future_dataframe(periods=len(test))
            pred = test_model.predict(future)

            # Merge predictions with actuals
            pred_values = pred[pred['ds'].isin(test['ds'])]['yhat'].values
            actual_values = test['y'].values

            if len(pred_values) == 0 or len(actual_values) == 0:
                return {'mape': 0, 'rmse': 0, 'r2Score': 0}

            min_len = min(len(pred_values), len(actual_values))
            pred_values = pred_values[:min_len]
            actual_values = actual_values[:min_len]

            # MAPE (Mean Absolute Percentage Error)
            nonzero_mask = actual_values != 0
            if nonzero_mask.any():
                mape = float(np.mean(np.abs(
                    (actual_values[nonzero_mask] - pred_values[nonzero_mask]) / actual_values[nonzero_mask]
                )) * 100)
            else:
                mape = 0

            # RMSE (Root Mean Squared Error)
            rmse = float(np.sqrt(np.mean((actual_values - pred_values) ** 2)))

            # R² Score
            ss_res = np.sum((actual_values - pred_values) ** 2)
            ss_tot = np.sum((actual_values - np.mean(actual_values)) ** 2)
            r2 = float(1 - (ss_res / ss_tot)) if ss_tot > 0 else 0

            return {
                'mape': round(mape, 2),
                'rmse': round(rmse, 2),
                'r2Score': round(max(0, r2), 4),
            }
        except Exception as e:
            print(f"Accuracy calculation error: {e}")
            return {'mape': 0, 'rmse': 0, 'r2Score': 0}
