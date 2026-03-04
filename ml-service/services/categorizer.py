"""
Transaction Categorization Service
Uses TF-IDF + Random Forest to classify transactions into spending categories
based on merchant name and transaction description.
Supports per-user feedback loop for incremental improvement.
"""

import os
import re
import numpy as np
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from pymongo import MongoClient

CATEGORIES = [
    'Housing', 'Transportation', 'Food & Dining', 'Groceries',
    'Utilities', 'Healthcare', 'Insurance', 'Entertainment',
    'Shopping', 'Personal Care', 'Education', 'Travel',
    'Subscriptions', 'Investments', 'Gifts & Donations',
    'Business Expenses', 'Taxes', 'Miscellaneous'
]

# Rule-based mapping for known merchants (high-confidence fallback)
MERCHANT_RULES = {
    'amazon': 'Shopping', 'walmart': 'Shopping', 'target': 'Shopping',
    'costco': 'Groceries', 'kroger': 'Groceries', 'safeway': 'Groceries',
    'whole foods': 'Groceries', 'trader joe': 'Groceries', 'aldi': 'Groceries',
    'uber': 'Transportation', 'lyft': 'Transportation', 'shell': 'Transportation',
    'chevron': 'Transportation', 'exxon': 'Transportation',
    'starbucks': 'Food & Dining', 'mcdonald': 'Food & Dining',
    'chipotle': 'Food & Dining', 'doordash': 'Food & Dining',
    'grubhub': 'Food & Dining', 'uber eats': 'Food & Dining',
    'netflix': 'Subscriptions', 'spotify': 'Subscriptions',
    'hulu': 'Subscriptions', 'disney': 'Subscriptions',
    'apple music': 'Subscriptions', 'youtube': 'Subscriptions',
    'comcast': 'Utilities', 'verizon': 'Utilities', 'at&t': 'Utilities',
    'electric': 'Utilities', 'water': 'Utilities',
    'cvs': 'Healthcare', 'walgreens': 'Healthcare',
    'planet fitness': 'Entertainment', 'gym': 'Entertainment',
    'airbnb': 'Travel', 'booking.com': 'Travel', 'expedia': 'Travel',
    'geico': 'Insurance', 'progressive': 'Insurance', 'state farm': 'Insurance',
    'udemy': 'Education', 'coursera': 'Education',
}

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')


