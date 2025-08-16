import React, { useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import sbiLogo from "./sbi-logo.png"; // optional

const mainBg = "#f3f6fa";
const cardBg = "#fff";
const accent = "#1a237e";
const accent2 = "#2563eb";
const accent3 = "#059669";
const border = "#e0e7ef";
const shadow = "0 2px 12px #0001";

const inputStyle = {
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px solid ${border}`,
  fontSize: 15,
  background: "#f8fafc",
  outline: "none",
  marginBottom: 0,
  transition: "border 0.2s",
};

const labelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 15,
  background: "#f1f5f9",
  padding: "6px 10px",
  borderRadius: 6,
};

const btnStyle = {
  background: accent2,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "10px 20px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 15,
  marginRight: 10,
  boxShadow: "0 1px 4px #0001",
  transition: "background 0.2s",
};

const submitBtnStyle = {
  ...btnStyle,
  background: accent3,
  marginRight: 0,
};

const fileInputStyle = {
  ...inputStyle,
  background: "#fff",
  border: `1px dashed ${accent2}`,
  padding: "8px 10px",
  marginRight: 10,
  cursor: "pointer",
};

const cardStyle = {
  background: cardBg,
  padding: 24,
  borderRadius: 12,
  boxShadow: shadow,
  marginBottom: 30,
};

const entryListStyle = {
  background: "#f1f5f9",
  borderRadius: 8,
  padding: 12,
  marginTop: 10,
  boxShadow: "0 1px 4px #0001",
};

const entryItemStyle = {
  padding: "8px 0",
  borderBottom: `1px solid ${border}`,
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const chip = {
  display: "inline-block",
  background: "#e0e7ff",
  color: "#3730a3",
  borderRadius: 8,
  padding: "2px 10px",
  marginRight: 6,
  fontSize: 14,
  fontWeight: 500,
};

const towerHighlight = {
  background: "#fef9c3",
  color: "#b45309",
  borderRadius: 8,
  padding: "2px 10px",
  fontSize: 14,
  fontWeight: 500,
  marginLeft: 6,
};

export default function App() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    device_id: "",
    tower_id: "",
    timestamp: "",
    lat: "",
    lon: "",
    is_defaulter: false,
    merchant: false,
    phone: "",
  });
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState("");
  const [lookupResults, setLookupResults] = useState([]);
  const [phone, setPhone] = useState("");

  const handleAdd = () => {
    if (!form.device_id || !form.timestamp) return alert("Device ID & Timestamp required");
    setRecords([...records, { ...form }]);
    setForm({
      device_id: "",
      tower_id: "",
      timestamp: "",
      lat: "",
      lon: "",
      is_defaulter: false,
      merchant: false,
      phone: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!records.length) return alert("No records to submit.");

    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/upload", records);
      
      setOutput(res.data);
    } catch (err) {
      alert("Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (Array.isArray(parsed)) setRecords((prev) => [...prev, ...parsed]);
        else alert("JSON must be an array");
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  };

  // const handlePhoneLookup = async () => {
  //   if (!phone) return alert("Enter phone number");
  //   setLoading(true);
  //   try {
  //     const res = await axios.post("http://localhost:5000/api/lookup-by-phone", { phone });
  //     const res2 = await axios.post("http://localhost:5000/api/upload", res.data);
  //  console.log(res2.data.synthetic_user_001.coords);

  //     setRecords(res.data);
  //     console.log(res.data);
  //     setOutput(res2.data);
  //   } catch {
  //     alert("Failed to fetch logs");
  //   }
  //   setLoading(false);
  // };

  const handlePhoneLookup = async () => {
  if (!phone) return alert("Enter phone number");
  setLoading(true);
  try {
    const res = await axios.post("http://localhost:5000/api/lookup-by-phone", { phone });
    setRecords(res.data);
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    const res2 = await axios.post("http://localhost:5000/api/upload", res.data);

    console.log("Backend coords:", res2.data.synthetic_user_001.coords);

    // Copy records so we can patch coordinates
    const patchedRecords = res.data.map(rec => {
      if ((!rec.lat || !rec.lon) && res2.data.synthetic_user_001.coords[rec.tower_id]) {
        const coord = res2.data.synthetic_user_001.coords[rec.tower_id];
        return {
          ...rec,
          lat: coord.lat,
          lon: coord.lon
        };
      }
      return rec;
    });

    setRecords(patchedRecords);
    setOutput(res2.data);

  } catch (err) {
    console.error(err);
    alert("Failed to fetch logs");
  }
  setLoading(false);
};

  const getTopTowersFromRecords = (recs) => {
    const countMap = {};
    recs.forEach((r) => {
      if (!r.tower_id) return;
      countMap[r.tower_id] = (countMap[r.tower_id] || 0) + 1;
    });
    const top = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tower_id]) => recs.find((r) => r.tower_id === tower_id));
    return top.filter(Boolean);
  };

  return (
    <div style={{ background: mainBg, minHeight: "100vh", padding: 20, fontFamily: "Segoe UI, sans-serif" }}>
      <header style={{ textAlign: "center", marginBottom: 30 }}>
        <img src={sbiLogo} alt="SBI Logo" style={{ width: 80, marginBottom: 8 }} />
        <h1 style={{ color: accent, fontWeight: 800, letterSpacing: 1, fontSize: 32, margin: 0 }}>
          SBI Defaulter Tracker
        </h1>
        <div style={{ color: "#64748b", fontSize: 16, marginTop: 4 }}>
          <span role="img" aria-label="location">📍</span> Track, Predict & Visualize Tower Usage
        </div>
      </header>

      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ color: accent2, marginTop: 0, marginBottom: 18, fontSize: 22 }}>🔍 Lookup by Phone</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Enter phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ ...inputStyle, width: 200 }}
          />
          <button style={btnStyle} type="button" onClick={handlePhoneLookup}>
            Lookup by Phone
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          ...cardStyle,
          marginBottom: 30,
          borderLeft: `6px solid ${accent2}`,
        }}
      >
        <h2 style={{ color: accent2, marginTop: 0, marginBottom: 18, fontSize: 22 }}>Add Tower Entry</h2>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            marginBottom: 10,
          }}
        >
          <input
            placeholder="Device ID"
            value={form.device_id}
            onChange={(e) => setForm({ ...form, device_id: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="Tower ID"
            value={form.tower_id}
            onChange={(e) => setForm({ ...form, tower_id: e.target.value })}
            style={inputStyle}
          />
          <input
            type="datetime-local"
            value={form.timestamp}
            onChange={(e) => setForm({ ...form, timestamp: e.target.value })}
            style={inputStyle}
          />
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            style={inputStyle}
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={form.lon}
            onChange={(e) => setForm({ ...form, lon: e.target.value })}
            style={inputStyle}
          />
          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={form.is_defaulter}
              onChange={(e) => setForm({ ...form, is_defaulter: e.target.checked })}
            />
            Defaulter
          </label>
          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.checked })}
            />
            Merchant
          </label>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center" }}>
          <button type="button" onClick={handleAdd} style={btnStyle}>
            ➕ Add Entry
          </button>
          <input type="file" accept=".json" onChange={handleFileUpload} style={fileInputStyle} />
          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? "Submitting..." : "Submit All Records"}
          </button>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
          <b>Tip:</b> You can upload a <code>.json</code> file with your records, or add them manually above.
        </div>
      </form>

      <div style={entryListStyle}>
        <h4 style={{ color: accent2, margin: 0, marginBottom: 8 }}>Entries:</h4>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {records.map((rec, i) => (
            <li key={i} style={entryItemStyle}>
              <span style={chip}>ayushi_mittal</span>
              <span>
                {rec.timestamp} → <b>{rec.tower_id || "Merchant"}</b> ({rec.lat}, {rec.lon})
              </span>
              {rec.is_defaulter && (
                <span style={towerHighlight}>Defaulter</span>
              )}
              {rec.merchant && (
                <span style={{ ...chip, background: "#bbf7d0", color: "#166534" }}>
                  Merchant
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {output && (
        <div style={{ ...cardStyle, marginTop: 30 }}>
          <h2 style={{ color: accent2, marginTop: 0 }}>Prediction Result</h2>
          {Object.entries(output).map(([deviceId, info]) => {
            const topTowers = info.topTowers
              .map((towerId) => {
                const found = records.find((r) => r.device_id === deviceId && r.tower_id === towerId);
                return found ? { ...found, tower_id: towerId } : null;
              })
              .filter(Boolean);

            return (
              <div key={deviceId} style={{ marginBottom: 32 }}>
                <h3 style={{ color: accent, marginBottom: 8 }}>📱 Device: ayushi_mittal</h3>
                <p style={{ fontSize: 16 }}>
                  <span style={{ ...chip, background: "#fef9c3", color: "#b45309" }}>
                    Current Tower: <strong>{info.current}</strong>
                  </span>
                  <span style={{ ...chip, background: "#bbf7d0", color: "#166534", marginLeft: 8 }}>
                    Next Predicted: <strong>{info.next}</strong>
                  </span>
                </p>
                <MapContainer center={[26.19, 91.69]} zoom={14} style={{ height: 300, margin: "1rem 0", borderRadius: 10, overflow: "hidden" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {topTowers.map((tower, idx) => (
                    <Marker
                      key={`top-${idx}`}
                      position={[parseFloat(tower.lat), parseFloat(tower.lon)]}
                      icon={L.icon({
                        iconUrl: "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png",
                        iconSize: [25, 41],
                      })}
                    >
                      <Popup>
                        ⭐ Top {idx + 1}: {tower.tower_id} ({tower.lat}, {tower.lon})
                      </Popup>
                    </Marker>
                  ))}
                  {records.find((r) => r.device_id === deviceId && r.tower_id === info.current) && (
                    <Marker
                      position={[
                        parseFloat(records.find((r) => r.device_id === deviceId && r.tower_id === info.current).lat),
                        parseFloat(records.find((r) => r.device_id === deviceId && r.tower_id === info.current).lon),
                      ]}
                      icon={L.divIcon({
                        className: "current-tower-icon",
                        html: "<div style='font-size: 24px; color: gold;'>⭐</div>",
                      })}
                    >
                      <Popup>⭐ Current Tower: {info.current}</Popup>
                    </Marker>
                  )}

                  {records.find((r) => r.device_id === deviceId && r.tower_id === info.next) && (
                    <Marker
                      position={[
                        parseFloat(records.find((r) => r.device_id === deviceId && r.tower_id === info.next).lat),
                        parseFloat(records.find((r) => r.device_id === deviceId && r.tower_id === info.next).lon),
                      ]}
                      icon={L.divIcon({
                        className: "next-tower-icon",
                        html: "<div style='font-size: 24px; color: green;'>✅</div>",
                      })}
                    >
                      <Popup>✅ Next Predicted: {info.next}</Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}