const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs').promises;

// Configuration
const PORT = process.env.PORT || 5000;
const TIME_GAP_MS = 30 * 60 * 1000;   // 30 minutes
const MAX_SPEED_KMH = 120;            // realistic maximum speed
const EARTH_RADIUS_KM = 6371;         // Earth radius constant

// Utility: Min-heap priority queue
class PriorityQueue {
  constructor() { this.heap = []; }
  push(node, priority) {
    this.heap.push({ node, priority });
    this._bubbleUp();
  }
  pop() {
    if (this.isEmpty()) return null;
    const { node } = this.heap[0];
    const end = this.heap.pop();
    if (!this.isEmpty()) {
      this.heap[0] = end;
      this._sinkDown();
    }
    return node;
  }
  isEmpty() { return this.heap.length === 0; }
  _bubbleUp() {
    let idx = this.heap.length - 1;
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent].priority <= this.heap[idx].priority) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }
  _sinkDown() {
    let idx = 0;
    const length = this.heap.length;
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;
      if (left < length && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

// Haversine distance (km)
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return (2 * EARTH_RADIUS_KM) * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build adjacency list with constraints
function buildGraph(events, coords) {
  const n = events.length;
  const transitions = {};
  const dwellSum = {}, dwellCount = {};

  // compute transition counts and dwell
  for (let i = 0; i < n - 1; i++) {
    const { tower_id: A } = events[i];
    const { tower_id: B, timestamp: tB } = events[i + 1];
    const key = `${A}->${B}`;

    transitions[key] = (transitions[key] || 0) + 1;
    const dt = new Date(tB) - new Date(events[i].timestamp);
    dwellSum[A] = (dwellSum[A] || 0) + dt;
    dwellCount[A] = (dwellCount[A] || 0) + 1;
  }

  const avgDwell = {};
  Object.keys(dwellSum).forEach(t => avgDwell[t] = dwellSum[t] / dwellCount[t]);

  // adjacency: index -> [{ to, weight }]
  const adj = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    const { tower_id: A, timestamp: tA } = events[i];
    const coordA = coords[A];
    for (let j = i + 1; j < n; j++) {
      const { tower_id: B, timestamp: tB } = events[j];
      const dt = new Date(tB) - new Date(tA);
      if (dt < 0 || dt > TIME_GAP_MS) break;
      const coordB = coords[B];
      if (!coordA || !coordB) continue;

      const dist = haversine(coordA.lat, coordA.lon, coordB.lat, coordB.lon);
      const speed = dist / (dt / 3600000);
      if (speed > MAX_SPEED_KMH) continue;

      const freq = transitions[`${A}->${B}`] || 1;
      const dwell = avgDwell[A] || 1;
      const weight = 1 / (freq * dwell);

      adj[i].push({ to: j, weight });
    }
  }

  return adj;
}

// COPI: Dijkstra over event graph
function solveCOPI(events, coords) {
  const n = events.length;
  if (!n) return null;

  const adj = buildGraph(events, coords);
  const dist = Array(n).fill(Infinity);
  const prev = Array(n).fill(-1);
  const pq = new PriorityQueue();

  dist[0] = 0;
  pq.push(0, 0);

  while (!pq.isEmpty()) {
    const u = pq.pop();
    adj[u].forEach(({ to, weight }) => {
      const nd = dist[u] + weight;
      if (nd < dist[to]) {
        dist[to] = nd;
        prev[to] = u;
        pq.push(to, nd);
      }
    });
  }

  // candidate sinks: events within TIME_GAP_MS of last
  const last = new Date(events[n - 1].timestamp);
  let best = n - 1;
  for (let i = n - 2; i >= 0; i--) {
    const dt = last - new Date(events[i].timestamp);
    if (dt <= TIME_GAP_MS && dist[i] < dist[best]) best = i;
  }

  // reconstruct path
  const path = [];
  for (let u = best; u >= 0; u = prev[u]) path.push(events[u].tower_id);
  path.reverse();

  return {
    finalTower: events[best].tower_id,
    path,
    cost: dist[best],
    hops: path.length - 1,
    timestamp: events[best].timestamp
  };
}

// Main inference
async function inferLastLocations(logs) {
  const coords = {};
  logs.forEach(r => {
    if (r.lat != null && r.lon != null) coords[r.tower_id] = { lat: r.lat, lon: r.lon };
  });

  const byDevice = logs.reduce((acc, r) => {
    if (!r.is_defaulter) return acc;
    (acc[r.device_id] = acc[r.device_id] || []).push({ tower_id: r.tower_id, timestamp: r.timestamp });
    return acc;
  }, {});

  const result = {};
  const hasCoords = Object.keys(coords).length > 0;

  Object.entries(byDevice).forEach(([dev, events]) => {
    const sorted = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (hasCoords) {
      try {
        const res = solveCOPI(sorted, coords);
        result[dev] = res || { error: 'Insufficient data' };
      } catch (e) {
        result[dev] = { error: 'Error solving COPI' };
      }
    } else {
      // simple fallback
      const last = sorted[sorted.length - 1];
      result[dev] = { finalTower: last.tower_id, algorithm: 'fallback' };
    }
  });

  return result;
}

module.exports = { inferLastLocations };

// If run directly, start Express server
if (require.main === module) {
  const app = express();
  const upload = multer({ dest: 'uploads/' });
  app.use(cors());

  app.get('/', (_req, res) => res.send(`COPI Service. POST JSON to /api/copi`));

  app.post('/api/copi', upload.single('file'), async (req, res) => {
    try {
      const raw = JSON.parse(await fs.readFile(req.file.path, 'utf8'));
      await fs.unlink(req.file.path);
      const data = await inferLastLocations(raw);
      return res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
}
