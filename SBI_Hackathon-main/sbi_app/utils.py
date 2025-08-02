"""
Utility functions for SBI application
"""
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from datetime import datetime, timedelta
import json
import logging
from django.utils import timezone
import pytz

# Set up logging
logger = logging.getLogger(__name__)


def format_timestamp_ist(dt):
    """Convert datetime to IST and return ISO format string"""
    if not dt:
        return None
    
    # Convert to IST timezone
    ist_tz = pytz.timezone('Asia/Kolkata')
    if timezone.is_aware(dt):
        ist_time = dt.astimezone(ist_tz)
    else:
        # If naive, assume it's UTC and make it aware
        utc_time = pytz.utc.localize(dt)
        ist_time = utc_time.astimezone(ist_tz)
    
    return ist_time.isoformat()


def process_kalman_cluster_fusion(event_data):
    """
    Process event data using Kalman-Cluster Fusion algorithm
    Returns analysis results
    """
    try:
        if not event_data:
            return {'error': 'No data to process'}
            
        # Convert to DataFrame
        df = pd.DataFrame(event_data)
        
        if df.empty:
            return {'error': 'No data to process'}
        
        logger.info(f"Processing {len(df)} events for {len(df['user_id'].unique())} users")
        
        # Convert timestamp to datetime with timezone handling
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Make timezone-aware if needed
        if df['timestamp'].dt.tz is None:
            df['timestamp'] = df['timestamp'].dt.tz_localize('UTC')
        
        # Event weights (as per your specification)
        event_weights = {
            'upi': 1.0,
            'app_open': 0.8,
            'login': 0.6
        }
        
        # Step 1: Cluster raw positions using DBSCAN
        coordinates = df[['lat', 'lon']].values
        
        # Use eps=0.01 degrees (roughly 1.1 km) for clustering
        dbscan = DBSCAN(eps=0.01, min_samples=2)
        df['cluster'] = dbscan.fit_predict(coordinates)
        
        logger.info(f"Found {len(set(df['cluster'])) - (1 if -1 in df['cluster'].values else 0)} clusters")
        
        # Step 2: Process each user
        results = {}
        user_results = []
        
        for user_id in df['user_id'].unique():
            user_data = df[df['user_id'] == user_id].copy()
            user_result = process_user_data(user_data, event_weights)
            user_results.append(user_result)
            results[user_id] = user_result
        
        # Step 3: Generate summary statistics
        total_clusters = len(df['cluster'].unique()) - (1 if -1 in df['cluster'].values else 0)
        noise_points = len(df[df['cluster'] == -1])
        
        summary = {
            'total_users': len(df['user_id'].unique()),
            'total_events': len(df),
            'total_clusters': total_clusters,
            'noise_points': noise_points,
            'event_distribution': df['event_type'].value_counts().to_dict(),
            'cluster_distribution': df[df['cluster'] != -1]['cluster'].value_counts().to_dict() if total_clusters > 0 else {},
            'processing_timestamp': format_timestamp_ist(timezone.now()),
            'anomalies': detect_anomalies(df),
            'confidence': calculate_overall_confidence(user_results)
        }
        
        result = {
            'summary': summary,
            'user_results': user_results,
            'cluster_info': get_cluster_info(df),
            'location_predictions': generate_location_predictions(df, user_results),
            'algorithm_parameters': {
                'dbscan_eps': 0.01,
                'dbscan_min_samples': 2,
                'event_weights': event_weights,
                'time_decay_hours': 72,
                'night_boost_factor': 1.2
            }
        }
        
        logger.info("Processing completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"Processing failed: {str(e)}")
        return {'error': f'Processing failed: {str(e)}'}


def process_user_data(user_data, event_weights):
    """Process individual user data"""
    user_id = user_data['user_id'].iloc[0]
    
    # Calculate event weights with time decay
    current_time = timezone.now()
    weighted_events = []
    
    for _, event in user_data.iterrows():
        base_weight = event_weights.get(event['event_type'], 0.5)
        
        # Time decay (72 hours) - handle timezone properly
        event_time = event['timestamp']
        if event_time.tz is None:
            event_time = timezone.make_aware(event_time)
        
        time_diff = (current_time - event_time).total_seconds() / 3600  # hours
        time_decay = max(0, 1 - (time_diff / 72))
        
        # Night boost (assume 22:00 - 06:00 is night)
        event_hour = event_time.hour
        night_boost = 1.2 if (event_hour >= 22 or event_hour <= 6) else 1.0
        
        final_weight = base_weight * time_decay * night_boost
        weighted_events.append({
            'event_type': event['event_type'],
            'timestamp': event_time.isoformat(),
            'lat': event['lat'],
            'lon': event['lon'],
            'cluster': event['cluster'],
            'base_weight': base_weight,
            'time_decay': time_decay,
            'night_boost': night_boost,
            'final_weight': final_weight
        })
    
    # Calculate cluster-based predictions
    clusters = user_data[user_data['cluster'] != -1]
    
    if len(clusters) > 0:
        # Group by cluster and calculate weighted centroids
        cluster_predictions = []
        for cluster_id in clusters['cluster'].unique():
            cluster_events = clusters[clusters['cluster'] == cluster_id]
            
            # Calculate weighted centroid
            weights = [event_weights.get(row['event_type'], 0.5) for _, row in cluster_events.iterrows()]
            
            if weights:
                weighted_lat = np.average(cluster_events['lat'], weights=weights)
                weighted_lon = np.average(cluster_events['lon'], weights=weights)
                
                cluster_predictions.append({
                    'cluster_id': int(cluster_id),
                    'predicted_lat': float(weighted_lat),
                    'predicted_lon': float(weighted_lon),
                    'event_count': len(cluster_events),
                    'confidence': np.mean(weights)
                })
        
        # Primary prediction (highest confidence cluster)
        if cluster_predictions:
            primary_prediction = max(cluster_predictions, key=lambda x: x['confidence'])
        else:
            primary_prediction = None
    else:
        cluster_predictions = []
        primary_prediction = None
    
    return {
        'user_id': user_id,
        'total_events': len(user_data),
        'event_types': user_data['event_type'].value_counts().to_dict(),
        'clusters_involved': len(user_data['cluster'].unique()) - (1 if -1 in user_data['cluster'].values else 0),
        'weighted_events': weighted_events,
        'cluster_predictions': cluster_predictions,
        'primary_prediction': primary_prediction,
        'time_range': {
            'first_event': user_data['timestamp'].min().isoformat(),
            'last_event': user_data['timestamp'].max().isoformat()
        }
    }


def get_cluster_info(df):
    """Get detailed cluster information"""
    cluster_info = {}
    
    for cluster_id in df['cluster'].unique():
        if cluster_id == -1:  # Skip noise points
            continue
            
        cluster_data = df[df['cluster'] == cluster_id]
        
        cluster_info[f'cluster_{cluster_id}'] = {
            'cluster_id': int(cluster_id),
            'event_count': len(cluster_data),
            'user_count': len(cluster_data['user_id'].unique()),
            'event_types': cluster_data['event_type'].value_counts().to_dict(),
            'centroid': {
                'lat': float(cluster_data['lat'].mean()),
                'lon': float(cluster_data['lon'].mean())
            },
            'bounding_box': {
                'min_lat': float(cluster_data['lat'].min()),
                'max_lat': float(cluster_data['lat'].max()),
                'min_lon': float(cluster_data['lon'].min()),
                'max_lon': float(cluster_data['lon'].max())
            },
            'users': cluster_data['user_id'].unique().tolist()
        }
    
    return cluster_info


def detect_anomalies(df):
    """Detect anomalous patterns in the data"""
    anomalies = []
    
    # Check for users with many events but no clusters
    for user_id in df['user_id'].unique():
        user_data = df[df['user_id'] == user_id]
        user_clusters = user_data[user_data['cluster'] != -1]
        
        if len(user_data) >= 5 and len(user_clusters) == 0:
            anomalies.append({
                'type': 'no_clusters',
                'user_id': user_id,
                'event_count': len(user_data),
                'description': f'User {user_id} has {len(user_data)} events but no clusters'
            })
    
    # Check for clusters with mixed event types that seem unusual
    for cluster_id in df['cluster'].unique():
        if cluster_id == -1:
            continue
            
        cluster_data = df[df['cluster'] == cluster_id]
        event_types = cluster_data['event_type'].unique()
        
        # Unusual if UPI events are clustered with many other types
        if 'upi' in event_types and len(event_types) > 2:
            anomalies.append({
                'type': 'mixed_event_cluster',
                'cluster_id': int(cluster_id),
                'event_types': list(event_types),
                'description': f'Cluster {cluster_id} has unusual mix of event types'
            })
    
    return anomalies


def calculate_overall_confidence(user_results):
    """Calculate overall confidence score for the analysis"""
    if not user_results:
        return 0.0
    
    confidences = []
    for result in user_results:
        if result.get('primary_prediction'):
            confidences.append(result['primary_prediction']['confidence'])
        else:
            confidences.append(0.0)
    
    return float(np.mean(confidences)) if confidences else 0.0


def generate_location_predictions(df, user_results):
    """Generate location predictions for all users"""
    predictions = {}
    
    for result in user_results:
        user_id = result['user_id']
        if result.get('primary_prediction'):
            pred = result['primary_prediction']
            predictions[user_id] = {
                'predicted_lat': pred['predicted_lat'],
                'predicted_lon': pred['predicted_lon'],
                'confidence': pred['confidence'],
                'cluster_id': pred['cluster_id'],
                'event_count': pred['event_count'],
                'prediction_type': 'cluster_based',
                'timestamp': format_timestamp_ist(timezone.now())
            }
        else:
            # Fallback to simple average if no clusters
            user_data = df[df['user_id'] == user_id]
            if len(user_data) > 0:
                predictions[user_id] = {
                    'predicted_lat': float(user_data['lat'].mean()),
                    'predicted_lon': float(user_data['lon'].mean()),
                    'confidence': 0.3,  # Low confidence for non-clustered data
                    'cluster_id': None,
                    'event_count': len(user_data),
                    'prediction_type': 'simple_average',
                    'timestamp': format_timestamp_ist(timezone.now())
                }
    
    return predictions


def calculate_prediction_accuracy(events, prediction):
    """Calculate accuracy metrics for predictions"""
    # This is a placeholder for more sophisticated accuracy calculations
    # In a real scenario, you'd compare predictions with known outcomes
    
    if not prediction:
        return {'accuracy': 0, 'confidence': 0}
    
    # Simple distance-based accuracy
    distances = []
    for event in events:
        if event['lat'] and event['lon']:
            distance = np.sqrt(
                (event['lat'] - prediction['predicted_lat'])**2 + 
                (event['lon'] - prediction['predicted_lon'])**2
            )
            distances.append(distance)
    
    if distances:
        avg_distance = np.mean(distances)
        # Convert to approximate accuracy (closer = higher accuracy)
        accuracy = max(0, 1 - (avg_distance / 0.1))  # 0.1 degree threshold
        return {'accuracy': accuracy, 'avg_distance': avg_distance}
    
    return {'accuracy': 0, 'avg_distance': 0}


def get_user_prediction(user_id, processed_results):
    """Get processed location prediction for a specific user"""
    if not processed_results or 'location_predictions' not in processed_results:
        return None
    
    predictions = processed_results['location_predictions']
    return predictions.get(user_id, None)
