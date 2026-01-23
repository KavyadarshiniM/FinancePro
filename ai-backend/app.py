from flask import Flask, jsonify
from flask_cors import CORS
import requests
import pandas as pd
from sklearn.linear_model import LinearRegression
from datetime import datetime
import numpy as np

app = Flask(__name__)
CORS(app)

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "AI Prediction Server Running",
        "usage": "/predict/<user_id>"
    })

@app.route("/predict/<int:user_id>", methods=["GET"])
def predict(user_id):

    NODE_API_URL = f"http://localhost:5000/api/ai/expenses/{user_id}"

    try:
        response = requests.get(NODE_API_URL, timeout=5)

        if response.status_code != 200:
            return jsonify({
                "error": "Node API failed",
                "status": response.status_code
            }), 500

        if not response.text:
            return jsonify({"error": "Empty response from Node API"}), 500

        data = response.json()

        if not isinstance(data, list) or len(data) < 2:
            return jsonify({"error": "Not enough data for prediction. Need at least 2 months of expense history."}), 400

        df = pd.DataFrame(data)

        if "month" not in df.columns or "total" not in df.columns:
            return jsonify({
                "error": "Invalid data format from Node API",
                "received_columns": list(df.columns)
            }), 400

        # Sort by month to ensure correct order
        df = df.sort_values('month').reset_index(drop=True)
        
        # Remove any months with zero expenses (they skew the prediction)
        df = df[df['total'] > 0].reset_index(drop=True)
        
        if len(df) < 2:
            return jsonify({"error": "Not enough non-zero expense data for prediction"}), 400

        # FIXED: Use sequential indices instead of month numbers
        # This prevents the model from getting confused by repeating month numbers
        df['sequence'] = range(len(df))  # 0, 1, 2, 3, ... (sequential order)

        # IMPROVED PREDICTION LOGIC
        # Use weighted moving average with linear regression for trend
        
        # Method 1: Weighted Moving Average (gives more weight to recent months)
        if len(df) <= 3:
            # For small datasets, use simple average
            prediction = df['total'].mean()
        else:
            # Use last 3-6 months with exponential weighting
            recent_data = df.tail(min(6, len(df)))
            weights = np.exp(np.linspace(0, 1, len(recent_data)))  # Exponential weights
            weights = weights / weights.sum()  # Normalize
            weighted_avg = (recent_data['total'].values * weights).sum()
            
            # Method 2: Linear Regression for trend using SEQUENCE not month
            X = df['sequence'].values.reshape(-1, 1)  # FIXED: Use sequence
            y = df['total'].values
            
            model = LinearRegression()
            model.fit(X, y)
            
            # Predict next position in sequence
            next_sequence = len(df)  # FIXED: Next in sequence
            linear_prediction = model.predict([[next_sequence]])[0]
            
            # Combine both methods (60% weighted average, 40% linear regression)
            # Weighted average is more stable for financial data
            prediction = (weighted_avg * 0.6) + (linear_prediction * 0.4)
            
            # Cap the prediction to avoid extremes
            # Don't allow prediction to be more than 40% higher or lower than recent average
            recent_avg = df.tail(3)['total'].mean()
            max_prediction = recent_avg * 1.4
            min_prediction = recent_avg * 0.6
            prediction = max(min_prediction, min(max_prediction, prediction))
        
        # Get actual next month for display
        current_month = datetime.now().month
        next_month = current_month + 1 if current_month < 12 else 1
        
        # Ensure prediction is positive and reasonable
        prediction = max(100, prediction)  # Minimum ₹100 prediction
        
        # Add some intelligence: if user has consistent expenses, reflect that
        if len(df) >= 3:
            std_dev = df['total'].std()
            mean_expense = df['total'].mean()
            
            # If expenses are very consistent (low standard deviation), 
            # weight more towards the mean
            if std_dev / mean_expense < 0.25:  # Less than 25% variation
                prediction = (prediction * 0.5) + (mean_expense * 0.5)

        return jsonify({
            "user_id": user_id,
            "next_month": next_month,
            "predicted_expense": round(prediction, 2),
            "message": "Prediction successful",
            "confidence": "high" if len(df) >= 4 else "medium" if len(df) >= 3 else "low",
            "data_points_used": len(df)
        })

    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Cannot connect to Node server. Make sure server.js is running on port 5000"
        }), 500

    except Exception as e:
        return jsonify({
            "error": str(e),
            "type": "prediction_error"
        }), 500

if __name__ == "__main__":
    app.run(host='localhost', port=8000, debug=True)