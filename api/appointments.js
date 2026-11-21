/* POST /api/appointments
   Reserves every 30-minute block an appointment occupies, atomically.
   A second patient asking for the same slot gets 409 and nothing is stored.

   Body: { ref, date, time ("HH:MM"), duration, treatment, name, phone, email, message }
   Stored status is always "pending": the clinic confirms on WhatsApp. */

const lib = require('./_lib');

function bad(res, msg, code) {
  res.status(400).json({ error: msg, code: code || 'invalid' });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }
  if (!lib.keystore()) {
    res.status(503).json({
      error: 'Booking storage is not configured yet, so the slot cannot be held. The WhatsApp request still reaches the clinic.',
      code: 'no_backend'
    });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const date = String(body.date || '');
  const time = String(body.time || '');
  const duration = Number(body.duration || 0);
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').replace(/[^\d]/g, '').replace(/^91(?=\d{10}$)/, '');
  const ref = String(body.ref || '').slice(0, 40);

  if (!lib.isDateKey(date)) return bad(res, 'Invalid date.');
  if (!/^\d{2}:\d{2}$/.test(time)) return bad(res, 'Invalid time.');
  if (name.length < 2) return bad(res, 'Patient name is required.');
  if (!/^[6-9]\d{9}$/.test(phone)) return bad(res, 'A valid 10-digit Indian mobile number is required.');
  if (!ref) return bad(res, 'Booking reference is required.');

  const startMin = lib.toMin(time);
  const problem = lib.validateSlot(date, startMin, duration);
  if (problem) return bad(res, problem, 'slot_invalid');

  const record = {
    ref,
    date,
    time,
    duration,
    treatment: String(body.treatment || '').slice(0, 80),
    name: name.slice(0, 120),
    phone,
    email: String(body.email || '').slice(0, 160),
    message: String(body.message || '').slice(0, 600),
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  try {
    const { claimed } = await lib.claimSlot(date, startMin, duration, record);
    if (!claimed) {
      res.status(409).json({ error: 'That slot has just been taken. Please pick another time.', code: 'slot_taken' });
      return;
    }
    res.status(201).json({ ok: true, id: ref, status: 'pending', date, time, duration });
  } catch (err) {
    res.status(502).json({ error: 'Could not hold that slot. Please try again.', code: 'kv_error' });
  }
};
