
// import React, { useState } from "react";
// import axios from "axios";
// import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
// import L from "leaflet";
// import sbiLogo from "./sbi-logo.png"; // optional

// export default function App() {
//   const [records, setRecords] = useState([]);
//   const [form, setForm] = useState({
//     device_id: "",
//     tower_id: "",
//     timestamp: "",
//     lat: "",
//     lon: "",
//     is_defaulter: false,
//     merchant: false,
//     phone: "",
//   });
//   const [output, setOutput] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [phoneLookup, setPhoneLookup] = useState("");
//   const [lookupResults, setLookupResults] = useState([]);

//   const handleAdd = () => {
//     if (!form.device_id || !form.timestamp) return alert("Device ID & Timestamp required");
//     setRecords([...records, { ...form }]);
//     setForm({
//       device_id: "",
//       tower_id: "",
//       timestamp: "",
//       lat: "",
//       lon: "",
//       is_defaulter: false,
//       merchant: false,
//       phone: "",
//     });
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (!records.length) return alert("No records to submit.");

//     setLoading(true);
//     try {
//       const res = await axios.post("http://localhost:5000/api/upload", records);
//       setOutput(res.data);
//     } catch (err) {
//       alert("Failed to submit");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleFileUpload = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onload = (evt) => {
//       try {
//         const parsed = JSON.parse(evt.target.result);
//         if (Array.isArray(parsed)) setRecords((prev) => [...prev, ...parsed]);
//         else alert("JSON must be an array");
//       } catch {
//         alert("Invalid JSON");
//       }
//     };
//     reader.readAsText(file);
//   };

//   const handlePhoneLookup = () => {
//     const filtered = records.filter((r) => r.phone === phoneLookup);
//     setLookupResults(filtered);
//   };

//   const getTopTowersFromRecords = (recs) => {
//     const countMap = {};
//     recs.forEach((r) => {
//       if (!r.tower_id) return;
//       countMap[r.tower_id] = (countMap[r.tower_id] || 0) + 1;
//     });
//     const top = Object.entries(countMap)
//       .sort((a, b) => b[1] - a[1])
//       .slice(0, 5)
//       .map(([tower_id]) => recs.find((r) => r.tower_id === tower_id));
//     return top.filter(Boolean);
//   };

//   return (
//     <div style={{ background: "#eef4f9", minHeight: "100vh", padding: 20, fontFamily: "sans-serif" }}>
//       <header style={{ textAlign: "center", marginBottom: 30 }}>
//         <img src={sbiLogo} alt="SBI Logo" style={{ width: 80 }} />
//         <h1 style={{ color: "#1a237e" }}>SBI Defaulter Tracker</h1>
//       </header>

//       <form
//         onSubmit={handleSubmit}
//         style={{
//           background: "#fff",
//           padding: 20,
//           borderRadius: 8,
//           boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
//           marginBottom: 30,
//         }}
//       >
//         <h2 style={{ color: "#0d47a1" }}>Add Tower Entry</h2>
//         <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
//           <input
//             placeholder="Device ID"
//             value={form.device_id}
//             onChange={(e) => setForm({ ...form, device_id: e.target.value })}
//           />
//           <input
//             placeholder="Phone Number"
//             value={form.phone}
//             onChange={(e) => setForm({ ...form, phone: e.target.value })}
//           />
//           <input
//             placeholder="Tower ID"
//             value={form.tower_id}
//             onChange={(e) => setForm({ ...form, tower_id: e.target.value })}
//           />
//           <input
//             type="datetime-local"
//             value={form.timestamp}
//             onChange={(e) => setForm({ ...form, timestamp: e.target.value })}
//           />
//           <input
//             type="number"
//             step="any"
//             placeholder="Latitude"
//             value={form.lat}
//             onChange={(e) => setForm({ ...form, lat: e.target.value })}
//           />
//           <input
//             type="number"
//             step="any"
//             placeholder="Longitude"
//             value={form.lon}
//             onChange={(e) => setForm({ ...form, lon: e.target.value })}
//           />
//           <label>
//             <input
//               type="checkbox"
//               checked={form.is_defaulter}
//               onChange={(e) => setForm({ ...form, is_defaulter: e.target.checked })}
//             />
//             Defaulter
//           </label>
//           <label>
//             <input
//               type="checkbox"
//               checked={form.merchant}
//               onChange={(e) => setForm({ ...form, merchant: e.target.checked })}
//             />
//             Merchant
//           </label>
//         </div>
//         <div style={{ marginTop: 10 }}>
//           <button type="button" onClick={handleAdd} style={{ marginRight: 10 }}>
//             ➕ Add Entry
//           </button>
//           <input type="file" accept=".json" onChange={handleFileUpload} style={{ marginRight: 10 }} />
//           <button type="submit" disabled={loading}>
//             {loading ? "Submitting..." : "Submit All Records"}
//           </button>
//         </div>
//       </form>

