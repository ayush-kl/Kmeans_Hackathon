const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { inferLastLocations } = require("./utils/inferLastLocation");

const app = express();

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:3004"], // React frontend URLs
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const upload = multer({ dest: "uploads/" });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "SBI Defaulter Location Tracker API",
    endpoints: {
      "POST /api/upload": "Upload JSON file to track defaulter locations",
      "GET /api/health": "Health check endpoint"
    }
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// File upload and processing endpoint
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const data = fs.readFileSync(req.file.path, "utf8");
    fs.unlinkSync(req.file.path); // Clean up uploaded file

    let logs;
    try {
      logs = JSON.parse(data);
    } catch (parseError) {
      return res.status(400).json({ error: "Invalid JSON format" });
    }

    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: "Data should be an array of log entries" });
    }

    const result = await inferLastLocations(logs);

    res.json({
      success: true,
      message: "File processed successfully",
      data: result,
      totalRecords: logs.length,
      defaultersFound: Object.keys(result).length
    });

  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({ 
    error: "Internal server error",
    message: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SBI Backend Server running at http://localhost:${PORT}`);
  console.log(`📊 Ready to process defaulter location data`);
});
