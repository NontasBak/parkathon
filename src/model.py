from db import fetch
from preprocessing import preprocess, add_features
from sklearn.ensemble import RandomForestClassifier
from datetime import datetime
import pandas as pd
import holidays

def train_model(spot_lon, spot_lat):
    df = fetch(spot_lon, spot_lat)
    df1, df2 = preprocess(df)
    df1 = add_features(df1)
    if df2 is not None:
        df2 = add_features(df2)
        df_combined = pd.concat([df1, df2])
    else:
        df_combined = df1

    X = df_combined[['isWeekend', 'isHoliday', 'season', 'year', 'day', 'hour', 'conditions', 'temperature']]
    y = df_combined['isFree']

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X, y)
    return model

def parkingChance(model, timestamp, weather):
    datetime_obj = datetime.strptime(timestamp, '%Y-%m-%dT%H:%M:%S')
    
    weather_parts = weather.split()
    if len(weather_parts) >= 2:
        conditions = weather_parts[0]
        temperature = weather_parts[1].strip('C')
    else:
        return jsonify({'error': 'Invalid weather format'}), 400
    
    try:
        conditions_encoded = model.classes_.tolist().index(conditions)
    except ValueError:
        conditions_encoded = -1  # If condition is unseen, assign -1
    
    try:
        temperature = float(temperature)
    except ValueError:
        return jsonify({'error': 'Invalid temperature format'}), 400

    input_df = pd.DataFrame([{
        'isWeekend':    datetime_obj.weekday() >= 5,
        'isHoliday':    datetime_obj.date() in holidays.GR(),
        'season':       datetime_obj.month % 12 // 3 + 1,
        'year':         datetime_obj.year,
        'day':          datetime_obj.weekday(),
        'hour':         datetime_obj.hour,
        'conditions':   conditions_encoded,
        'temperature':  temperature
    }])

    probability = model.predict_proba(input_df)[:, 1][0]
    return probability