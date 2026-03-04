"""
ExpenseIQ ML Microservice
Flask-based machine learning service providing:
- Transaction categorization
- Spending forecast (Prophet)
- Anomaly detection (Isolation Forest)
- Per-user incremental model training
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from services.categorizer import CategorizationService
from services.forecaster import ForecastService
from services.anomaly_detector import AnomalyDetector
from services.model_manager import ModelManager

load_dotenv(dotenv_path='../.env')

app = Flask(__name__)
CORS(app)

# Initialize services
categorizer = CategorizationService()
forecaster = ForecastService()
anomaly_detector = AnomalyDetector()
model_manager = ModelManager()


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'expenseiq-ml',
        'models_loaded': model_manager.get_status()
    })


@app.route('/api/categorize', methods=['POST'])
def categorize():
    """
    Predict transaction category from merchant name, amount, and description.
    Uses a trained classifier with merchant-name NLP features.
    """
    data = request.json
    merchant = data.get('merchant', '')
    amount = data.get('amount', 0)
    description = data.get('description', '')

    result = categorizer.predict(merchant, amount, description)
    return jsonify(result)


@app.route('/api/forecast', methods=['POST'])
def forecast():
    """
    Generate spending forecast using Facebook Prophet.
    Trained on user's historical transaction data.
    Returns predicted daily spending with confidence intervals.
    """
    data = request.json
    user_id = data.get('userId')
    horizon = data.get('horizon', 30)
    category = data.get('category')

    if not user_id:
        return jsonify({'error': 'userId is required'}), 400

    try:
        result = forecaster.generate(user_id, horizon, category)
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Forecast generation failed: {str(e)}'}), 500


@app.route('/api/detect-anomaly', methods=['POST'])
def detect_anomaly():
    """
    Detect anomalous transactions using Isolation Forest.
    Trained on user's historical patterns (amount, category, time features).
    """
    data = request.json
    user_id = data.get('userId')
    amount = data.get('amount', 0)
    category = data.get('category', '')
    merchant = data.get('merchant', '')
    date = data.get('date')

    if not user_id:
        return jsonify({'error': 'userId is required'}), 400

    result = anomaly_detector.check(user_id, amount, category, merchant, date)
    return jsonify(result)


@app.route('/api/feedback', methods=['POST'])
def feedback():
    """
    Accept categorization feedback for incremental model improvement.
    Stores corrected labels and triggers micro-retraining.
    """
    data = request.json
    merchant = data.get('merchant')
    correct_category = data.get('correctCategory')
    user_id = data.get('userId')

    categorizer.add_feedback(merchant, correct_category, user_id)
    return jsonify({'status': 'feedback_recorded'})


@app.route('/api/retrain', methods=['POST'])
def retrain():
    """
    Trigger full model retraining for a specific user.
    Retrains categorizer, forecaster, and anomaly detector
    with user's latest transaction data.
    """
    data = request.json
    user_id = data.get('userId')

    if not user_id:
        return jsonify({'error': 'userId is required'}), 400

    try:
        result = model_manager.retrain_user(user_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Retraining failed: {str(e)}'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('ML_SERVICE_PORT', 8000))
    debug = os.environ.get('NODE_ENV', 'development') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
