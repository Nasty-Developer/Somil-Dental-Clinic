/* Somil Dental Clinic — clinic configuration.
   Everything the booking flow depends on lives here. Change a value and the
   whole site follows: hours, the special next-day schedule, closed dates and
   the WhatsApp number. */

window.SDC = {
  clinicName: "Somil Dental Clinic",
  timezone: "Asia/Kolkata",

  /* The WhatsApp number already used across the site. Do not change casually. */
  whatsapp: "918591434914",

  /* ---- operating hours -------------------------------------------------
     Keys are JS weekdays: 0 = Sunday … 6 = Saturday.
     Each day is a list of [open, close] windows in 24h clinic time.
     The clinic runs one evening session only: 6:30 pm – 10:30 pm, and the
     close time is also the last appointment start time. That gives exactly
     nine slots each open day: 6:30, 7:00, 7:30, 8:00, 8:30, 9:00, 9:30,
     10:00 and 10:30 pm — no morning or afternoon slots.
     An empty list means closed all day. */
  hours: {
    0: [],
    1: [["18:30", "22:30"]],
    2: [["18:30", "22:30"]],
    3: [["18:30", "22:30"]],
    4: [["18:30", "22:30"]],
    5: [["18:30", "22:30"]],
    6: [["18:30", "22:30"]]
  },

  /* ---- special schedule for TOMORROW only ------------------------------
     Applied to the next calendar day in Asia/Kolkata, never to any other
     date. Set enabled:false to fall back to the normal hours above. */
  tomorrow: {
    enabled: false,
    windows: [["18:30", "22:30"]],
    note: "Tomorrow the clinic runs a special single session, 6:30 pm to 10:30 pm."
  },

  /* One-off closed days, e.g. { "2026-12-25": "Closed for Christmas" } */
  closedDates: {},

  /* ---- booking rules ---------------------------------------------------- */
  slotStepMinutes: 30,      // appointment slots are offered every 30 minutes
  leadTimeMinutes: 0,       // 0 = every slot still ahead today stays bookable
  horizonDays: 75,          // how far ahead patients may book

  /* ---- optional backend -------------------------------------------------
     Set enabled:true once /api/appointments is deployed with a KV store.
     While it is false the site runs in request mode: the WhatsApp request is
     the booking, availability is not reserved, and the UI says so. */
  api: {
    enabled: false,
    base: ""
  }
};
