/* GDC Mumbai — motion layer. Adds reveal classes only when JS runs,
   and does nothing when the visitor prefers reduced motion. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;
  root.classList.add('anim');

  // header weight on scroll
  var hdr = document.querySelector('.hdr');
  if (hdr) {
    var setStuck = function () { hdr.classList.toggle('is-stuck', window.scrollY > 8); };
    setStuck();
    addEventListener('scroll', setStuck, { passive: true });
  }

  if (reduce.matches || !('IntersectionObserver' in window)) {
    root.classList.remove('anim');
    return;
  }

  var groups = [
    ['.tcard', 70], ['.txrow', 60], ['.xcard', 60], ['.cstep', 70],
    ['.consult > *', 60], ['.cards > *', 60], ['.specs .spec', 35],
    ['.split > *', 0], ['.about > *', 0], ['.f-grid > *', 60]
  ];
  var targets = [];
  groups.forEach(function (g) {
    document.querySelectorAll(g[0]).forEach(function (el, i) {
      if (el.closest('[data-norev]')) return;
      el.setAttribute('data-rev', '');
      el.style.setProperty('--rd', Math.min(i * g[1], 420) + 'ms');
      targets.push(el);
    });
  });
  document.querySelectorAll('section > .wrap > *:not(.txgrid)').forEach(function (el) {
    if (el.hasAttribute('data-rev')) return;
    el.setAttribute('data-rev', '');
  });
  targets.forEach(function (t) { if (!t.hasAttribute('data-rev')) t.setAttribute('data-rev', ''); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '120px 0px -6% 0px', threshold: 0 });

  document.querySelectorAll('[data-rev]').forEach(function (el) { io.observe(el); });

  // anything already on screen reveals immediately, and a safety sweep runs
  // on scroll so no content can stay hidden if an observer callback is missed
  var sweep = function () {
    document.querySelectorAll('[data-rev]:not(.is-in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      // anything that has reached the viewport (including content the visitor
      // jumped past) is revealed, so scrolling back up never shows a blank
      if (r.top < innerHeight * 0.94) { el.classList.add('is-in'); io.unobserve(el); }
    });
  };
  requestAnimationFrame(sweep);
  setTimeout(sweep, 250);
  setTimeout(sweep, 900);
  addEventListener('scroll', sweep, { passive: true });
  addEventListener('resize', sweep, { passive: true });
  addEventListener('load', sweep);
})();
