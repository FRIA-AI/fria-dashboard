const KEY = 'nora_rfq_history';

export function getRFQHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveRFQ(rfq) {
  const history = getRFQHistory();
  history.unshift(rfq);
  localStorage.setItem(KEY, JSON.stringify(history.slice(0, 200)));
}

export function getMetrics() {
  const history = getRFQHistory();
  const byUser = {};
  const byLane = {};

  history.forEach(r => {
    if (!byUser[r.userName]) byUser[r.userName] = { count: 0, lanes: new Set() };
    byUser[r.userName].count++;
    if (r.lane) byUser[r.userName].lanes.add(r.lane);

    const laneKey = r.lane || 'Unknown';
    if (!byLane[laneKey]) byLane[laneKey] = { count: 0, users: new Set() };
    byLane[laneKey].count++;
    if (r.userName) byLane[laneKey].users.add(r.userName);
  });

  const usersArr = Object.entries(byUser).map(([name, d]) => ({
    name,
    count: d.count,
    lanes: d.lanes.size,
  })).sort((a, b) => b.count - a.count);

  const lanesArr = Object.entries(byLane).map(([lane, d]) => ({
    lane,
    count: d.count,
    users: d.users.size,
  })).sort((a, b) => b.count - a.count);

  return { total: history.length, byUser: usersArr, byLane: lanesArr };
}
