const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const SIMULATION_RUNS = 100;
const DISTANCE_THRESHOLD_KM = 50;
const TIME_THRESHOLD_MIN = 5;
const MIN_SESSION_GAP_MINUTES = 30;
const NIGHT_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];

function haversine(a, b) {
  const R = 6371;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function minutesDiff(a, b) {
  return Math.abs((new Date(b) - new Date(a)) / 60000);
}

function isNightTime(ts) {
  const hour = new Date(ts).getHours();
  return NIGHT_HOURS.includes(hour);
}

function filterNoisyTowerLogs(logs, coords) {
  const clean = [];
  for (let i = 0; i < logs.length - 1; i++) {
    const a = logs[i], b = logs[i + 1];
    const dist = coords[a.tower_id] && coords[b.tower_id]
      ? haversine(coords[a.tower_id], coords[b.tower_id])
      : 0;
    const timeGap = minutesDiff(a.timestamp, b.timestamp);
    if (dist > DISTANCE_THRESHOLD_KM && timeGap < TIME_THRESHOLD_MIN) continue;
    clean.push(a);
  }
  clean.push(logs[logs.length - 1]);
  return clean;
}

function insertMerchantVirtualTowers(logs) {
  const enriched = [];
  for (let i = 0; i < logs.length - 1; i++) {
    enriched.push(logs[i]);
    const gapStart = new Date(logs[i].timestamp);
    const gapEnd = new Date(logs[i + 1].timestamp);

    const merchants = logs.filter(m =>
      m.merchant &&
      new Date(m.timestamp) > gapStart &&
      new Date(m.timestamp) < gapEnd
    );

    for (const m of merchants) {
      enriched.push({
        tower_id: `virtual_${m.lat}_${m.lon}`,
        timestamp: m.timestamp,
        lat: m.lat,
        lon: m.lon,
        virtual: true,
        merchant: true
      });
    }
  }
  enriched.push(logs[logs.length - 1]);
  return enriched.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function buildSessions(logs) {
  const sessions = [];
  let current = [];
  for (let i = 0; i < logs.length; i++) {
    if (current.length === 0) {
      current.push(logs[i]);
    } else {
      const last = current[current.length - 1];
      const gap = minutesDiff(last.timestamp, logs[i].timestamp);
      if (gap > MIN_SESSION_GAP_MINUTES) {
        sessions.push(current);
        current = [logs[i]];
      } else {
        current.push(logs[i]);
      }
    }
  }
  if (current.length > 0) sessions.push(current);
  return sessions;
}

function simulateMovementWeighted(logs) {
  const transitions = {};
  for (let i = 0; i < logs.length - 1; i++) {
    const from = logs[i].tower_id;
    const to = logs[i + 1].tower_id;
    const dur = (new Date(logs[i + 1].timestamp) - new Date(logs[i].timestamp)) / 1000;

    if (!transitions[from]) transitions[from] = {};
    transitions[from][to] = (transitions[from][to] || 0) + dur;

    if (!transitions[to]) transitions[to] = {};
    transitions[to][from] = (transitions[to][from] || 0) + dur;
  }

  // Normalize
  for (const from in transitions) {
    const total = Object.values(transitions[from]).reduce((a, b) => a + b, 0);
    for (const to in transitions[from]) {
      transitions[from][to] /= total;
    }
  }

  const start = logs[logs.length - 1].tower_id;
  const simulations = [];

  for (let i = 0; i < SIMULATION_RUNS; i++) {
    let curr = start;
    for (let j = 0; j < 5; j++) {
      const options = transitions[curr];
      if (!options) break;
      const rand = Math.random();
      let sum = 0;
      for (const [next, prob] of Object.entries(options)) {
        sum += prob;
        if (rand <= sum) {
          curr = next;
          break;
        }
      }
    }
    simulations.push(curr);
  }

  const freq = {};
  simulations.forEach(t => (freq[t] = (freq[t] || 0) + 1));
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return {
    mostLikely: sorted[0][0],
    simulationStats: sorted.map(([t, c]) => ({ tower: t, count: c }))
  };
}

function inferLocation(logs, towerCoords) {
  const filtered = filterNoisyTowerLogs(logs, towerCoords);
  const enriched = insertMerchantVirtualTowers(filtered);
  const sessions = buildSessions(enriched);
  const now = new Date(enriched[enriched.length - 1].timestamp);

  const nodeScores = {};
  for (const session of sessions) {
    for (let i = 0; i < session.length - 1; i++) {
      const a = session[i];
      const b = session[i + 1];
      const t = a.tower_id;
      const dur = (new Date(b.timestamp) - new Date(a.timestamp)) / 1000;

      if (!nodeScores[t]) {
        nodeScores[t] = {
          totalDuration: 0,
          count: 0,
          nightCount: 0,
          merchantHits: 0,
          lastSeen: new Date(a.timestamp),
        };
      }

      nodeScores[t].totalDuration += dur;
      nodeScores[t].count += 1;
      if (a.merchant) nodeScores[t].merchantHits += 1;
      if (isNightTime(a.timestamp)) nodeScores[t].nightCount += 1;
      nodeScores[t].lastSeen = new Date(a.timestamp);
    }
  }

  const scores = Object.entries(nodeScores).map(([id, s]) => {
    const recency = (now - s.lastSeen) / 1000;
    const score =
      0.35 * Math.log(s.totalDuration + 1) +
      0.25 * s.count +
      0.15 * s.nightCount +
      0.15 * s.merchantHits +
      0.1 * Math.exp(-recency / 3600);
    return { tower_id: id, score, ...s };
  });

  scores.sort((a, b) => b.score - a.score);
  const sim = simulateMovementWeighted(enriched);

  return {
    topTowers: scores.slice(0, 5).map(s => s.tower_id),
    scores,
    simulatedLikely: sim.mostLikely,
    simulationStats: sim.simulationStats
  };
}

app.post("/api/upload", (req, res) => {
  const data = req.body;
  const result = {};
  const towerCoords = {};

  data.forEach(rec => {
    if (rec.tower_id && rec.lat && rec.lon && !rec.merchant) {
      towerCoords[rec.tower_id] = { lat: rec.lat, lon: rec.lon };
    }
  });

  const byDevice = {};
  data.forEach(rec => {
    if (!byDevice[rec.device_id]) byDevice[rec.device_id] = [];
    byDevice[rec.device_id].push(rec);
  });

  for (const id in byDevice) {
    const logs = byDevice[id]
      .filter(l => l.is_defaulter)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (logs.length === 0) continue;
    const out = inferLocation(logs, towerCoords);

    result[id] = {
      topTowers: out.topTowers,
      simulated: out.simulatedLikely,
      stats: out.simulationStats,
      detailed: out.scores
    };
  }

  return res.json(result);
});

app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));
