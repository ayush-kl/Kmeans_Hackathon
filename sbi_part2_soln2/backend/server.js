const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const NIGHT_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
const DISTANCE_THRESHOLD_KM = 50;
const TIME_THRESHOLD_MIN = 5;

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
    logs[i].lat = coords[a.tower_id].lat;
    logs[i].lon = coords[a.tower_id].lon;
     logs[i+1].lat = coords[b.tower_id].lat;
    logs[i+1].lon = coords[b.tower_id].lon;
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


function inferMissingTowerCoords(towerCoords, logs) {
  const inferred = { ...towerCoords };
  const connections = {};
  //console.log(logs);
  for (let i = 0; i < logs.length - 1; i++) {
    const a = logs[i].tower_id;
    const b = logs[i + 1].tower_id;
    if (!connections[a]) connections[a] = new Set();
    if (!connections[b]) connections[b] = new Set();
    if(a==b){
      continue;
    }
    connections[a].add(b);
    connections[b].add(a);
  //  console.log(connections[a]);
  }

  for (const tower in connections) {
    if (inferred[tower]) continue;
    const neighbors = [...connections[tower]].filter(n => inferred[n]);
    if (neighbors.length < 1) continue;
   // console.log(neighbors,tower);
    let x = 0, y = 0, wSum = 0;
    for (const n of neighbors) {
      const dist = 1 / Math.sqrt(1 + haversine({ lat: 0, lon: 0 }, inferred[n]));
      x += inferred[n].lat * dist;
      y += inferred[n].lon * dist;
      wSum += dist;
    }
    inferred[tower] = { lat: x / wSum, lon: y / wSum };
  }

  return inferred;
}
function toIST(dateStr) {
  const date = new Date(dateStr);
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
}

function inferLocation(logs, towerCoords) {
  const now = toIST(new Date());

  // console.log(now);
  const filtered = filterNoisyTowerLogs(logs, towerCoords);
//  console.log(filtered);
  const enriched = filtered;
  const towerScores = {};
  const transitions = {};

  for (let i = 0; i < enriched.length - 1; i++) {
    const a = enriched[i];
    const b = enriched[i + 1];
    const dur = (new Date(b.timestamp) - new Date(a.timestamp)) / 1000;
    const t = a.tower_id;

    if (!towerScores[t]) {
      towerScores[t] = {
        totalDuration: 0,
        count: 0,
        nightCount: 0,
        merchantHits: 0,
        lastSeen: new Date(a.timestamp),
      };
    }
  //  console.log(enriched);
    towerScores[t].totalDuration += dur;
    towerScores[t].count += 1;
    if (a.merchant) towerScores[t].merchantHits += 1;
    if (isNightTime(a.timestamp)) towerScores[t].nightCount += 1;
    towerScores[t].lastSeen = new Date(a.timestamp);

    const from = a.tower_id, to = b.tower_id;
    if(from == to){
      continue;
    }
    if (!transitions[from]) transitions[from] = {};
    transitions[from][to] = (transitions[from][to] || 0) + dur;
  }

  const scores = Object.entries(towerScores).map(([id, s]) => {
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

  const scoreMap = Object.fromEntries(scores.map(s => [s.tower_id, s.score]));

  // console.log(now);
 const currentWindow = enriched.filter(l => {
  const logTime = toIST(l.timestamp);
  const nwTime = new Date();
  const nowTime = toIST(nwTime);
// console.log(logTime);
// console.log("hello");
// console.log(nowTime);
  const logMinutes = logTime.getHours() * 60 + logTime.getMinutes();
  const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();

  const diff = Math.abs(logMinutes - nowMinutes);
  //console.log(logMinutes,  nowMinutes, diff);
  return diff <= 60;
}).sort((a, b) => (scoreMap[b.tower_id] || 0) - (scoreMap[a.tower_id] || 0));
;
//  console.log(currentWindow);
  
 // console.log(currentWindow.length);


  let currentTower = null;
// console.log(currentWindow.length);
if (currentWindow.length) {
  currentTower = currentWindow[currentWindow.length - 1].tower_id;
} else {
  const recent = enriched
    .filter(l => {
  const logTime = toIST(l.timestamp);
   const nwTime = new Date();
  const nowTime = toIST(nwTime);

  const logMinutes = logTime.getHours() * 60 + logTime.getMinutes();
  const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();

  const diff = Math.abs(logMinutes - nowMinutes);
  return diff <= 180;}) // 3 hours
    .sort((a, b) => new Date((a.timestamp)) - new Date((b.timestamp)));
  if (recent.length) currentTower = recent[0].tower_id;
 // console.log(recent[0]);
}

  let nextTower = null;
  if (currentTower && transitions[currentTower]) {
    const sorted = Object.entries(transitions[currentTower])
      .sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) nextTower = sorted[0][0];
  }

  return {
    topTowers: scores.slice(0, 5).map(s => s.tower_id),
    scores,
    currentTower,
    nextLikelyTower: nextTower
  };
}
const { readData, writeData } = require("./utils/db");

app.post("/api/uploadnewdata", (req, res) => {
  const newRecords = req.body;
  const currentData = readData();
  writeData([...currentData, ...newRecords]);
  res.send({ status: "Saved", count: newRecords.length });
});

app.post("/api/lookup-by-phone", (req, res) => {
  const { phone } = req.body;
//  console.log(phone);
  const allData = readData();
  const logs = allData.filter((r) => r.phone === phone);
   // use same logic
 //  console.log(logs);
  res.json(logs);
});

app.post("/api/upload", (req, res) => {

  const data = req.body;
 //   console.log(data);
  const towerCoords = {};
  const result = {};
  //console.log(data);
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
   // console.log(towerCoords);
    
    const inferredCoords = inferMissingTowerCoords(towerCoords, logs);

    console.log(inferredCoords);
    const out = inferLocation(logs, inferredCoords);
    
   // console.log(out);
    result[id] = {
      topTowers: out.topTowers,
      current: out.currentTower,
      next: out.nextLikelyTower,
      detailed: out.scores,
      coords: inferredCoords
    };
    
  }
  console.log(result);
  return res.json(result);
});

app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));
