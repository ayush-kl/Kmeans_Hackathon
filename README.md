# SBI Defaulter Location Inference System

A Django-based web application designed to predict the last known location of defaulters.

### 🎯 Solution Approach

- **Pure Python clustering** using custom DBSCAN implementation
- **Time-weighted prediction** with decay functions and night-time boosts
- **Robust anomaly detection** for suspicious patterns
- **Ultra-lightweight architecture** optimized for deployment constraints

## 🚀 Key Features

### ✅ Core Functionality

- **Location Prediction**: Weighted clustering-based location inference
- **Temporal Analysis**: Time-decay weighting with 72-hour sliding window
- **Event Classification**: Different weights for login, UPI, and app events
- **Anomaly Detection**: Identifies suspicious user patterns and mixed clusters
- **Multi-user Support**: Batch processing for multiple defaulters

### ✅ Technical Highlights

- **Zero Heavy Dependencies**: No numpy, pandas, or scikit-learn
- **Custom DBSCAN**: Pure Python clustering algorithm
- **JSON Serializable**: All outputs compatible with web APIs
- **Memory Efficient**: <100MB RAM usage under normal load
- **Deployment Ready**: Optimized for PythonAnywhere free tier

## 📦 Tech Stack

### Backend

- **Framework**: Django 4.2.7 (Python 3.9+)
- **Database**: SQLite3 (swappable to PostgreSQL/MySQL)
- **Clustering**: Custom `SimpleDBSCAN` implementation
- **Math**: Pure Python `SimpleMath` utilities

### Frontend

- **UI Framework**: Bootstrap 5
- **Templates**: Django/Jinja2
- **JavaScript**: ES6+ with modern features
- **Responsive Design**: Mobile-first approach

### Deployment

- **Platform**: PythonAnywhere (free-tier optimized)
- **Size**: ~50MB total (95% smaller than heavy ML stack)
- **Dependencies**: Only Django and pytz

## 🏗️ Project Structure

```
sbi_project/
├── manage.py                    # Django management script
├── requirements.txt            # Minimal dependencies
├── DEPLOYMENT_GUIDE.md        # Deployment instructions
├── db.sqlite3                 # Local database
├── sbi_project/               # Main project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── sbi_app/                   # Main application
    ├── models.py              # Data models (User, Event, ProcessedData)
    ├── views.py               # Web views and API endpoints
    ├── utils_lightweight.py   # Core algorithms (DBSCAN, math)
    ├── forms.py               # User registration/login forms
    ├── urls.py                # URL routing
    ├── admin.py               # Django admin interface
    ├── templates/             # HTML templates
    │   └── sbi_app/
    │       ├── base.html
    │       ├── user_dashboard.html
    │       ├── authority_dashboard.html
    │       └── analysis_results.html
    └── management/commands/   # Custom Django commands
        └── clear_data.py
```

## 📊 Data Models

### User Model (`SBIUser`)

```python
{
    "aadhaar_number": "123456789012",    # Primary Key (12 digits)
    "username": "user123",
    "email": "user@example.com",
    "phone_number": "9876543210",
    "is_defaulter": true,                # Defaulter flag
    "is_authority": false,               # Authority user flag
    "created_at": "2024-01-01T00:00:00Z"
}
```

### Event Model (`UserEvent`)

```python
{
    "user_id": "123456789012",           # Foreign key to SBIUser
    "event_type": "login",               # "login", "upi", "app_open"
    "timestamp": "2024-06-01T10:30:00Z", # ISO 8601 format
    "latitude": 28.6139,                 # GPS coordinates
    "longitude": 77.2090,
    "location_accuracy": 50.0,           # GPS accuracy in meters
    "ip_address": "192.168.1.1"         # Optional IP tracking
}
```

## 🧮 Algorithm Details

### Core Processing Pipeline

1. **Data Extraction**

   ```python
   # Filter defaulter users and their events
   defaulters = SBIUser.objects.filter(is_defaulter=True)
   events = UserEvent.objects.filter(user__in=defaulters)
   ```

2. **Preprocessing**

   ```python
   # Remove invalid coordinates and parse timestamps
   valid_events = filter_valid_coordinates(events)
   timezone_aware_events = parse_timestamps(valid_events)
   ```

3. **Clustering (SimpleDBSCAN)**

   ```python
   # Custom DBSCAN with eps=0.01 degrees (~1.1km)
   dbscan = SimpleDBSCAN(eps=0.01, min_samples=2)
   clusters = dbscan.fit_predict(coordinates)
   ```

4. **Weight Calculation**

   ```python
   # Time decay over 72 hours
   time_decay = max(0, 1 - (hours_since_event / 72))

   # Night boost (22:00 - 06:00)
   night_boost = 1.2 if (22 <= hour <= 23 or 0 <= hour <= 6) else 1.0

   # Event type weights
   event_weights = {"upi": 1.0, "app_open": 0.8, "login": 0.6}

   # Final weight
   final_weight = base_weight * time_decay * night_boost
   ```

5. **Location Prediction**

   ```python
   # Weighted centroid calculation
   predicted_lat = sum(lat_i * weight_i) / sum(weights)
   predicted_lon = sum(lon_i * weight_i) / sum(weights)

   # Confidence score
   confidence = mean(weights_used)
   ```

### Mathematical Formulas

**Time Decay Function**:

```
time_decay = max(0, 1 - (Δt / 72h))
```

**Night Boost Function**:

```
night_boost = {
    1.2  if 22:00 ≤ hour ≤ 23:59 or 00:00 ≤ hour ≤ 06:00
    1.0  otherwise
}
```

**Weighted Centroid**:

