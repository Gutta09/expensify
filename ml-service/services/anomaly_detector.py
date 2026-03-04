"""
Anomaly Detection Service
Uses Isolation Forest to detect unusual spending transactions.
Trained per-user on historical transaction features.
Falls back to statistical methods when model is unavailable.
"""

import os
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder, StandardScaler
from pymongo import MongoClient
from bson import ObjectId

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')

CATEGORIES = [
    'Housing', 'Transportation', 'Food & Dining', 'Groceries',
    'Utilities', 'Healthcare', 'Insurance', 'Entertainment',
    'Shopping', 'Personal Care', 'Education', 'Travel',
    'Subscriptions', 'Investments', 'Gifts & Donations',
    'Business Expenses', 'Taxes', 'Miscellaneous'
]


class AnomalyDetector:
    def __init__(self):
        os.makedirs(MODEL_DIR, exist_ok=True)
        self.db = self._get_db()
        self.label_encoder = LabelEncoder()
        self.label_encoder.fit(CATEGORIES)
        self.user_models = {}  # Cache loaded models

    def _get_db(self):
        try:
            mongo_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/expenseiq')
            client = MongoClient(mongo_uri)
            return client.get_database()
        except Exception:
            return None

    def check(
        self,
        user_id: str,
        amount: float,
        category: str,
        merchant: str,
        date: Optional[str] = None
    ) -> dict:
        """
        Check if a transaction is anomalous.

        Features used:
        - amount (log-transformed)
        - category (encoded)
        - day of week
        - hour of day
        - day of month (payday patterns)
        - is_weekend
        """
        # Try ML-based detection
        model_result = self._ml_detect(user_id, amount, category, date)
        if model_result:
            return model_result

        # Fallback to statistical detection
        return self._statistical_detect(user_id, amount, category)

    def _extract_features(self, amount: float, category: str, date_str: Optional[str]) -> np.ndarray:
        """Extract numerical features from transaction"""
        # Amount features
        log_amount = np.log1p(abs(amount))

        # Category encoding
        try:
            cat_encoded = self.label_encoder.transform([category])[0]
        except ValueError:
            cat_encoded = len(CATEGORIES) - 1  # Map unknown to Miscellaneous

        # Time features
        if date_str:
            try:
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                dt = datetime.now()
        else:
            dt = datetime.now()

        day_of_week = dt.weekday()
        hour = dt.hour
        day_of_month = dt.day
        is_weekend = 1 if day_of_week >= 5 else 0

        # Payday indicator (around 1st and 15th)
        is_near_payday = 1 if day_of_month <= 3 or (14 <= day_of_month <= 17) else 0

        return np.array([[
            log_amount,
            cat_encoded,
            day_of_week,
            hour,
            day_of_month,
            is_weekend,
            is_near_payday,
            amount  # raw amount for score calibration
        ]])

    def _ml_detect(self, user_id: str, amount: float, category: str, date_str: Optional[str]) -> Optional[dict]:
        """Use Isolation Forest model for anomaly detection"""
        model_path = os.path.join(MODEL_DIR, f'anomaly_{user_id}.joblib')

        # Load or retrieve cached model
        if user_id not in self.user_models:
            if os.path.exists(model_path):
                self.user_models[user_id] = joblib.load(model_path)
            else:
                return None  # No model available

        model_data = self.user_models[user_id]
        model = model_data['model']
        scaler = model_data['scaler']

        features = self._extract_features(amount, category, date_str)
        feature_subset = features[:, :7]  # Exclude raw amount

        try:
            scaled = scaler.transform(feature_subset)
            score = model.decision_function(scaled)[0]
            prediction = model.predict(scaled)[0]

            # Convert score to 0-1 range (lower decision function = more anomalous)
            # Isolation Forest: -1 = anomaly, 1 = normal
            anomaly_score = max(0, min(1, 0.5 - score))

            is_anomaly = prediction == -1
            reason = self._generate_reason(amount, category, anomaly_score, user_id)

            return {
                'score': round(float(anomaly_score), 3),
                'isAnomaly': bool(is_anomaly),
                'reason': reason
            }
        except Exception as e:
            print(f"ML anomaly detection error: {e}")
            return None

    def _statistical_detect(self, user_id: str, amount: float, category: str) -> dict:
        """Statistical fallback anomaly detection"""
        if not self.db:
            return {'score': 0, 'isAnomaly': False, 'reason': 'Detection unavailable'}

        # Get historical stats for this user+category
        stats = list(self.db.transactions.aggregate([
            {
                '$match': {
                    'userId': ObjectId(user_id),
                    'category': category,
                    'type': 'expense'
                }
            },
            {
                '$group': {
                    '_id': None,
                    'mean': {'$avg': '$amount'},
                    'std': {'$stdDevPop': '$amount'},
                    'max': {'$max': '$amount'},
                    'count': {'$sum': 1}
                }
            }
        ]))

        if not stats or stats[0]['count'] < 5:
            return {'score': 0, 'isAnomaly': False, 'reason': 'Insufficient history for detection'}

        mean = stats[0]['mean']
        std = stats[0].get('std', 0) or 1
        max_val = stats[0]['max']

        # Z-score based detection
        z_score = abs(amount - mean) / std if std > 0 else 0

        reasons = []
        score = 0

        if z_score > 3:
            score += 0.5
            reasons.append(f'Amount is {z_score:.1f} standard deviations from average ${mean:.2f}')
        elif z_score > 2:
            score += 0.3
            reasons.append(f'Amount is {z_score:.1f}σ above average ${mean:.2f} for {category}')

        if amount > max_val:
            score += 0.25
            reasons.append(f'New record high for {category} (prev max: ${max_val:.2f})')

        if amount > mean * 3:
            score += 0.25
            reasons.append(f'Transaction is {amount/mean:.1f}x your average {category} spend')

        score = min(1.0, score)
        is_anomaly = score >= 0.5

        return {
            'score': round(score, 3),
            'isAnomaly': is_anomaly,
            'reason': '; '.join(reasons) if reasons else 'Within normal range'
        }

    def _generate_reason(self, amount: float, category: str, score: float, user_id: str) -> str:
        """Generate human-readable reason for anomaly"""
        if score < 0.3:
            return 'Within normal spending range'

        reasons = []
        if score >= 0.7:
            reasons.append(f'Highly unusual ${amount:.2f} transaction in {category}')
        elif score >= 0.5:
            reasons.append(f'Unusual spending of ${amount:.2f} in {category}')

        # Get category average for context
        if self.db:
            stats = list(self.db.transactions.aggregate([
                {'$match': {'userId': ObjectId(user_id), 'category': category, 'type': 'expense'}},
                {'$group': {'_id': None, 'avg': {'$avg': '$amount'}}}
            ]))
            if stats:
                avg = stats[0]['avg']
                if amount > avg * 2:
                    reasons.append(f'{amount/avg:.1f}x your average {category} transaction (${avg:.2f})')

        return '; '.join(reasons) if reasons else 'Flagged by anomaly model'

    def train_for_user(self, user_id: str):
        """Train an Isolation Forest model for a specific user"""
        if not self.db:
            return

        transactions = list(self.db.transactions.find(
            {'userId': ObjectId(user_id), 'type': 'expense'},
            {'amount': 1, 'category': 1, 'date': 1}
        ).sort('date', -1).limit(5000))

        if len(transactions) < 30:
            return  # Need minimum data

        # Extract features for all transactions
        features_list = []
        for tx in transactions:
            date_str = tx['date'].isoformat() if tx.get('date') else None
            feat = self._extract_features(
                tx.get('amount', 0),
                tx.get('category', 'Miscellaneous'),
                date_str
            )
            features_list.append(feat[0, :7])

        X = np.array(features_list)

        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Train Isolation Forest
        model = IsolationForest(
            n_estimators=200,
            max_samples='auto',
            contamination=0.05,  # Expect ~5% anomalies
            random_state=42,
            n_jobs=-1
        )
        model.fit(X_scaled)

        # Save model
        model_data = {'model': model, 'scaler': scaler}
        model_path = os.path.join(MODEL_DIR, f'anomaly_{user_id}.joblib')
        joblib.dump(model_data, model_path)

        # Update cache
        self.user_models[user_id] = model_data