//       <div style={{ marginBottom: 30, background: "#fff", padding: 20, borderRadius: 8 }}>
//         <h2 style={{ color: "#0d47a1" }}>🔍 Lookup by Phone</h2>
//         <input
//           type="text"
//           placeholder="Enter phone number"
//           value={phoneLookup}
//           onChange={(e) => setPhoneLookup(e.target.value)}
//           style={{ padding: 8, width: "200px", marginRight: 10 }}
//         />
//         <button onClick={handlePhoneLookup}>Search</button>

//         {lookupResults.length > 0 && (
//           <div style={{ marginTop: 20 }}>
//             <h3>Top Tower Locations Used by: {phoneLookup}</h3>
//             <MapContainer center={[26.19, 91.69]} zoom={14} style={{ height: 300, marginTop: 10 }}>
//               <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
//               {getTopTowersFromRecords(lookupResults).map((tower, idx) => (
//                 <Marker
//                   key={idx}
//                   position={[parseFloat(tower.lat), parseFloat(tower.lon)]}
//                   icon={L.icon({
//                     iconUrl: "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png",
//                     iconSize: [25, 41],
//                   })}
//                 >
//                   <Popup>
//                     📞 Tower: {tower.tower_id} <br />
//                     Time: {tower.timestamp}
//                   </Popup>
//                 </Marker>
//               ))}
//             </MapContainer>
//           </div>
//         )}
//       </div>

//       {output && (
//         <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
//           <h2 style={{ color: "#0d47a1" }}>Prediction Result</h2>
//           {Object.entries(output).map(([deviceId, info]) => {
//             const topTowers = info.topTowers
//               .map((towerId) => {
//                 const found = records.find((r) => r.device_id === deviceId && r.tower_id === towerId);
//                 return found ? { ...found, tower_id: towerId } : null;
//               })
//               .filter(Boolean);

//             return (
//               <div key={deviceId}>
//                 <h3>📱 Device: {deviceId}</h3>
//                 <p>
//                   Current Tower: <strong>{info.current}</strong><br />
//                   Next Predicted: <strong style={{ color: "green" }}>{info.next}</strong>
//                 </p>
//                 <MapContainer center={[26.19, 91.69]} zoom={14} style={{ height: 300, margin: "1rem 0" }}>
//                   <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
//                   {topTowers.map((tower, idx) => (
//                     <Marker
//                       key={`top-${idx}`}
//                       position={[parseFloat(tower.lat), parseFloat(tower.lon)]}
//                       icon={L.icon({
//                         iconUrl: "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png",
//                         iconSize: [25, 41],
//                       })}
//                     >
//                       <Popup>
//                         ⭐ Top {idx + 1}: {tower.tower_id} ({tower.lat}, {tower.lon})
//                       </Popup>
//                     </Marker>
//                   ))}
//                 </MapContainer>
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }
import React, { useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import sbiLogo from "./sbi-logo.png"; // optional

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

    const handlePhoneLookup = async () => {
    if (!phone) return alert("Enter phone number");
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/lookup-by-phone", { phone });
      const res2 = await axios.post("http://localhost:5000/api/upload", res.data);
       setRecords(res.data);

      setOutput(res2.data);
    } catch {
      alert("Failed to fetch logs");
    }
    setLoading(false);
  };
   const [phone, setPhone] = useState("");
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
    <div style={{ background: "#eef4f9", minHeight: "100vh", padding: 20, fontFamily: "sans-serif" }}>
      <header style={{ textAlign: "center", marginBottom: 30 }}>
        <img src={sbiLogo} alt="SBI Logo" style={{ width: 80 }} />
        <h1 style={{ color: "#1a237e" }}>SBI Defaulter Tracker</h1>
      </header>
            <div style={{ marginTop: "1rem" }}>
        <input
          placeholder="Enter phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button type="button" onClick={handlePhoneLookup}>
          Lookup by Phone
        </button>
      </div>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: 30,
        }}
      >
        <h2 style={{ color: "#0d47a1" }}>Add Tower Entry</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          <input
            placeholder="Device ID"
            value={form.device_id}
            onChange={(e) => setForm({ ...form, device_id: e.target.value })}
          />
          <input
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
              onChange={(e) => setForm({ ...form, is_defaulter: e.target.checked })}
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
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={handleAdd} style={{ marginRight: 10 }}>
            ➕ Add Entry
          </button>
          <input type="file" accept=".json" onChange={handleFileUpload} style={{ marginRight: 10 }} />
          <button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit All Records"}
          </button>
        </div>
      </form>

   
      {output && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h2 style={{ color: "#0d47a1" }}>Prediction Result</h2>
          {Object.entries(output).map(([deviceId, info]) => {
            const topTowers = info.topTowers
              .map((towerId) => {
                const found = records.find((r) => r.device_id === deviceId && r.tower_id === towerId);
                return found ? { ...found, tower_id: towerId } : null;
              })
              .filter(Boolean);

            return (
              <div key={deviceId}>
                <h3>📱 Device: {deviceId}</h3>
                <p>
                  Current Tower: <strong>{info.current}</strong><br />
                  Next Predicted: <strong style={{ color: "green" }}>{info.next}</strong>
                </p>
                <MapContainer center={[26.19, 91.69]} zoom={14} style={{ height: 300, margin: "1rem 0" }}>
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

  {/* ✅ Next Predicted Tower Marker */}
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