class CategorizationService:
    def __init__(self):
        os.makedirs(MODEL_DIR, exist_ok=True)
        self.base_model = self._load_or_create_base_model()
        self.feedback_buffer = []  # Collects corrections for retraining
        self.db = self._get_db()

    def _get_db(self):
        try:
            mongo_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/expenseiq')
            client = MongoClient(mongo_uri)
            return client.get_database()
        except Exception:
            return None

    def _load_or_create_base_model(self):
        model_path = os.path.join(MODEL_DIR, 'categorizer_base.joblib')
        if os.path.exists(model_path):
            return joblib.load(model_path)

        # Create a base model with synthetic training data from merchant rules
        texts = []
        labels = []
        for merchant, category in MERCHANT_RULES.items():
            # Generate variations
            texts.extend([
                merchant,
                merchant.upper(),
                f'{merchant} purchase',
                f'{merchant} payment',
                f'POS {merchant}',
                f'{merchant} store',
            ])
            labels.extend([category] * 6)

        pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(
                analyzer='char_wb',
                ngram_range=(2, 5),
                max_features=5000,
                lowercase=True
            )),
            ('clf', RandomForestClassifier(
                n_estimators=100,
                max_depth=20,
                random_state=42,
                class_weight='balanced'
            ))
        ])

        pipeline.fit(texts, labels)
        joblib.dump(pipeline, model_path)
        return pipeline

    def predict(self, merchant: str, amount: float, description: str = '') -> dict:
        """Predict category for a transaction"""
        # Check rule-based first (high confidence)
        merchant_lower = merchant.lower().strip()
        for pattern, category in MERCHANT_RULES.items():
            if pattern in merchant_lower:
                return {
                    'category': category,
                    'confidence': 0.95,
                    'alternatives': self._get_alternatives(merchant, description, exclude=category)
                }

        # Use ML model
        text = f'{merchant} {description}'.strip()
        if not text:
            return {'category': 'Miscellaneous', 'confidence': 0.1, 'alternatives': []}

        try:
            probas = self.base_model.predict_proba([text])[0]
            classes = self.base_model.classes_
            top_indices = np.argsort(probas)[::-1][:3]

            primary = classes[top_indices[0]]
            confidence = float(probas[top_indices[0]])

            alternatives = [
                {'category': classes[idx], 'confidence': round(float(probas[idx]), 3)}
                for idx in top_indices[1:3]
                if probas[idx] > 0.1
            ]

            return {
                'category': primary,
                'confidence': round(confidence, 3),
                'alternatives': alternatives
            }
        except Exception:
            return {'category': 'Miscellaneous', 'confidence': 0.1, 'alternatives': []}

    def _get_alternatives(self, merchant: str, description: str, exclude: str) -> list:
        """Get alternative category predictions"""
        text = f'{merchant} {description}'.strip()
        try:
            probas = self.base_model.predict_proba([text])[0]
            classes = self.base_model.classes_
            results = sorted(
                zip(classes, probas), key=lambda x: x[1], reverse=True
            )
            return [
                {'category': cat, 'confidence': round(float(conf), 3)}
                for cat, conf in results[:3]
                if cat != exclude and conf > 0.05
            ]
        except Exception:
            return []

    def add_feedback(self, merchant: str, correct_category: str, user_id: str):
        """Store feedback for incremental model improvement"""
        self.feedback_buffer.append({
            'merchant': merchant,
            'category': correct_category,
            'user_id': user_id
        })

        # Retrain after collecting enough feedback
        if len(self.feedback_buffer) >= 20:
            self._incremental_retrain()

    def _incremental_retrain(self):
        """Retrain the model with accumulated feedback"""
        if not self.feedback_buffer:
            return

        texts = [f['merchant'] for f in self.feedback_buffer]
        labels = [f['category'] for f in self.feedback_buffer]

        # Expand with variations
        expanded_texts = []
        expanded_labels = []
        for text, label in zip(texts, labels):
            expanded_texts.extend([text, text.lower(), f'{text} payment'])
            expanded_labels.extend([label] * 3)

        try:
            # Partial fit is not available for Pipeline, so retrain with feedback data
            # In production, merge with original training data
            self.base_model.fit(expanded_texts, expanded_labels)
            model_path = os.path.join(MODEL_DIR, 'categorizer_base.joblib')
            joblib.dump(self.base_model, model_path)
            self.feedback_buffer = []
        except Exception as e:
            print(f'Incremental retrain failed: {e}')

    def retrain_for_user(self, user_id: str):
        """Full retrain using user's transaction history"""
        if not self.db:
            return

        from bson import ObjectId
        transactions = list(self.db.transactions.find(
            {'userId': ObjectId(user_id), 'category': {'$ne': 'Miscellaneous'}},
            {'merchant': 1, 'description': 1, 'category': 1}
        ).limit(5000))

        if len(transactions) < 20:
            return  # Not enough data

        texts = [f"{t.get('merchant', '')} {t.get('description', '')}".strip() for t in transactions]
        labels = [t['category'] for t in transactions]

        user_model = Pipeline([
            ('tfidf', TfidfVectorizer(
                analyzer='char_wb', ngram_range=(2, 5),
                max_features=5000, lowercase=True
            )),
            ('clf', RandomForestClassifier(
                n_estimators=100, max_depth=20,
                random_state=42, class_weight='balanced'
            ))
        ])

        user_model.fit(texts, labels)
        model_path = os.path.join(MODEL_DIR, f'categorizer_{user_id}.joblib')
        joblib.dump(user_model, model_path)
