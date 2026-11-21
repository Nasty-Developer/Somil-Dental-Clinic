/* GET /api/availability?date=YYYY-MM-DD
   Returns the 30-minute starts already taken in clinic time.
   Requires a KV store; without one it answers 503 and the site stays in
   request mode (WhatsApp only, no reservation). */

const lib = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Use GET.' });
    return;
  }
  const date = String((req.query && req.query.date) || '');
  if (!lib.isDateKey(date)) {
    res.status(400).json({ error: 'Pass ?date=YYYY-MM-DD.' });
    return;
  }
  if (!lib.keystore()) {
    res.status(503).json({ error: 'Booking storage is not configured yet.', code: 'no_backend' });
    return;
  }
  const info = lib.windowsFor(date);
  if (info.closed) {
    res.status(200).json({ date, closed: true, reason: info.reason, booked: [], blocks: [] });
    return;
  }
  try {
    const { booked, blocks } = await lib.blockedStarts(date);
    res.status(200).json({ date, closed: false, special: !!info.special, booked, blocks });
  } catch (err) {
    res.status(502).json({ error: 'Could not read the clinic calendar.' });
  }
};
