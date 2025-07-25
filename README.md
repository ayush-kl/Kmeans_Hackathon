# SBI Defaulter Location Tracker

A full-stack application to track the last known locations of defaulters based on mobile tower data using advanced COPI (Constraint-Optimized Path Inference) algorithm.

## 🏗️ Project Structure

```
SBI_Hackathon/
├── backend/                 # Node.js Express API
│   ├── server.js           # Main server file
│   ├── utils/              # Utility functions
│   │   └── inferLastLocation.js  # COPI algorithm implementation
│   ├── uploads/            # Temporary file uploads
│   └── package.json        # Backend dependencies
├── frontend/               # React.js Web App
│   ├── src/
│   │   ├── App.js          # Main React component
│   │   ├── App.css         # Enhanced styling
│   │   └── index.js        # React entry point
│   ├── public/             # Static assets
│   └── package.json        # Frontend dependencies
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm package manager

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend server:
   ```bash
   npm start
   ```

   The backend will run at `http://localhost:5000`

### Frontend Setup

1. Open a new terminal and navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the frontend development server:
   ```bash
   npm start
   ```

   The frontend will run at `http://localhost:3000`

## 📡 API Endpoints

### POST /api/upload
Upload and process JSON file containing mobile tower data.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: File with field name "file"

**Response:**
```json
{
  "success": true,
  "message": "File processed successfully",
  "data": {
    "DEV001": "TWR124",
    "DEV003": "TWR127",
    "DEV004": "TWR128"
  },
  "totalRecords": 6,
  "defaultersFound": 3
}
```

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T12:30:00.000Z"
}
```

## 📊 Data Format

The application supports two data formats depending on the desired algorithm:

### Advanced Format (COPI Algorithm)
```json
[
  {
    "device_id": "DEV001",
    "tower_id": "TWR123", 
    "timestamp": "2024-01-15T10:30:00Z",
    "lat": 28.6139,
    "lon": 77.2090,
    "is_defaulter": true
  }
]
```

### Basic Format (Simple Algorithm)
```json
[
  {
    "device_id": "DEV001",
    "tower_id": "TWR123", 
    "timestamp": "2024-01-15T10:30:00Z",
    "is_defaulter": true
  }
]
```

### Required Fields:
- `device_id`: Unique identifier for the mobile device
- `tower_id`: Identifier for the cell tower
- `timestamp`: ISO 8601 formatted timestamp
- `is_defaulter`: Boolean indicating if the device belongs to a defaulter

### Optional Fields (for COPI):
- `lat`: Latitude coordinate of the tower (enables advanced algorithm)
- `lon`: Longitude coordinate of the tower (enables advanced algorithm)

## 🧪 Testing

A sample data file (`sample_data.json`) is provided in the root directory for testing the application.

To test:
1. Start both backend and frontend servers
2. Open `http://localhost:3000` in your browser
3. Upload the `sample_data.json` file
4. View the results showing last known locations of defaulters

## 🔧 Features

- **File Upload**: Drag and drop or click to upload JSON files
- **Data Processing**: Automatically processes uploaded data to find defaulter locations
- **Results Display**: Clean, organized display of results in a table format
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Feedback**: Loading states and progress indicators

## 🛠️ Technology Stack

**Backend:**
- Node.js
- Express.js
- Multer (file upload handling)
- CORS enabled

**Frontend:**
- React.js
- Axios (HTTP client)
- CSS3 with modern styling
- Responsive design

## 📝 Algorithm

The application uses an advanced **COPI (Constraint-Optimized Path Inference)** algorithm with intelligent fallback:

### Advanced COPI Algorithm:
1. **Physical Constraints**: Validates movement speeds (max 120 km/h)
2. **Time Analysis**: Uses 30-minute time gap thresholds
3. **Graph Construction**: Builds time-layered tower graphs
4. **Weighted Edges**: Based on transition frequency and dwell time
5. **Dijkstra's Algorithm**: Finds optimal constrained paths
6. **Haversine Distance**: Accurate geographic distance calculations

### Fallback Simple Algorithm:
- Used when coordinate data is unavailable
- Filters defaulter records by device ID
- Returns the most recent tower location

### Data Requirements:
- **For COPI**: Requires `lat` and `lon` fields for tower coordinates
- **For Simple**: Only requires basic fields (`device_id`, `tower_id`, `timestamp`, `is_defaulter`)

The algorithm automatically detects available data and chooses the appropriate method.

## 🚨 Error Handling

The application handles various error scenarios:
- Invalid JSON format
- Missing required fields
- File upload errors
- Server connectivity issues
- Empty datasets

## 🔗 API Integration

The frontend automatically connects to the backend API running on `localhost:5000`. Ensure both servers are running for full functionality.

## 📄 License

This project is part of the SBI Hackathon and is intended for demonstration purposes.

## 👥 Team

Developed for SBI Hackathon - Defaulter Location Tracking System