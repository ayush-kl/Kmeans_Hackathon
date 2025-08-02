import React, { useState } from "react";
import axios from "axios";

export default function App() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    device_id: "",
    tower_id: "",
    timestamp: "",
    lat: "",
    lon: "",
    is_defaulter: false,
    merchant: false
  });
  const [output, setOutput] = useState(null);

  const handleAdd = () => {
    setRecords([...records, { ...form }]);
    setForm({
      device_id: "",
      tower_id: "",
      timestamp: "",
      lat: "",
      lon: "",
      is_defaulter: false,
      merchant: false
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (records.length === 0) return;

    const res = await axios.post("http://localhost:5000/api/upload", records);
    setOutput(res.data);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Defaulter Location Tracker – Manual Entry</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <input
            placeholder="Device ID"
            value={form.device_id}
            onChange={(e) => setForm({ ...form, device_id: e.target.value })}
          />
          <input
            placeholder="Tower ID"
            value={form.tower_id}
            onChange={(e) => setForm({ ...form, tower_id: e.target.value })}
          />
          <input
            type="datetime-local"
            value={form.timestamp}
            onChange={(e) => setForm({ ...form, timestamp: e.target.value })}
          />
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={form.lon}
            onChange={(e) => setForm({ ...form, lon: e.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={form.is_defaulter}
              onChange={(e) =>
                setForm({ ...form, is_defaulter: e.target.checked })
              }
            />
            Defaulter
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.checked })}
            />
            Merchant
          </label>
          <button type="button" onClick={handleAdd}>
            ➕ Add Entry
          </button>
        </div>
        <button type="submit" style={{ marginTop: 10 }}>
          🚀 Submit All Records
        </button>
      </form>

      <div style={{ marginTop: 20 }}>
        <h4>Entries:</h4>
        <ul>
          {records.map((rec, i) => (
            <li key={i}>
              [{rec.device_id}] {rec.timestamp} → {rec.tower_id || "Merchant"} (
              {rec.lat}, {rec.lon}){" "}
              {rec.is_defaulter && <b>[Defaulter]</b>}{" "}
              {rec.merchant && <b>[Merchant]</b>}
            </li>
          ))}
        </ul>
      </div>

      {output && (
        <div style={{ marginTop: 30 }}>
          <h4>Output Results:</h4>
          {Object.entries(output).map(([id, info]) => (
            <div key={id} style={{ marginBottom: 20 }}>
              <h5>{id}</h5>
              <p><strong>Top Towers:</strong> {info.topTowers.join(", ")}</p>
              <p><strong>Simulated Likely Tower:</strong> {info.simulated}</p>

              <details>
                <summary><strong>Simulation Stats</strong></summary>
                <ul>
                  {info.stats.map((s, i) => (
                    <li key={i}>
                      {s.tower}: {s.count}
                    </li>
                  ))}
                </ul>
              </details>

              <details>
                <summary><strong>Score Breakdown</strong></summary>
                <ul>
                  {info.detailed.map((t, i) => (
                    <li key={i}>
                      {t.tower_id} → Score: {t.score.toFixed(2)}, Duration:{" "}
                      {t.totalDuration.toFixed(1)}, Visits: {t.count}, Nights:{" "}
                      {t.nightCount}, Merchant Hits: {t.merchantHits}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
