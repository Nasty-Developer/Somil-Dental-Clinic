/* Somil Dental Clinic — multi-step appointment booking.
   Steps: treatment → date → time → details → review → WhatsApp request.
   All date and time logic runs in clinic time (Asia/Kolkata). */

(function () {
  "use strict";

  var root = document.getElementById("book");
  if (!root) return;

  var cfg = window.SDC || {};
  var TX = window.SDC_TREATMENTS || [];
  var TZ = cfg.timezone || "Asia/Kolkata";
  var WA = cfg.whatsapp || "918591434914";
  var API = cfg.api || { enabled: false, base: "" };

  var STORE_KEYS = { requests: "sdc_appointment_requests" };

  /* ------------------------------------------------------------------ utils */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function clinicParts(d) {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(d);
    var o = {};
    for (var i = 0; i < parts.length; i++) o[parts[i].type] = parts[i].value;
    return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute };
  }
  function keyOf(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }
  function todayKey() { var p = clinicParts(new Date()); return keyOf(p.y, p.m, p.d); }
  function parseKey(k) { var a = k.split("-"); return { y: +a[0], m: +a[1], d: +a[2] }; }
  function addDays(k, n) {
    var p = parseKey(k);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return keyOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  function dowOf(k) { var p = parseKey(k); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  function fmtDate(k, style) {
    var p = parseKey(k);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    var opts = style === "short"
      ? { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
      : { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" };
    return new Intl.DateTimeFormat("en-GB", opts).format(dt);
  }
  function fmtMonth(k) {
    var p = parseKey(k);
    var dt = new Date(Date.UTC(p.y, p.m - 1, 1));
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(dt);
  }
  function fmtTime(mins) {
    var h = Math.floor(mins / 60), m = mins % 60, ap = h >= 12 && h < 24 ? "pm" : "am";
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ":" + pad(m) + " " + ap;
  }
  function hoursLabel(windows) {
    if (!windows || !windows.length) return "Closed";
    return windows.map(function (w) { return fmtTime(w[0]) + " – " + fmtTime(w[1]); }).join(", ");
  }
  function toMin(hhmm) { var a = hhmm.split(":"); return +a[0] * 60 + +a[1]; }

  /* ----------------------------------------------------------------- config */
  function windowsFor(key) {
    if (cfg.closedDates && cfg.closedDates[key]) {
      return { closed: true, reason: cfg.closedDates[key], windows: [] };
    }
    if (dowOf(key) === 0) return { closed: true, reason: "Closed on Sundays", windows: [] };
    var tomorrowKey = addDays(todayKey(), 1);
    if (cfg.tomorrow && cfg.tomorrow.enabled && key === tomorrowKey) {
      return {
        closed: false, special: true, note: cfg.tomorrow.note,
        windows: cfg.tomorrow.windows.map(function (w) { return [toMin(w[0]), toMin(w[1])]; })
      };
    }
    var base = (cfg.hours && cfg.hours[dowOf(key)]) || [];
    if (!base.length) return { closed: true, reason: "Closed", windows: [] };
    return { closed: false, special: false, windows: base.map(function (w) { return [toMin(w[0]), toMin(w[1])]; }) };
  }

  function candidateSlots(key, duration) {
    var info = windowsFor(key);
    if (info.closed) return [];
    var step = cfg.slotStepMinutes || 30;
    var isToday = key === todayKey();
    var now = clinicParts(new Date());
    var earliest = now.hh * 60 + now.mm + (cfg.leadTimeMinutes || 0);
    var seen = {};
    var out = [];
    info.windows.forEach(function (win) {
      for (var m = win[0]; m <= win[1]; m += step) {
        if (seen[m]) continue;
        seen[m] = true;
        /* Every session offers a start time right up to its closing time, so the
           whole evening band (6:30 pm - 10:30 pm) stays bookable for every
           treatment, including the longer ones. Only genuinely past times are
           withheld. */
        var reason = null;
        if (isToday && m < earliest) reason = m < now.hh * 60 + now.mm ? "Time has passed" : "Too soon to book";
        out.push({ start: m, end: m + duration, reason: reason });
      }
    });
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  /* ------------------------------------------------------- local request log
     Requests sent from this device are remembered so the same slot cannot be
     re-submitted here. This is a convenience record, not a reservation. */
  function loadRequests() {
    try { return JSON.parse(localStorage.getItem(STORE_KEYS.requests) || "[]") || []; }
    catch (e) { return []; }
  }
  function saveRequest(rec) {
    try {
      var all = loadRequests();
      all.push(rec);
      localStorage.setItem(STORE_KEYS.requests, JSON.stringify(all.slice(-60)));
    } catch (e) { /* storage may be unavailable; the WhatsApp request still works */ }
  }
  function localHoldFor(key, start) {
    var all = loadRequests();
    for (var i = 0; i < all.length; i++) {
      if (all[i].date === key && all[i].status !== "cancelled") {
        var s = toMin(all[i].time24);
        if (start >= s && start < s + (all[i].duration || 30)) return all[i];
      }
    }
    return null;
  }

  /* -------------------------------------------------------------------- state */
  var state = {
    step: 1,
    treatment: null,
    date: null,
    time: null,
    name: "", phone: "", email: "", message: "",
    ref: null,
    month: null,
    availability: null,     // { booked: {startMinutes:true} } for the chosen date
    availState: "idle",     // idle | loading | ready | error
    availError: ""
  };

  /* ------------------------------------------------------------------- DOM */
  var el = {
    nav: $("#bkNav"),
    panels: {
      1: $('[data-panel="1"]'), 2: $('[data-panel="2"]'), 3: $('[data-panel="3"]'),
      4: $('[data-panel="4"]'), 5: $('[data-panel="5"]'), 6: $('[data-panel="6"]')
    },
    treatments: $("#bkTreatments"),
    calMonth: $("#bkCalMonth"), calDays: $("#bkDays"),
    prev: $("#bkPrev"), next: $("#bkNext"),
    picked: $("#bkPicked"), dayNote: $("#bkDayNote"),
    slotDate: $("#bkSlotDate"), slots: $("#bkSlots"),
    slotsEmpty: $("#bkSlotsEmpty"), slotsLoading: $("#bkSlotsLoading"),
    availNote: $("#bkAvailNote"),
    name: $("#bkName"), phone: $("#bkPhone"), email: $("#bkEmail"), msg: $("#bkMsg"),
    errName: $("#bkErrName"), errPhone: $("#bkErrPhone"), errEmail: $("#bkErrEmail"),
    review: $("#bkReview"), ref: $("#bkRef"), status: $("#bkStatus"), alert: $("#bkAlert"),
    confirm: $("#bkConfirm"), success: $("#bkSuccess"), successRef: $("#bkSuccessRef"),
    successSummary: $("#bkSuccessSummary"), waAgain: $("#bkWaAgain"), live: $("#bkLive"),
    pill: $("#bkPill"),
    txNote: $("#bkTxNote")
  };

  /* ---------------------------------------------------------------- helpers */
  function announce(msg) { if (el.live) el.live.textContent = msg; }

  function treatmentBySlug(slug) {
    for (var i = 0; i < TX.length; i++) if (TX[i].slug === slug) return TX[i];
    return null;
  }
  function treatmentByName(name) {
    if (!name) return null;
    var n = String(name).toLowerCase().replace(/\s+/g, " ").trim();
    for (var i = 0; i < TX.length; i++) {
      var t = TX[i];
      if (t.slug === n || t.bookName.toLowerCase() === n ||
        (t.name || '').toLowerCase() === n) return t;
    }
    var loose = { "root canal": "root-canal", "root canal treatment": "root-canal", "checkup": "checkup",
      "general check up": "checkup", "cleaning": "cleaning", "whitening": "whitening",
      "implants": "implants", "dental implant": "implants", "extraction": "extraction",
      "braces": "aligners", "aligners": "aligners", "consultation": "consultation" };
    return loose[n] ? treatmentBySlug(loose[n]) : null;
  }

  function duration() { return state.treatment ? state.treatment.minutes : 30; }

  function fmtPhone(v) {
    var d = String(v).replace(/[^\d]/g, "");
    if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    return d;
  }
  function phoneValid(v) { return /^[6-9]\d{9}$/.test(fmtPhone(v)); }
  function emailValid(v) { return v === "" || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); }

  /* ------------------------------------------------------------- step 1: UI */
  function renderTreatments() {
    if (!el.treatments) return;
    var frag = document.createDocumentFragment();
    TX.forEach(function (t) {
      var label = document.createElement("label");
      label.className = "bk-opt";
      var id = "bkt-" + t.slug;
      label.innerHTML = '<input type="radio" name="bkTreatment" id="' + id + '" value="' + t.slug + '">' +
        '<span class="bk-opt-in"><b>' + t.bookName + '</b><small>About ' + t.minutes + ' minutes</small></span>';
      frag.appendChild(label);
    });
    el.treatments.appendChild(frag);
    el.treatments.addEventListener("change", function (e) {
      if (e.target && e.target.name === "bkTreatment") {
        state.treatment = treatmentBySlug(e.target.value);
        state.time = null;
        if (state.date) buildSlots();
        refreshNav();
        announce(state.treatment.bookName + " selected");
      }
    });
  }

  function selectTreatment(slug) {
    var t = treatmentBySlug(slug);
    if (!t) return false;
    state.treatment = t;
    var input = document.getElementById("bkt-" + slug);
    if (input) input.checked = true;
    if (el.txNote && el.txNote.firstElementChild) {
      el.txNote.firstElementChild.innerHTML = "<b>" + t.bookName + "</b> is selected. You can change it below.";
    }
    return true;
  }

  /* ------------------------------------------------------------- step 2: UI */
  function monthStart(key) { var p = parseKey(key); return keyOf(p.y, p.m, 1); }
  function firstBookableKey() { return todayKey(); }

  function renderCalendar() {
    if (!el.calDays) return;
    var today = todayKey();
    var horizon = addDays(today, cfg.horizonDays || 75);
    if (!state.month) state.month = monthStart(today);
    var p = parseKey(state.month);
    el.calMonth.textContent = fmtMonth(state.month);

    var firstDow = dowOf(state.month);
    var daysInMonth = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
    el.calDays.innerHTML = "";

    var frag = document.createDocumentFragment();
    for (var i = 0; i < firstDow; i++) {
      var padCell = document.createElement("span");
      padCell.className = "bk-day empty";
      frag.appendChild(padCell);
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var key = keyOf(p.y, p.m, d);
      var info = windowsFor(key);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bk-day";
      btn.dataset.date = key;
      btn.textContent = String(d);
      var disabled = false, labelBits = [fmtDate(key)];

      if (key < today) {
        disabled = true; labelBits.push("past date");
        btn.title = "Past date";
      } else if (key > horizon) {
        disabled = true; labelBits.push("outside booking window");
        btn.title = "Too far ahead";
      } else if (info.closed) {
        disabled = true; labelBits.push(info.reason || "closed");
        btn.title = info.reason || "Closed";
      } else {
        var cands = candidateSlots(key, duration());
        var open = cands.filter(function (s) { return !s.reason; });
        if (!open.length) {
          disabled = true; labelBits.push("no slots left");
          btn.title = "No slots left on this day";
        } else {
          labelBits.push(open.length + " slots");
          var dot = document.createElement("span");
          dot.className = "dot";
          btn.appendChild(dot);
        }
        if (info.special) { btn.dataset.special = "1"; labelBits.push("special hours " + hoursLabel(info.windows)); }
      }
      if (key === today) btn.classList.add("is-today");
      if (disabled) btn.disabled = true;
      btn.setAttribute("aria-label", labelBits.join(", "));
      btn.setAttribute("aria-pressed", state.date === key ? "true" : "false");
      btn.addEventListener("click", function () { pickDate(this.dataset.date); });
      frag.appendChild(btn);
    }
    el.calDays.appendChild(frag);

    el.prev.disabled = state.month <= monthStart(today);
    el.next.disabled = monthStart(horizon) <= state.month;
  }

  function pickDate(key) {
    state.date = key;
    state.time = null;
    state.availability = null;
    renderCalendar();
    renderPicked();
    buildSlots();
    loadAvailability(key);
    refreshNav();
    announce(fmtDate(key) + " selected. Now choose a time.");
  }

  function renderPicked() {
    if (!el.picked) return;
    if (!state.date) {
      el.picked.innerHTML = "<small>No date chosen</small><b>Pick a date on the calendar</b>";
    } else {
      var info = windowsFor(state.date);
      el.picked.innerHTML = "<small>Chosen date</small><b>" + fmtDate(state.date) + "</b>" +
        "<span>" + (info.special ? "Special hours: " : "Clinic hours: ") + hoursLabel(info.windows) + "</span>";
    }
    if (el.dayNote) {
      if (state.date && windowsFor(state.date).special) {
        el.dayNote.hidden = false;
        el.dayNote.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/></svg><div><b>Special schedule.</b> ' +
          (cfg.tomorrow.note || "Tomorrow only, the clinic sees patients 6:30 pm to 10:30 pm.") + '</div>';
      } else {
        el.dayNote.hidden = true;
        el.dayNote.innerHTML = "";
      }
    }
  }

  /* ------------------------------------------------------------- step 3: UI */
  function buildSlots() {
    if (!el.slots) return;
    el.slots.innerHTML = "";
    if (el.slotsEmpty) el.slotsEmpty.hidden = true;
    if (!state.date) {
      if (el.slotsEmpty) { el.slotsEmpty.hidden = false; el.slotsEmpty.textContent = "Pick a date first and the times will appear here."; }
      return;
    }
    if (el.slotDate) el.slotDate.textContent = fmtDate(state.date, "short");
    var info = windowsFor(state.date);
    if (info.closed) {
      if (el.slotsEmpty) { el.slotsEmpty.hidden = false; el.slotsEmpty.textContent = "The clinic is closed on this date (" + (info.reason || "closed") + "). Please choose another day."; }
      if (el.availNote) el.availNote.textContent = "";
      return;
    }
    var booked = (state.availability && state.availability.booked) || {};
    var cands = candidateSlots(state.date, duration());
    var available = 0;
    var frag = document.createDocumentFragment();
    cands.forEach(function (s) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bk-slot";
      btn.textContent = fmtTime(s.start);
      var reason = s.reason;
      /* All nine evening slots stay selectable. Only a real booking recorded
         by the clinic can close a slot; this device's own request history
         never greys anything out. */
      if (!reason && booked[s.start]) reason = "Already booked";
      if (reason) {
        btn.disabled = true;
        btn.title = reason;
        btn.setAttribute("aria-label", fmtTime(s.start) + ", unavailable, " + reason);
        btn.setAttribute("aria-disabled", "true");
      } else {
        available++;
        btn.setAttribute("aria-pressed", state.time === s.start ? "true" : "false");
        btn.setAttribute("aria-label", "Book " + fmtTime(s.start));
        btn.addEventListener("click", function () {
          state.time = s.start;
          $$(".bk-slot", el.slots).forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
          btn.setAttribute("aria-pressed", "true");
          el.slotsEmpty.hidden = true;
          refreshNav();
          announce(fmtTime(s.start) + " selected");
        });
      }
      frag.appendChild(btn);
    });
    el.slots.appendChild(frag);

    if (el.slotsEmpty) {
      if (!cands.length || available === 0) {
        el.slotsEmpty.hidden = false;
        el.slotsEmpty.textContent = state.availability
          ? "Every slot on this date is taken or has passed. Please choose another day."
          : "No slots are left on this date. Please choose another day.";
      } else {
        el.slotsEmpty.hidden = true;
      }
    }
    if (el.availNote) {
      el.availNote.textContent = "Times shown are clinic time (" + TZ.replace("_", " ") + "). Slots are " +
        (cfg.slotStepMinutes || 30) + " minutes apart, every slot up to closing time is open, and this treatment is booked for about " + duration() + " minutes.";
    }
  }

  /* ------------------------------------------------------- availability load */
  function loadAvailability(key) {
    state.availability = null;
    state.availState = API.enabled ? "loading" : "ready";
    state.availError = "";
    if (el.slotsLoading) el.slotsLoading.hidden = !API.enabled;
    if (!API.enabled) return;

    var base = API.base || "";
    fetch(base + "/api/availability?date=" + encodeURIComponent(key), { headers: { accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("availability " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (state.date !== key) return;
        var booked = {};
        (data.booked || []).forEach(function (t) { booked[toMin(t)] = true; });
        (data.blocks || []).forEach(function (b) { booked[toMin(b[0])] = true; });
        state.availability = { booked: booked };
        state.availState = "ready";
        if (el.slotsLoading) el.slotsLoading.hidden = true;
        buildSlots();
        refreshNav();
      })
      .catch(function (err) {
        if (state.date !== key) return;
        state.availState = "error";
        state.availError = "We could not reach the clinic calendar just now.";
        if (el.slotsLoading) el.slotsLoading.hidden = true;
        renderAlert(state.availError + " Please check your connection, or message the clinic on WhatsApp and the team will confirm a time for you.");
        buildSlots();
        refreshNav();
      });
  }

  /* ------------------------------------------------------------- step 4: form */
  function readForm() {
    state.name = el.name ? el.name.value.trim() : "";
    state.phone = el.phone ? el.phone.value.trim() : "";
    state.email = el.email ? el.email.value.trim() : "";
    state.message = el.msg ? el.msg.value.trim() : "";
  }

  function validateForm(showErrors) {
    readForm();
    var errs = {
      name: state.name.length < 2 ? "Please enter the patient's full name." : "",
      phone: !state.phone ? "Please enter a mobile number."
        : (phoneValid(state.phone) ? "" : "Enter a 10-digit Indian mobile number, for example 98765 43210."),
      email: emailValid(state.email) ? "" : "That email address looks incomplete."
    };
    if (showErrors) {
      if (el.errName) el.errName.textContent = errs.name;
      if (el.errPhone) el.errPhone.textContent = errs.phone;
      if (el.errEmail) el.errEmail.textContent = errs.email;
      if (el.name) el.name.setAttribute("aria-invalid", errs.name ? "true" : "false");
      if (el.phone) el.phone.setAttribute("aria-invalid", errs.phone ? "true" : "false");
      if (el.email) el.email.setAttribute("aria-invalid", errs.email ? "true" : "false");
      var firstBad = errs.name ? el.name : (errs.phone ? el.phone : (errs.email ? el.email : null));
      if (firstBad) firstBad.focus();
    }
    return !errs.name && !errs.phone && !errs.email;
  }

  /* ------------------------------------------------------------- step 5: review */
  function renderReview() {
    if (!el.review) return;
    var phone = fmtPhone(state.phone);
    var rows = [
      ["Patient name", state.name, 4],
      ["Mobile number", phone.length === 10 ? "+91 " + phone : state.phone, 4],
      ["Email", state.email || "Not provided", 4],
      ["Treatment", state.treatment ? state.treatment.bookName : "—", 1],
      ["Appointment date", state.date ? fmtDate(state.date) : "—", 2],
      ["Appointment time", state.time !== null ? fmtTime(state.time) : "—", 3],
      ["Additional message", state.message || "None", 4]
    ];
    el.review.innerHTML = rows.map(function (r) {
      return '<div class="rrow"><span>' + r[0] + '</span><b class="' + (r[0] === "Additional message" ? "small" : "") + '">' +
        escapeHtml(r[1]) + '<a class="edit" href="#" data-goto="' + r[2] + '">Edit</a></b></div>';
    }).join("");
    $$("a.edit", el.review).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); goTo(+this.dataset.goto); });
    });
    if (el.ref) el.ref.textContent = state.ref;
    if (el.status) el.status.textContent = "";
    renderAlert("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function renderAlert(msg) {
    if (!el.alert) return;
    if (!msg) { el.alert.hidden = true; el.alert.innerHTML = ""; return; }
    el.alert.hidden = false;
    el.alert.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="width:17px;height:17px;flex:none;margin-top:2px"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/></svg><div>' + msg + "</div>";
  }

  /* ------------------------------------------------------------- whatsapp msg */
  function buildMessage() {
    var phone = fmtPhone(state.phone);
    var lines = [
      "NEW DENTAL APPOINTMENT REQUEST",
      "",
      "Patient Name: " + state.name,
      "Mobile Number: " + (phone.length === 10 ? "+91 " + phone : state.phone),
      "Email: " + (state.email || "Not provided"),
      "",
      "Treatment: " + (state.treatment ? state.treatment.bookName : ""),
      "Appointment Date: " + fmtDate(state.date),
      "Appointment Time: " + fmtTime(state.time),
      "",
      "Additional Message: " + (state.message || "None"),
      "",
      "Status: Pending Confirmation",
      "",
      "Please confirm this appointment.",
      "",
      "Ref: " + state.ref
    ];
    return lines.join("\n");
  }
  function waUrl() {
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(buildMessage());
  }

  function newRef() {
    var p = parseKey(todayKey());
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var s = "";
    for (var i = 0; i < 4; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
    return "SDC-" + String(p.y).slice(2) + pad(p.m) + pad(p.d) + "-" + s;
  }

  /* ------------------------------------------------------------------- steps */
  function stepValid(n) {
    if (n === 1) return !!state.treatment;
    if (n === 2) return !!state.date;
    if (n === 3) return state.time !== null;
    if (n === 4) return validateForm(false);
    return true;
  }

  function refreshNav() {
    $$("#bkNav li").forEach(function (li) {
      var n = +li.dataset.step;
      li.dataset.state = n === state.step ? "active" : (n < state.step ? "done" : "todo");
      var b = li.querySelector("b");
      if (b) b.setAttribute("aria-current", n === state.step ? "step" : "false");
    });
    /* Buttons stay enabled: pressing continue on an incomplete step explains
       what is missing instead of silently doing nothing. */
  }

  function goTo(n, opts) {
    if (n === 5) {
      if (!stepValid(4)) { goTo(4); return; }
      renderReview();
    }
    if (n === 3 && !state.date) n = 2;
    state.step = n;
    Object.keys(el.panels).forEach(function (k) {
      var p = el.panels[k];
      if (p) p.hidden = (+k !== n);
    });
    if (el.success) el.success.hidden = true;
    if (n === 2) renderCalendar();
    if (n === 3) { renderPicked(); buildSlots(); }
    refreshNav();
    var panel = el.panels[n];
    if (panel) {
      var heading = panel.querySelector("h2, h3");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    announce("Step " + n + " of 5");
  }

  /* ------------------------------------------------------------------ submit */
  function reserveOnServer(payload) {
    var base = API.base || "";
    return fetch(base + "/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        return { status: r.status, body: body };
      });
    });
  }

  function onConfirm(e) {
    if (e) e.preventDefault();
    if (!stepValid(4) || !state.date || state.time === null || !state.treatment) return;

    if (!state.ref) state.ref = newRef();
    if (el.ref) el.ref.textContent = state.ref;
    if (el.confirm) el.confirm.disabled = true;
    if (el.status) el.status.textContent = "Opening WhatsApp…";
    renderAlert("");

    var url = waUrl();
    var record = {
      ref: state.ref,
      name: state.name,
      phone: fmtPhone(state.phone),
      email: state.email,
      treatment: state.treatment.bookName,
      treatmentSlug: state.treatment.slug,
      duration: duration(),
      date: state.date,
      time24: pad(Math.floor(state.time / 60)) + ":" + pad(state.time % 60),
      timeLabel: fmtTime(state.time),
      message: state.message,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    /* No backend: the WhatsApp request is the booking. Say so plainly. */
    if (!API.enabled) {
      window.open(url, "_blank", "noopener");
      saveRequest(record);
      showSuccess(record, url, false);
      if (el.confirm) el.confirm.disabled = false;
      return;
    }

    /* Backend enabled: hold the slot atomically first, then open WhatsApp. */
    var win = window.open("", "_blank");
    reserveOnServer({
      ref: record.ref, date: record.date, time: record.time24,
      duration: record.duration, treatment: record.treatment,
      name: record.name, phone: record.phone, email: record.email, message: record.message
    }).then(function (res) {
      if (el.confirm) el.confirm.disabled = false;
      if (res.status === 201 || res.status === 200) {
        saveRequest(record);
        if (win) win.location.href = url; else window.open(url, "_blank", "noopener");
        showSuccess(record, url, true);
        return;
      }
      if (win) win.close();
      if (res.status === 409) {
        state.time = null;
        state.availability = null;
        goTo(3);
        loadAvailability(state.date);
        renderAlert("<b>That slot was just taken.</b> Please choose another time. Nothing has been sent to the clinic.");
      } else {
        renderAlert("<b>We could not hold that slot.</b> " +
          (res.body && res.body.error ? String(res.body.error) : "Please try again in a moment."));
        if (el.status) el.status.textContent = "";
      }
    }).catch(function () {
      if (win) win.close();
      if (el.confirm) el.confirm.disabled = false;
      if (el.status) el.status.textContent = "";
      renderAlert("<b>Network problem.</b> The appointment was not sent. Check your connection and try again, or message the clinic directly on WhatsApp.");
    });
  }

  function showSuccess(record, url, reserved) {
    Object.keys(el.panels).forEach(function (k) { if (el.panels[k]) el.panels[k].hidden = true; });
    if (!el.success) return;
    el.success.hidden = false;
    if (el.successRef) el.successRef.textContent = record.ref;
    if (el.successSummary) {
      el.successSummary.innerHTML =
        '<div class="rrow"><span>Treatment</span><b>' + escapeHtml(record.treatment) + "</b></div>" +
        '<div class="rrow"><span>Date</span><b>' + escapeHtml(fmtDate(record.date)) + "</b></div>" +
        '<div class="rrow"><span>Time</span><b>' + escapeHtml(record.timeLabel) + " (clinic time)</b></div>" +
        '<div class="rrow"><span>Patient</span><b>' + escapeHtml(record.name) + " · " + escapeHtml(record.phone) + "</b></div>";
    }
    if (el.waAgain) el.waAgain.href = url;
    if (el.pill) el.pill.textContent = "Pending clinic confirmation";
    refreshNav();
    el.success.scrollIntoView({ behavior: "smooth", block: "start" });
    var h = el.success.querySelector("h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    announce("Appointment request ready. Status pending clinic confirmation.");
  }

  /* ------------------------------------------------------------------ wiring */
  function init() {
    renderTreatments();

    /* month navigation */
    if (el.prev) el.prev.addEventListener("click", function () {
      var p = parseKey(state.month);
      state.month = keyOf(p.m === 1 ? p.y - 1 : p.y, p.m === 1 ? 12 : p.m - 1, 1);
      renderCalendar();
    });
    if (el.next) el.next.addEventListener("click", function () {
      var p = parseKey(state.month);
      state.month = keyOf(p.m === 12 ? p.y + 1 : p.y, p.m === 12 ? 1 : p.m + 1, 1);
      renderCalendar();
    });

    /* keyboard: arrow keys move between days */
    if (el.calDays) el.calDays.addEventListener("keydown", function (e) {
      var keys = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      var delta = keys[e.key];
      if (!delta) return;
      var days = $$(".bk-day:not(.empty)", el.calDays);
      var i = days.indexOf(document.activeElement);
      if (i < 0) return;
      var j = Math.min(days.length - 1, Math.max(0, i + delta));
      if (days[j] && !days[j].disabled) { e.preventDefault(); days[j].focus(); }
    });

    $$("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var act = btn.dataset.act;
        if (act === "next") {
          if (state.step === 1 && !state.treatment) {
            renderAlert("Choose a treatment to continue.");
            var firstOpt = document.querySelector('#bkTreatments input');
            if (firstOpt) firstOpt.focus();
            return;
          }
          if (state.step === 2 && !state.date) {
            renderAlert("Pick a date on the calendar to continue.");
            var day = document.querySelector('.bk-day:not([disabled])');
            if (day) day.focus();
            return;
          }
          if (state.step === 3 && state.time === null) {
            renderAlert("Pick a time slot to continue.");
            var slot = document.querySelector('.bk-slot:not([disabled])');
            if (slot) slot.focus();
            return;
          }
          if (state.step === 4 && !validateForm(true)) {
            renderAlert("Check the highlighted fields.");
            return;
          }
          renderAlert("");
          goTo(Math.min(5, state.step + 1));
        }
        if (act === "back") goTo(Math.max(1, state.step - 1));
      });
    });

    if (el.confirm) el.confirm.addEventListener("click", onConfirm);

    if (el.name) el.name.addEventListener("input", function () {
      if (this.value.trim().length >= 2 && el.errName) { el.errName.textContent = ""; this.setAttribute("aria-invalid", "false"); }
      refreshNav();
    });
    if (el.phone) {
      el.phone.addEventListener("input", function () {
        if (phoneValid(this.value) && el.errPhone) { el.errPhone.textContent = ""; this.setAttribute("aria-invalid", "false"); }
        refreshNav();
      });
      el.phone.addEventListener("blur", function () { validateForm(true); });
    }
    if (el.email) el.email.addEventListener("input", function () {
      if (emailValid(this.value) && el.errEmail) { el.errEmail.textContent = ""; this.setAttribute("aria-invalid", "false"); }
      refreshNav();
    });
    if (el.msg) el.msg.addEventListener("input", function () { refreshNav(); });

    /* prefill from the URL: /booking?treatment=root-canal */
    var params = new URLSearchParams(location.search);
    var wanted = params.get("treatment") || params.get("t") || location.hash.replace("#", "");
    if (wanted) {
      try {
        var pre = treatmentByName(wanted);
        if (pre) selectTreatment(pre.slug);
      } catch (err) { /* a bad link should never break the flow */ }
    }
    if (params.get("date")) {
      var d = params.get("date");
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayKey()) state.date = d;
    }

    renderCalendar();
    renderPicked();
    buildSlots();
    goTo(1);

    /* keep "today" honest if the tab sits open past midnight */
    setInterval(function () {
      if (state.step === 2) renderCalendar();
    }, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
