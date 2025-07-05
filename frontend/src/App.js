import React, { useState } from "react";
import axios from "axios";

export default function App() {
  const [file, setFile] = useState(null);
  const [output, setOutput] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post("http://localhost:5000/api/upload", formData);
    setOutput(res.data);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Defaulter Last Location Tracker</h2>
      <form onSubmit={handleSubmit}>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button type="submit">Upload</button>
      </form>

      {output && (
        <div style={{ marginTop: 20 }}>
          <h4>Last Known Locations:</h4>
          <ul>
            {Object.entries(output).map(([id, tower]) => (
              <li key={id}>
                {id}: {tower}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
