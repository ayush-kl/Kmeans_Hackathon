const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { inferLastLocations } = require("./utils/inferLastLocation");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.post("/api/upload", upload.single("file"), (req, res) => {
  const data = fs.readFileSync(req.file.path, "utf8");
  fs.unlinkSync(req.file.path);

  const logs = JSON.parse(data);
  const result = inferLastLocations(logs);

  res.json(result);
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
