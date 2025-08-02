
// Combined Complex Backend for Defaulter Last Location Inference (Single 500+ Line File)
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });

// Utility Constants
const MAX_JUMP_KM = 200;
const MIN_SESSION_GAP_MINUTES = 30;
const NIGHT_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
const SIMULATION_RUNS = 100;
const SESSION_GAP_MIN = 30;
const MIN_SESSION_LENGTH = 2;
const MIN_TOTAL_DURATION = 60;

// Time Utility Functions
function minutesDiff(a, b) {
  return Math.abs((new Date(b) - new Date(a)) / 60000);
}

function isNightTime(ts) {
  const hour = new Date(ts).getHours();
  return NIGHT_HOURS.includes(hour);
}

// Session Builder
function buildSessions(logs) {
  const sessions = [];
  let current = [];

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    if (current.length === 0) {
      current.push(log);
    } else {
      const last = current[current.length - 1];
      const gap = minutesDiff(last.timestamp, log.timestamp);

      if (gap > SESSION_GAP_MIN) {
        if (isValidSession(current)) {
          sessions.push(current);
        }
        current = [log];
      } else {
        current.push(log);
      }
    }
  }

  if (isValidSession(current)) {
    sessions.push(current);
  }

  return sessions;
}

function isValidSession(session) {
  if (session.length < MIN_SESSION_LENGTH) return false;
  const start = new Date(session[0].timestamp);
  const end = new Date(session[session.length - 1].timestamp);
  const duration = (end - start) / 1000;
  return duration >= MIN_TOTAL_DURATION;
}

// Transition Graph Builder
function buildGraph(logs) {
  const graph = {};
  for (let i = 0; i < logs.length - 1; i++) {
    const from = logs[i].tower_id;
    const to = logs[i + 1].tower_id;

    if (!graph[from]) graph[from] = {};
    if (!graph[from][to]) graph[from][to] = 0;
    graph[from][to] += 1;

    if (!graph[to]) graph[to] = {};
    if (!graph[to][from]) graph[to][from] = 0;
    graph[to][from] += 1; // Bidirectional
  }
  return graph;
}

// Movement Simulator
function simulateMovement(graph, startTower) {
  const simulations = [];
  for (let i = 0; i < SIMULATION_RUNS; i++) {
    let curr = startTower;
    for (let j = 0; j < 5; j++) {
      const neighbors = graph[curr];
      if (!neighbors) break;

      const rand = Math.random();
      let sum = 0;
      for (const [next, weight] of Object.entries(neighbors)) {
        const total = Object.values(neighbors).reduce((a, b) => a + b, 0);
        sum += weight / total;
        if (rand <= sum) {
          curr = next;
          break;
        }
      }
    }
    simulations.push(curr);
  }

  const freq = {};
  for (const t of simulations) freq[t] = (freq[t] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return {
    mostLikely: sorted[0][0],
    simulationStats: sorted.map(([tower, count]) => ({ tower, count }))
  };
}

// Location Scoring Logic
function scoreTowers(sessions) {
  const towerStats = {};
  const visitedPairs = new Set();
  const now = new Date(sessions.flat().at(-1).timestamp);

  for (const session of sessions) {
    for (let i = 0; i < session.length - 1; i++) {
      const a = session[i];
      const b = session[i + 1];
      const t1 = a.tower_id;
      const t2 = b.tower_id;
      visitedPairs.add(`${t1}->${t2}`);

      const duration = (new Date(b.timestamp) - new Date(a.timestamp)) / 1000;
      if (!towerStats[t1]) {
        towerStats[t1] = {
          totalDuration: 0,
          count: 0,
          nightCount: 0,
          merchantHits: 0,
          lastSeen: new Date(a.timestamp),
        };
      }

      towerStats[t1].totalDuration += duration;
      towerStats[t1].count += 1;
      if (isNightTime(a.timestamp)) towerStats[t1].nightCount += 1;
      if (a.merchant) towerStats[t1].merchantHits += 1;
      towerStats[t1].lastSeen = new Date(a.timestamp);
    }
  }

  const scored = Object.entries(towerStats).map(([tower_id, stat]) => {
    const recency = (now - stat.lastSeen) / 1000;
    const score =
      0.3 * Math.log(stat.totalDuration + 1) +
      0.2 * stat.count +
      0.15 * Math.exp(-recency / 3600) +
      0.15 * stat.nightCount +
      0.2 * stat.merchantHits;
    return { tower_id, score, ...stat };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    bestTower: scored[0]?.tower_id,
    bestScore: scored[0]?.score,
    details: scored,
    visited: Array.from(visitedPairs)
  };
}

// Upload Route
app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    const logs = JSON.parse(fs.readFileSync(req.file.path, "utf8"));
    fs.unlinkSync(req.file.path);

    const byDevice = {};
    logs.forEach((rec) => {
      if (!byDevice[rec.device_id]) byDevice[rec.device_id] = [];
      byDevice[rec.device_id].push(rec);
    });

    const result = {};
    for (const d in byDevice) {
      const logs = byDevice[d]
        .filter((r) => r.is_defaulter)
        .map((r) => ({
          tower_id: r.tower_id,
          timestamp: r.timestamp,
          merchant: r.merchant || false
        }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (logs.length === 0) continue;

      const sessions = buildSessions(logs);
      const scores = scoreTowers(sessions);
      const graph = buildGraph(logs);
      const sim = simulateMovement(graph, logs[logs.length - 1].tower_id);

      result[d] = {
        lastKnownTower: scores.bestTower,
        confidenceScore: scores.bestScore,
        sessionCount: sessions.length,
        scoredTowers: scores.details,
        transitionGraph: graph,
        simulatedLikelyTower: sim.mostLikely,
        simulationStats: sim.simulationStats,
      };
    }

    return res.json(result);
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));
