function parseTimeToMinutes(value) {
  if (value == null) return null;
  const s = String(value).trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 24) return null;
  if (mm < 0 || mm > 59) return null;
  if (hh === 24 && mm !== 0) return null;
  return hh * 60 + mm;
}

function minutesToTime(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m)) return "00:00";
  const clamped = Math.max(0, Math.min(24 * 60, Math.floor(m)));
  if (clamped === 24 * 60) return "24:00";
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

module.exports = { parseTimeToMinutes, minutesToTime };
