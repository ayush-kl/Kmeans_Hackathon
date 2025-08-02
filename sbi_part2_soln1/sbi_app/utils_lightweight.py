"""
Lightweight clustering and math utilities - Pure Python implementation
Replaces numpy and scikit-learn dependencies
"""
import math
from datetime import datetime, timedelta
import json
import logging
from django.utils import timezone
from zoneinfo import ZoneInfo

# Set up logging
logger = logging.getLogger(__name__)


class SimpleMath:
    """Simple math operations to replace numpy"""
    
    @staticmethod
    def mean(values):
        """Calculate mean of a list of values"""
        if not values:
            return 0.0
        return sum(values) / len(values)
    
    @staticmethod
    def average(values, weights=None):
        """Calculate weighted average"""
        if not values:
            return 0.0
        if weights is None:
            return SimpleMath.mean(values)
        
        if len(values) != len(weights):
            raise ValueError("Values and weights must have same length")
        
        weighted_sum = sum(v * w for v, w in zip(values, weights))
        weight_sum = sum(weights)
        
        return weighted_sum / weight_sum if weight_sum != 0 else 0.0
    
    @staticmethod
    def distance(point1, point2):
        """Calculate Euclidean distance between two points"""
        return math.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2)


class SimpleDBSCAN:
    """Lightweight DBSCAN clustering implementation"""
    
    def __init__(self, eps=0.01, min_samples=2):
        self.eps = eps
        self.min_samples = min_samples
    
    def fit_predict(self, points):
        """Perform DBSCAN clustering"""
        n_points = len(points)
        labels = [-1] * n_points  # -1 means noise
        cluster_id = 0
        visited = [False] * n_points
        
        for i in range(n_points):
            if visited[i]:
                continue
                
            visited[i] = True
            neighbors = self._get_neighbors(points, i)
            
            if len(neighbors) < self.min_samples:
                # Point is noise
                continue
            
            # Start new cluster
            labels[i] = cluster_id
            seed_set = neighbors[:]
            
            j = 0
            while j < len(seed_set):
                neighbor_idx = seed_set[j]
                
                if not visited[neighbor_idx]:
                    visited[neighbor_idx] = True
                    new_neighbors = self._get_neighbors(points, neighbor_idx)
                    
                    if len(new_neighbors) >= self.min_samples:
                        seed_set.extend(new_neighbors)
                
                if labels[neighbor_idx] == -1:
                    labels[neighbor_idx] = cluster_id
                
                j += 1
            
            cluster_id += 1
        
        return labels
    
    def _get_neighbors(self, points, point_idx):
        """Get neighbors within eps distance"""
        neighbors = []
        current_point = points[point_idx]
        
        for i, point in enumerate(points):
            if i != point_idx and SimpleMath.distance(current_point, point) <= self.eps:
                neighbors.append(i)
        
        return neighbors


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder for any remaining special types"""
    def default(self, obj):
        if isinstance(obj, (int, float, bool, str, type(None))):
            return obj
        elif hasattr(obj, 'tolist'):
            return obj.tolist()
        elif hasattr(obj, '__dict__'):
            return obj.__dict__
        return str(obj)


def convert_types(obj):
    """Convert any special types to basic Python types"""
    if isinstance(obj, dict):
        return {k: convert_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_types(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_types(item) for item in obj)
    elif isinstance(obj, (int, float, bool, str, type(None))):
        return obj
    else:
        return str(obj)


def format_timestamp_ist(dt):
    """Convert datetime to IST and return ISO format string"""
    if not dt:
        return None
    
    # Convert to IST timezone using zoneinfo (built into Python 3.9+)
    ist_tz = ZoneInfo('Asia/Kolkata')
    if timezone.is_aware(dt):
        ist_time = dt.astimezone(ist_tz)
    else:
        # If naive, assume it's UTC and make it aware
        utc_time = dt.replace(tzinfo=ZoneInfo('UTC'))
        ist_time = utc_time.astimezone(ist_tz)
    
    return ist_time.isoformat()


def parse_datetime(dt_string):
    """Parse datetime string to datetime object"""
    if isinstance(dt_string, str):
        try:
            return datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        except ValueError:
            return timezone.make_aware(datetime.strptime(dt_string, '%Y-%m-%d %H:%M:%S'))
    return dt_string


def process_kalman_cluster_fusion(event_data):
    """
    Process event data using simplified clustering algorithm
    Returns analysis results
    """
    try:
        if not event_data:
            return {'error': 'No data to process'}
        
        logger.info(f"Processing {len(event_data)} events")
        
        # Convert timestamp strings to datetime objects
        for event in event_data:
            event['timestamp'] = parse_datetime(event['timestamp'])
            if event['timestamp'].tzinfo is None:
                event['timestamp'] = timezone.make_aware(event['timestamp'])
        
        # Event weights (as per your specification)
        event_weights = {
            'upi': 1.0,
            'app_open': 0.8,
            'login': 0.6
        }
        
        # Step 1: Cluster raw positions using SimpleDBSCAN
        coordinates = [[event['lat'], event['lon']] for event in event_data]
        
        # Use eps=0.01 degrees (roughly 1.1 km) for clustering
        dbscan = SimpleDBSCAN(eps=0.01, min_samples=2)
        clusters = dbscan.fit_predict(coordinates)
        
        # Add cluster info to events
        for i, event in enumerate(event_data):
            event['cluster'] = int(clusters[i])
        
        unique_clusters = set(clusters)
        logger.info(f"Found {len(unique_clusters) - (1 if -1 in unique_clusters else 0)} clusters")
        
        # Step 2: Process each user
        user_events = {}
        for event in event_data:
            user_id = event['user_id']
            if user_id not in user_events:
                user_events[user_id] = []
            user_events[user_id].append(event)
        
        user_results = []
        for user_id, events in user_events.items():
            user_result = process_user_data(events, event_weights)
            user_results.append(user_result)
        
        # Step 3: Generate summary statistics
        total_clusters = len(unique_clusters) - (1 if -1 in unique_clusters else 0)
        noise_points = sum(1 for c in clusters if c == -1)
        
        # Event type distribution
        event_types = {}
        for event in event_data:
            event_type = event['event_type']
            event_types[event_type] = event_types.get(event_type, 0) + 1
        
        # Cluster distribution
        cluster_dist = {}
        for c in clusters:
            if c != -1:
                cluster_key = int(c)
                cluster_dist[cluster_key] = cluster_dist.get(cluster_key, 0) + 1
        
        summary = {
            'total_users': len(user_events),
            'total_events': len(event_data),
            'total_clusters': total_clusters,
            'noise_points': noise_points,
            'event_distribution': event_types,
            'cluster_distribution': cluster_dist,
            'processing_timestamp': format_timestamp_ist(timezone.now()),
            'anomalies': detect_anomalies(event_data),
            'confidence': calculate_overall_confidence(user_results)
        }
        
        result = {
            'summary': summary,
            'user_results': user_results,
            'cluster_info': get_cluster_info(event_data),
            'location_predictions': generate_location_predictions(event_data, user_results),
            'algorithm_parameters': {
                'dbscan_eps': 0.01,
                'dbscan_min_samples': 2,
                'event_weights': event_weights,
                'time_decay_hours': 72,
                'night_boost_factor': 1.2
            }
        }
        
        logger.info("Processing completed successfully")
        # Convert any remaining special types
        return convert_types(result)
        
    except Exception as e:
        logger.error(f"Processing failed: {str(e)}")
        return {'error': f'Processing failed: {str(e)}'}


def process_user_data(user_events, event_weights):
    """Process individual user data"""
    if not user_events:
        return None
        
    user_id = user_events[0]['user_id']
    
    # Calculate event weights with time decay
    current_time = timezone.now()
    weighted_events = []
    
    for event in user_events:
        base_weight = event_weights.get(event['event_type'], 0.5)
        
        # Time decay (72 hours) - handle timezone properly
        event_time = event['timestamp']
        if event_time.tzinfo is None:
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
    clustered_events = [e for e in user_events if e['cluster'] != -1]
    
    if clustered_events:
        # Group by cluster and calculate weighted centroids
        cluster_groups = {}
        for event in clustered_events:
            cluster_id = event['cluster']
            if cluster_id not in cluster_groups:
                cluster_groups[cluster_id] = []
            cluster_groups[cluster_id].append(event)
        
        cluster_predictions = []
        for cluster_id, cluster_events in cluster_groups.items():
            # Calculate weighted centroid
            weights = [event_weights.get(event['event_type'], 0.5) for event in cluster_events]
            
            if weights:
                weighted_lat = SimpleMath.average([e['lat'] for e in cluster_events], weights)
                weighted_lon = SimpleMath.average([e['lon'] for e in cluster_events], weights)
                
                cluster_predictions.append({
                    'cluster_id': int(cluster_id),
                    'predicted_lat': float(weighted_lat),
                    'predicted_lon': float(weighted_lon),
                    'event_count': len(cluster_events),
                    'confidence': float(SimpleMath.mean(weights))
                })
        
        # Primary prediction (highest confidence cluster)
        if cluster_predictions:
            primary_prediction = max(cluster_predictions, key=lambda x: x['confidence'])
        else:
            primary_prediction = None
    else:
        cluster_predictions = []
        primary_prediction = None
    
    # Event type counts
    event_types = {}
    for event in user_events:
        event_type = event['event_type']
        event_types[event_type] = event_types.get(event_type, 0) + 1
    
    # Cluster involvement
    unique_clusters = set(e['cluster'] for e in user_events)
    clusters_involved = len(unique_clusters) - (1 if -1 in unique_clusters else 0)
    
    # Time range
    timestamps = [e['timestamp'] for e in user_events]
    first_event = min(timestamps).isoformat()
    last_event = max(timestamps).isoformat()
    
    result = {
        'user_id': user_id,
        'total_events': len(user_events),
        'event_types': event_types,
        'clusters_involved': clusters_involved,
        'weighted_events': weighted_events,
        'cluster_predictions': cluster_predictions,
        'primary_prediction': primary_prediction,
        'time_range': {
            'first_event': first_event,
            'last_event': last_event
        }
    }
    
    return convert_types(result)


def get_cluster_info(event_data):
    """Get detailed cluster information"""
    cluster_info = {}
    
    # Group events by cluster
    cluster_groups = {}
    for event in event_data:
        cluster_id = event['cluster']
        if cluster_id == -1:  # Skip noise points
            continue
        if cluster_id not in cluster_groups:
            cluster_groups[cluster_id] = []
        cluster_groups[cluster_id].append(event)
    
    for cluster_id, cluster_events in cluster_groups.items():
        # Event types in this cluster
        event_types = {}
        for event in cluster_events:
            event_type = event['event_type']
            event_types[event_type] = event_types.get(event_type, 0) + 1
        
        # Unique users in this cluster
        users = list(set(event['user_id'] for event in cluster_events))
        
        # Calculate centroid
        lats = [event['lat'] for event in cluster_events]
        lons = [event['lon'] for event in cluster_events]
        
        cluster_info[f'cluster_{cluster_id}'] = {
            'cluster_id': int(cluster_id),
            'event_count': len(cluster_events),
            'user_count': len(users),
            'event_types': event_types,
            'centroid': {
                'lat': float(SimpleMath.mean(lats)),
                'lon': float(SimpleMath.mean(lons))
            },
            'bounding_box': {
                'min_lat': float(min(lats)),
                'max_lat': float(max(lats)),
                'min_lon': float(min(lons)),
                'max_lon': float(max(lons))
            },
            'users': users
        }
    
    return convert_types(cluster_info)


def detect_anomalies(event_data):
    """Detect anomalous patterns in the data"""
    anomalies = []
    
    # Group events by user
    user_events = {}
    for event in event_data:
        user_id = event['user_id']
        if user_id not in user_events:
            user_events[user_id] = []
        user_events[user_id].append(event)
    
    # Check for users with many events but no clusters
    for user_id, events in user_events.items():
        clustered_events = [e for e in events if e['cluster'] != -1]
        
        if len(events) >= 5 and len(clustered_events) == 0:
            anomalies.append({
                'type': 'no_clusters',
                'user_id': user_id,
                'event_count': len(events),
                'description': f'User {user_id} has {len(events)} events but no clusters'
            })
    
    # Check for clusters with mixed event types that seem unusual
    cluster_groups = {}
    for event in event_data:
        cluster_id = event['cluster']
        if cluster_id == -1:
            continue
        if cluster_id not in cluster_groups:
            cluster_groups[cluster_id] = []
        cluster_groups[cluster_id].append(event)
    
    for cluster_id, cluster_events in cluster_groups.items():
        event_types = set(event['event_type'] for event in cluster_events)
        
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
        if result and result.get('primary_prediction'):
            confidences.append(result['primary_prediction']['confidence'])
        else:
            confidences.append(0.0)
    
    return float(SimpleMath.mean(confidences)) if confidences else 0.0


def generate_location_predictions(event_data, user_results):
    """Generate location predictions for all users"""
    predictions = {}
    
    # Group events by user for fallback calculations
    user_events = {}
    for event in event_data:
        user_id = event['user_id']
        if user_id not in user_events:
            user_events[user_id] = []
        user_events[user_id].append(event)
    
    for result in user_results:
        if not result:
            continue
            
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
            events = user_events.get(user_id, [])
            if events:
                lats = [event['lat'] for event in events]
                lons = [event['lon'] for event in events]
                predictions[user_id] = {
                    'predicted_lat': float(SimpleMath.mean(lats)),
                    'predicted_lon': float(SimpleMath.mean(lons)),
                    'confidence': 0.3,  # Low confidence for non-clustered data
                    'cluster_id': None,
                    'event_count': len(events),
                    'prediction_type': 'simple_average',
                    'timestamp': format_timestamp_ist(timezone.now())
                }
    
    return convert_types(predictions)


def calculate_prediction_accuracy(events, prediction):
    """Calculate accuracy metrics for predictions"""
    if not prediction:
        return {'accuracy': 0, 'confidence': 0}
    
    # Simple distance-based accuracy
    distances = []
    for event in events:
        if event['lat'] and event['lon']:
            distance = math.sqrt(
                (event['lat'] - prediction['predicted_lat'])**2 + 
                (event['lon'] - prediction['predicted_lon'])**2
            )
            distances.append(distance)
    
    if distances:
        avg_distance = float(SimpleMath.mean(distances))
        # Convert to approximate accuracy (closer = higher accuracy)
        accuracy = max(0, 1 - (avg_distance / 0.1))  # 0.1 degree threshold
        return convert_types({'accuracy': accuracy, 'avg_distance': avg_distance})
    
    return {'accuracy': 0, 'avg_distance': 0}


def get_user_prediction(user_id, processed_results):
    """Get processed location prediction for a specific user"""
    if not processed_results or 'location_predictions' not in processed_results:
        return None
    
    predictions = processed_results['location_predictions']
    return predictions.get(user_id, None)


# For backward compatibility, add these aliases
convert_numpy_types = convert_types
NumpyEncoder = NumpyEncoder
