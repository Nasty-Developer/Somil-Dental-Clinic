/* Somil Dental Clinic — shared booking rules for the serverless API.
   Mirrors assets/clinic-config.js. Keep the two in step if hours change. */

const TZ = 'Asia/Kolkata';

const HOURS = {
  0: [],
  1: [['10:00', '13:30'], ['18:30', '22:30']],
  2: [['10:00', '13:30'], ['18:30', '22:30']],
  3: [['10:00', '13:30'], ['18:30', '22:30']],
  4: [['10:00', '13:30'], ['18:30', '22:30']],
  5: [['10:00', '13:30'], ['18:30', '22:30']],
  6: [['10:00', '13:30'], ['18:30', '22:30']]
};

/* Tomorrow only: one evening session. Matches the website. */
const TOMORROW = { enabled: true, windows: [['18:30', '22:30']] };

const CLOSED_DATES = {};
const SLOT_STEP = 30;
const LEAD_TIME = 45;
const HORIZON = 75;
const MAX_DURATION = 180;

function pad(n) { return (n < 10 ? '0' : '') + n; }

function clinicToday() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const o = {};
  p.forEach((x) => { o[x.type] = x.value; });
  return `${o.year}-${o.month}-${o.day}`;
}

function clinicNowMinutes() {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const o = {};
  p.forEach((x) => { o[x.type] = x.value; });
  return (+o.hour % 24) * 60 + +o.minute;
}

function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function dowOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isDateKey(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function windowsFor(key) {
  if (CLOSED_DATES[key]) return { closed: true, reason: CLOSED_DATES[key], windows: [] };
  if (dowOf(key) === 0) return { closed: true, reason: 'Closed on Sundays', windows: [] };
  if (TOMORROW.enabled && key === addDays(clinicToday(), 1)) {
    return { closed: false, special: true, windows: TOMORROW.windows.map((w) => [toMin(w[0]), toMin(w[1])]) };
  }
  const base = HOURS[dowOf(key)] || [];
  if (!base.length) return { closed: true, reason: 'Closed', windows: [] };
  return { closed: false, special: false, windows: base.map((w) => [toMin(w[0]), toMin(w[1])]) };
}

/** Validates a requested date/time/duration against clinic rules. */
function validateSlot(date, startMin, duration) {
  if (!isDateKey(date)) return 'Invalid date.';
  const today = clinicToday();
  const windows = windowsFor(date);
  if (windows.closed) return windows.reason || 'The clinic is closed on that date.';
  if (date < today) return 'That date has already passed.';
  if (date > addDays(today, HORIZON)) return 'That date is too far ahead to book.';
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION) return 'Invalid appointment length.';
  if (!Number.isFinite(startMin)) return 'Invalid time.';
  const fits = windows.windows.some((w) => startMin >= w[0] && startMin + duration <= w[1]);
  if (!fits) return 'That time is outside the clinic hours for the day.';
  if (date === today && startMin < clinicNowMinutes() + LEAD_TIME) return 'That time has already passed.';
  return null;
}

/** Every 30-minute start the appointment would occupy. */
function blockStarts(startMin, duration) {
  const out = [];
  for (let m = startMin; m < startMin + duration; m += SLOT_STEP) out.push(m);
  return out;
}

function hhmm(mins) { return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`; }

function keystore() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

/** Runs commands through the Upstash REST pipeline. */
async function pipeline(commands) {
  const store = keystore();
  if (!store) throw Object.assign(new Error('no_backend'), { code: 'no_backend' });
  const res = await fetch(`${store.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${store.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error('kv_' + res.status);
  return res.json();
}

const CLAIM_SCRIPT = `
local i
for i = 1, #KEYS do
  if redis.call('EXISTS', KEYS[i]) == 1 then return 0 end
end
for i = 1, #KEYS do
  redis.call('SET', KEYS[i], ARGV[1], 'EX', tonumber(ARGV[2]))
end
return 1
`;

function slotKey(date, mins) { return `sdc:slot:${date}:${hhmm(mins)}`; }

/** Atomically reserves every 30-minute block an appointment occupies. */
async function claimSlot(date, startMin, duration, payload) {
  const blocks = blockStarts(startMin, duration);
  const keys = blocks.map((m) => slotKey(date, m));
  const ttl = 60 * 60 * 24 * 120; // two months, beyond the booking horizon
  const reply = await pipeline([['EVAL', CLAIM_SCRIPT, keys.length, ...keys, JSON.stringify(payload), String(ttl)]]);
  const result = reply && reply[0] ? reply[0].result : 0;
  return { claimed: result === 1, keys };
}

async function blockedStarts(date) {
  const starts = [];
  (windowsFor(date).windows || []).forEach((w) => {
    for (let m = w[0]; m <= w[1]; m += SLOT_STEP) starts.push(m);
  });
  if (!starts.length) return { booked: [], blocks: [] };
  const keys = starts.map((m) => slotKey(date, m));
  const reply = await pipeline([['MGET', ...keys]]);
  const values = (reply && reply[0] ? reply[0].result : []) || [];
  const booked = [];
  const blocks = [];
  values.forEach((v, i) => {
    if (!v) return;
    booked.push(hhmm(starts[i]));
    blocks.push(hhmm(starts[i]));
  });
  return { booked, blocks };
}

module.exports = {
  TZ, HOURS, TOMORROW, SLOT_STEP, LEAD_TIME, HORIZON,
  clinicToday, clinicNowMinutes, addDays, windowsFor, validateSlot,
  blockStarts, hhmm, toMin, isDateKey, claimSlot, blockedStarts, keystore
};
