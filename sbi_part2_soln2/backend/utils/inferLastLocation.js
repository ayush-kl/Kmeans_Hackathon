function inferLastLocations(logs) {
  const defaulters = new Set();
  const deviceLogs = {};

  for (const entry of logs) {
    const { device_id, timestamp, tower_id, is_defaulter } = entry;
    if (is_defaulter) defaulters.add(device_id);
    if (!deviceLogs[device_id]) deviceLogs[device_id] = [];
    deviceLogs[device_id].push({ timestamp, tower_id });
  }

  const result = {};

  for (const device_id of defaulters) {
    const entries = deviceLogs[device_id];
    if (!entries || entries.length === 0) {
      result[device_id] = "No records";
      continue;
    }

    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    result[device_id] = entries[0].tower_id;
  }

  return result;
}

module.exports = { inferLastLocations };
