"""
Model Manager
Coordinates training and lifecycle of all ML models per user.
Handles retraining triggers, versioning, and status reporting.
"""

import os
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

from services.categorizer import CategorizationService
from services.forecaster import ForecastService
from services.anomaly_detector import AnomalyDetector

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')


class ModelManager:
    def __init__(self):
        self.categorizer = CategorizationService()
        self.forecaster = ForecastService()
        self.anomaly_detector = AnomalyDetector()
        self.db = self._get_db()

    def _get_db(self):
        try:
            mongo_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/expenseiq')
            client = MongoClient(mongo_uri)
            return client.get_database()
        except Exception:
            return None

    def retrain_user(self, user_id: str) -> dict:
        """
        Full model retraining pipeline for a specific user.
        Retrains categorizer, forecaster, and anomaly detector.
        """
        results = {
            'userId': user_id,
            'timestamp': datetime.utcnow().isoformat(),
            'models': {},
            'status': 'success',
            'version': f'v{datetime.utcnow().strftime("%Y%m%d%H%M")}'
        }

        # 1. Retrain categorizer
        try:
            self.categorizer.retrain_for_user(user_id)
            results['models']['categorizer'] = 'trained'
        except Exception as e:
            results['models']['categorizer'] = f'failed: {str(e)}'

        # 2. Retrain anomaly detector
        try:
            self.anomaly_detector.train_for_user(user_id)
            results['models']['anomaly_detector'] = 'trained'
        except Exception as e:
            results['models']['anomaly_detector'] = f'failed: {str(e)}'

        # 3. Generate fresh forecast
        try:
            forecast = self.forecaster.generate(user_id, horizon=30)
            results['models']['forecaster'] = 'generated'
            results['forecast_accuracy'] = forecast.get('accuracy', {})
        except Exception as e:
            results['models']['forecaster'] = f'failed: {str(e)}'

        # Update user's ML profile in MongoDB
        if self.db:
            try:
                self.db.users.update_one(
                    {'_id': ObjectId(user_id)},
                    {
                        '$set': {
                            'mlProfile.modelVersion': results['version'],
                            'mlProfile.lastTrained': datetime.utcnow(),
                        }
                    }
                )
            except Exception:
                pass

        # Check if any model failed
        if any('failed' in str(v) for v in results['models'].values()):
            results['status'] = 'partial'

        return results

    def get_status(self) -> dict:
        """Get status of loaded models"""
        model_files = []
        if os.path.exists(MODEL_DIR):
            model_files = os.listdir(MODEL_DIR)

        return {
            'base_categorizer': 'categorizer_base.joblib' in model_files,
            'user_models': len([f for f in model_files if f.startswith('anomaly_')]),
            'total_model_files': len(model_files),
            'model_directory': MODEL_DIR,
        }
