import React, { useState } from "react";
import axios from "axios";
import "./App.css";

export default function App() {
  const [file, setFile] = useState(null);
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setError(null);
    setOutput(null);
    setStats(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post("http://localhost:5000/api/upload", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setOutput(response.data.data);
        setStats({
          totalRecords: response.data.totalRecords,
          defaultersFound: response.data.defaultersFound
        });
      } else {
        setError("Failed to process file");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err.response?.data?.error || 
        err.response?.data?.message || 
        "Failed to upload file. Please check if the backend server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setOutput(null);
    setError(null);
    setStats(null);
    document.getElementById('file-input').value = '';
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>🏦 SBI Defaulter Location Tracker</h1>
        <p>Upload JSON data to track last known locations of defaulters</p>
      </div>

      <div className="upload-section">
        <form onSubmit={handleSubmit} className="upload-form">
          <div className="file-input-container">
            <label htmlFor="file-input" className="file-label">
              📁 Choose JSON File
            </label>
            <input
              id="file-input"
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="file-input"
            />
            {file && (
              <div className="file-info">
                <span className="file-name">📄 {file.name}</span>
                <span className="file-size">({(file.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}
          </div>

          <div className="button-group">
            <button 
              type="submit" 
              disabled={!file || loading}
              className="upload-btn"
            >
              {loading ? "🔄 Processing..." : "🚀 Upload & Process"}
            </button>
            {(file || output) && (
              <button 
                type="button" 
                onClick={resetForm}
                className="reset-btn"
              >
                🔄 Reset
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="error-message">
            <h3>❌ Error</h3>
            <p>{error}</p>
          </div>
        )}

        {stats && (
          <div className="stats-section">
            <h3>📊 Processing Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Records:</span>
                <span className="stat-value">{stats.totalRecords}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Defaulters Found:</span>
                <span className="stat-value">{stats.defaultersFound}</span>
              </div>
            </div>
          </div>
        )}

        {output && Object.keys(output).length > 0 && (
          <div className="results-section">
            <h3>📍 Last Known Locations</h3>
            <div className="results-table">
              <div className="table-header">
                <span>Device ID</span>
                <span>Last Tower</span>
                <span>Algorithm</span>
                <span>Details</span>
              </div>
              {Object.entries(output).map(([deviceId, result]) => (
                <div key={deviceId} className="table-row">
                  <span className="device-id">{deviceId}</span>
                  <span className="tower-id">
                    {result.finalTower || result.lastKnownTower || "N/A"}
                  </span>
                  <span className="algorithm">
                    {result.algorithm || 'COPI'}
                  </span>
                  <span className="details">
                    {result.path && (
                      <div>
                        <div>🛤️ Path: {result.path.join(' → ')}</div>
                        <div>⚡ Hops: {result.hops}</div>
                        <div>📊 Cost: {result.cost?.toFixed(6)}</div>
                        {result.timestamp && (
                          <div>🕒 Time: {new Date(result.timestamp).toLocaleString()}</div>
                        )}
                      </div>
                    )}
                    {result.error && (
                      <div className="error-text">❌ {result.error}</div>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {output && Object.keys(output).length === 0 && (
          <div className="no-results">
            <h3>ℹ️ No Defaulters Found</h3>
            <p>The uploaded file doesn't contain any defaulter records.</p>
          </div>
        )}
      </div>

      <div className="info-section">
        <h3>📋 Expected JSON Format</h3>
        <div className="format-info">
          <h4>🔬 Advanced COPI Algorithm</h4>
          <p>Include latitude and longitude for sophisticated path analysis:</p>
        </div>
        <pre className="json-example">
{`[
  {
    "device_id": "DEV001",
    "tower_id": "TWR123",
    "timestamp": "2024-01-15T10:30:00Z",
    "lat": 28.6139,
    "lon": 77.2090,
    "is_defaulter": true
  },
  ...
]`}
        </pre>
        <div className="format-info">
          <h4>📍 COPI Algorithm Features:</h4>
          <ul>
            <li>🚀 <strong>Speed Constraints:</strong> Validates realistic movement (max 120 km/h)</li>
            <li>⏱️ <strong>Time Analysis:</strong> 30-minute time gap threshold</li>
            <li>🔗 <strong>Path Reconstruction:</strong> Shows complete movement path</li>
            <li>📊 <strong>Weight Optimization:</strong> Based on transition frequency and dwell time</li>
            <li>🧮 <strong>Dijkstra's Algorithm:</strong> Finds optimal constrained path</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
