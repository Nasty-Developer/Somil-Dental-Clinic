# Somil Dental Clinic

Static marketing + booking site for Somil Dental Clinic, Mumbai (Dr. Somil V Gupta).

- Live: https://somil-dental-clinic.vercel.app
- Hosting: Vercel project `somil-dental-clinic` (team tanustore)
- Stack: plain HTML/CSS/JS, no build step. Pages are pre-built files.
- `api/` holds two Vercel serverless functions (`availability`, `appointments`) that
  power real slot booking. Without a KV store they answer 503 and the site falls back
  to WhatsApp-only request mode, which is the current behaviour.
- `assets/clinic-config.js` is the single source of truth for hours, the special
  next-day schedule, closed dates and the WhatsApp number. `api/_lib.js` mirrors
  those rules for the server side; keep the two in step.
- Deploy: push to `main`, Vercel builds automatically.
