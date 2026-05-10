/**
 * Lenis — cuộn mượt, tắt khi prefers-reduced-motion.
 * CDN: lenis (global Lenis).
 */
(function () {
  "use strict";

  if (typeof Lenis === "undefined") return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var lenis = new Lenis({
    duration: 1.05,
    easing: function (t) {
      return Math.min(1, 1.001 - Math.pow(2, -10 * t));
    },
    smoothWheel: true,
    smoothTouch: false,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  window.kpiLenis = lenis;
})();
