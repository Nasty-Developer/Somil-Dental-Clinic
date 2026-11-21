/* Treatment detail page behaviour: reading progress, scroll reveals, a light
   pointer tilt on the treatment tile. Everything is progressive enhancement —
   with JS off the page is fully readable and every link works. */
(function () {
  'use strict';

  var root = document;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- reading progress ------------------------------------------------- */
  var bar = root.getElementById('txProg');
  if (bar) {
    var ticking = false;
    var paint = function () {
      var h = root.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      bar.style.width = (p * 100).toFixed(2) + '%';
      ticking = false;
    };
    var onScroll = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(paint); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    paint();
  }

  /* ---- scroll reveal with a small stagger ------------------------------- */
  var items = [].slice.call(root.querySelectorAll('.rv'));
  if (!items.length) return;

  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
  } else {
    var seen = 0;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.setProperty('--d', Math.min(seen++ % 4, 3) * 60 + 'ms');
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---- gentle tilt on the treatment tile (fine pointers only) ---------- */
  var visual = root.querySelector('.txd2-visual');
  var thumb = root.querySelector('.txd2-thumb');
  if (thumb && visual && !reduce &&
      window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    visual.addEventListener('pointermove', function (ev) {
      var r = visual.getBoundingClientRect();
      var dx = (ev.clientX - r.left) / r.width - 0.5;
      var dy = (ev.clientY - r.top) / r.height - 0.5;
      thumb.style.transform = 'perspective(700px) rotateX(' + (-dy * 5).toFixed(2) +
        'deg) rotateY(' + (dx * 6).toFixed(2) + 'deg) translateY(-2px)';
    });
    visual.addEventListener('pointerleave', function () {
      thumb.style.transform = '';
    });
  }
})();
