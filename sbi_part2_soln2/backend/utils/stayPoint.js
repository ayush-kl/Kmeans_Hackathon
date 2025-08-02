/**
 * Implements Li et al.’s stay-point detection algorithm (simplified).
 * Input: sorted logs for one device [{tower_id, timestamp}, …]
 * Output: list of stay towers: {tower_id, startTs, endTs}
 */
function detectStayPoints(entries, theta_t_min = 10 * 60 * 1000) {
  const stays = [];
  let i = 0;
  while (i < entries.length) {
    let j = i + 1;
    while (
      j < entries.length &&
      entries[j].tower_id === entries[i].tower_id &&
      new Date(entries[j].timestamp) - new Date(entries[i].timestamp) <= theta_t_min * 5
    ) {
      j++;
    }
    const t_start = new Date(entries[i].timestamp);
    const t_end = new Date(entries[j - 1].timestamp);
    if (t_end - t_start >= theta_t_min) {
      stays.push({
        tower_id: entries[i].tower_id,
        start: entries[i].timestamp,
        end: entries[j - 1].timestamp,
      });
    }
    i = j;
  }
  return stays;
}

module.exports = { detectStayPoints };