```
lat_predicted = Σ(lat_i × w_i) / Σ(w_i)
lon_predicted = Σ(lon_i × w_i) / Σ(w_i)
```

**Confidence Score**:

```
confidence = (1/n) × Σ(w_i) where w_i are weights used
```

## 📥 Input/Output Formats

### Input Format

```json
[
  {
    "user_id": "564526277704",
    "is_defaulter": true,
    "event_type": "login",
    "timestamp": "2025-08-01T21:56:34.324513+00:00",
    "lat": 26.1893767,
    "lon": 91.6984557,
    "accuracy": 75.0
  }
]
```

### Output Format

```json
{
    "summary": {
        "total_users": 10,
        "total_events": 100,
        "total_clusters": 3,
        "noise_points": 5,
        "processing_timestamp": "2024-06-01T12:05:00+05:30",
        "confidence": 0.85
    },
    "location_predictions": {
        "564526277704": {
            "predicted_lat": 28.615,
            "predicted_lon": 77.235,
            "confidence": 0.85,
            "cluster_id": 1,
            "event_count": 3,
            "prediction_type": "cluster_based",
            "timestamp": "2024-06-01T12:05:00+05:30"
        }
    },
    "user_results": [...],
    "cluster_info": {...},
    "algorithm_parameters": {
        "dbscan_eps": 0.01,
        "dbscan_min_samples": 2,
        "event_weights": {"upi": 1.0, "app_open": 0.8, "login": 0.6},
        "time_decay_hours": 72,
        "night_boost_factor": 1.2
    }
}
```

## 🛠️ Installation & Setup

### Prerequisites

- Python 3.9 or higher
- Virtual environment (recommended)

### Local Development Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd sbi_project
   ```

2. **Create virtual environment**

   ```bash
   python -m venv venv

   # Windows
   venv\Scripts\activate

   # Linux/Mac
   source venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Database setup**

   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

5. **Run development server**

   ```bash
   python manage.py runserver
   ```

6. **Access the application**
   - User Interface: http://127.0.0.1:8000/
   - Admin Interface: http://127.0.0.1:8000/admin/

### PythonAnywhere Deployment

1. **Upload project files to PythonAnywhere**

2. **Create virtual environment**

   ```bash
   mkvirtualenv sbi_app --python=python3.9
   ```

3. **Install requirements**

   ```bash
   pip install -r requirements.txt
   ```

4. **Django setup**

   ```bash
   python manage.py migrate
   python manage.py collectstatic
   python manage.py createsuperuser
   ```

5. **Configure web app**
   - Source code: `/home/yourusername/sbi_project`
   - Virtual environment: `/home/yourusername/.virtualenvs/sbi_app`

## 🎮 Usage Guide

### For Regular Users

1. **Registration**

   - Navigate to registration page
   - Enter 12-digit Aadhaar number, email, phone
   - Create username and password

2. **Login & Event Generation**

   - Login with credentials
   - Use "Generate Login Event" or "Generate UPI Event" or "Generate App Open Event" buttons.

### For SBI Authorities

1. **Authority Login**
   - Use authority credentials
   - username: authority
   - password: test123
   - Access advanced dashboard

2. **Data Analysis**
   - Run clustering analysis
   - View comprehensive results

3. **Monitoring**
   - Track all defaulter activities
   - Export analysis results
   - Generate reports

### API Endpoints

- **POST** `/record-event/` - Record new user event (login, UPI, app_open)
- **GET** `/authority/download/` - Download all event data as JSON (Authority only)
- **GET** `/authority/process/` - Process data using clustering algorithm (Authority only)
- **GET** `/authority/analysis/<int:analysis_id>/` - View specific analysis results
- **GET** `/authority/analyses/` - View all processed analyses
- **GET** `/authority/find-user/` - Find specific user location
- **GET** `/authority/find-all/` - Find all defaulter locations
- **GET** `/authority/export/<str:user_aadhaar>/` - Export specific user data

## 🔍 Example Walkthrough

### Scenario: Track a Defaulter

1. **User Setup**

   ```python
   # Create defaulter user
   user = SBIUser.objects.create(
       aadhaar_number="123456789012",
       username="defaulter1",
       is_defaulter=True
   )
   ```

2. **Event Creation**

   ```python
   # Generate sample events
   events = [
       {"lat": 28.61, "lon": 77.23, "event_type": "login"},
       {"lat": 28.62, "lon": 77.24, "event_type": "upi"},
       {"lat": 28.615, "lon": 77.235, "event_type": "app_open"}
   ]
   ```

3. **Run Analysis**

   ```python
   from sbi_app.utils_lightweight import process_kalman_cluster_fusion
   results = process_kalman_cluster_fusion(events)
   ```

4. **Get Prediction**
   ```python
   prediction = results['location_predictions']['123456789012']
   # Output: {"predicted_lat": 28.615, "predicted_lon": 77.235, "confidence": 0.85}
   ```

## 🔧 Configuration Options

### Algorithm Parameters

```python
# In utils_lightweight.py
DBSCAN_EPS = 0.01          # Clustering radius (degrees)
DBSCAN_MIN_SAMPLES = 2     # Minimum points per cluster
TIME_DECAY_HOURS = 72      # Time decay window
NIGHT_BOOST_FACTOR = 1.2   # Night event boost

EVENT_WEIGHTS = {
    'upi': 1.0,
    'app_open': 0.8,
    'login': 0.6
}
```

### Django Settings

```python
# In settings.py
DEBUG = False                    # Production mode
ALLOWED_HOSTS = ['yourdomain.com']
TIME_ZONE = 'Asia/Kolkata'       # IST timezone
```

**Built with ❤️ for SBI Defaulter Location Inference Challenge**
