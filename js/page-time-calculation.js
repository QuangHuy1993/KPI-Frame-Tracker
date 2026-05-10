/**
 * @file Time calculation page — wiring form to Calculator + DateTime (same formulas as app).
 * Depends: calculator.js, datetime.js (loaded before this file).
 */
(function () {
  "use strict";

  var WORKING_HOURS_PER_DAY = 8;

  /**
   * Parse datetime-local value as **local** components (avoids UTC quirks in some engines).
   * @param {string} localValue
   */
  function parseDatetimeLocal(localValue) {
    if (!localValue || typeof localValue !== "string") return new Date();
    var m = localValue.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (m) {
      var y = parseInt(m[1], 10);
      var mo = parseInt(m[2], 10) - 1;
      var day = parseInt(m[3], 10);
      var h = parseInt(m[4], 10);
      var mi = parseInt(m[5], 10);
      var sec = m[6] ? parseInt(m[6], 10) : 0;
      var d = new Date(y, mo, day, h, mi, sec, 0);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    var d = new Date(localValue);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /**
   * @param {number} totalMinutes
   * @returns {{ hours: number, minutes: number }}
   */
  function splitHoursMinutes(totalMinutes) {
    var rounded = Math.round(totalMinutes);
    return {
      hours: Math.floor(rounded / 60),
      minutes: rounded % 60,
    };
  }

  function formatDateVi(d) {
    return (
      d.getDate() +
      " tháng " +
      (d.getMonth() + 1) +
      ", " +
      d.getFullYear()
    );
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatTimeClock(d) {
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  /** DD/MM/YYYY HH:mm — giải thích mốc căn giờ */
  function formatDateTimeVi(d) {
    return (
      pad2(d.getDate()) +
      "/" +
      pad2(d.getMonth() + 1) +
      "/" +
      d.getFullYear() +
      " " +
      formatTimeClock(d)
    );
  }

  /** @type {any} */
  var notyfInstance = null;

  /**
   * Notyf — nhẹ, animation mượt (thư viện thứ ba).
   * Tab WIP: type `tab` — nền xanh dương + icon warning (Material Symbols).
   */
  function getNotyf() {
    if (notyfInstance) return notyfInstance;
    if (typeof Notyf === "undefined") return null;

    notyfInstance = new Notyf({
      duration: 3200,
      ripple: true,
      dismissible: false,
      position: { x: "center", y: "top" },
      types: [
        {
          type: "error",
          backgroundColor: "#b91c1c",
          icon: {
            className: "material-symbols-outlined",
            tagName: "span",
            text: "error",
            color: "#ffffff",
          },
        },
        {
          type: "tab",
          className: "kpi-notyf--tab",
          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
          icon: {
            className: "material-symbols-outlined",
            tagName: "span",
            text: "warning",
            color: "#ffffff",
          },
        },
      ],
    });

    return notyfInstance;
  }

  /**
   * @param {string} text
   * @param {"info"|"error"} [variant] info = toast tab (xanh + cảnh báo), error = đỏ
   */
  function showToast(text, variant) {
    variant = variant || "info";
    var n = getNotyf();
    if (!n) {
      window.alert(text);
      return;
    }
    if (variant === "error") {
      n.error({ message: text, duration: 3800 });
      return;
    }
    n.open({ type: "tab", message: text });
  }

  function initForm() {
    var form = document.getElementById("kpi-timecalc-form");
    var startInput = document.getElementById("kpi-timecalc-start");
    var totalFramesInput = document.getElementById("kpi-timecalc-total-frames");
    var framesPerDayInput = document.getElementById("kpi-timecalc-frames-per-day");
    var framesPerHourInput = document.getElementById("kpi-timecalc-frames-per-hour");
    var panelPerDay = document.getElementById("kpi-timecalc-panel-per-day");
    var panelPerHour = document.getElementById("kpi-timecalc-panel-per-hour");
    var modeRadios = form
      ? form.querySelectorAll('input[name="kpiFrameRateMode"]')
      : [];

    var bufferSelect = document.getElementById("kpi-timecalc-buffer");

    var elHours = document.getElementById("kpi-timecalc-result-hours");
    var elMins = document.getElementById("kpi-timecalc-result-minutes");
    var elTime = document.getElementById("kpi-timecalc-result-time");
    var elDate = document.getElementById("kpi-timecalc-result-date");

    var safeWrap = document.getElementById("kpi-timecalc-safe-wrap");
    var safeCaption = document.getElementById("kpi-timecalc-safe-caption");
    var elTimeSafe = document.getElementById("kpi-timecalc-result-time-safe");
    var elDateSafe = document.getElementById("kpi-timecalc-result-date-safe");

    var detailEl = document.getElementById("kpi-timecalc-detail");
    var detailLine1 = document.getElementById("kpi-timecalc-detail-line1");
    var detailLine2 = document.getElementById("kpi-timecalc-detail-line2");
    var detailLine3 = document.getElementById("kpi-timecalc-detail-line3");

    if (!form || !window.Calculator || !window.DateTime) return;

    function showPlaceholder() {
      if (elHours) elHours.textContent = "—";
      if (elMins) elMins.textContent = "—";
      if (elTime) elTime.textContent = "—";
      if (elDate) elDate.textContent = "—";
      if (elTimeSafe) elTimeSafe.textContent = "—";
      if (elDateSafe) elDateSafe.textContent = "—";
      if (safeCaption) safeCaption.textContent = "";
      if (safeWrap) safeWrap.hidden = true;
      if (detailEl) detailEl.hidden = true;
      if (detailLine1) detailLine1.textContent = "";
      if (detailLine2) detailLine2.textContent = "";
      if (detailLine3) {
        detailLine3.textContent = "";
        detailLine3.hidden = true;
      }
    }

    showPlaceholder();

    if (startInput && !startInput.value) {
      var now = new Date();
      var pad = function (n) {
        return String(n).padStart(2, "0");
      };
      startInput.value =
        now.getFullYear() +
        "-" +
        pad(now.getMonth() + 1) +
        "-" +
        pad(now.getDate()) +
        "T" +
        pad(now.getHours()) +
        ":" +
        pad(now.getMinutes());
    }

    function getFrameRateMode() {
      var checked = form.querySelector(
        'input[name="kpiFrameRateMode"]:checked'
      );
      return checked && checked.value === "perHour" ? "perHour" : "perDay";
    }

    function syncRatePanels() {
      var mode = getFrameRateMode();
      var isDay = mode === "perDay";
      if (panelPerDay) panelPerDay.hidden = !isDay;
      if (panelPerHour) panelPerHour.hidden = isDay;
      if (framesPerDayInput) framesPerDayInput.disabled = !isDay;
      if (framesPerHourInput) framesPerHourInput.disabled = isDay;
    }

    modeRadios.forEach(function (radio) {
      radio.addEventListener("change", syncRatePanels);
    });
    syncRatePanels();

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var totalFrames = Number(totalFramesInput && totalFramesInput.value);
      var mode = getFrameRateMode();
      var framePerHour;

      if (!isFinite(totalFrames) || totalFrames <= 0) {
        showToast("Nhập tổng frame cần làm (> 0).", "error");
        return;
      }

      if (mode === "perDay") {
        var framesPerDay = Number(framesPerDayInput && framesPerDayInput.value);
        if (!isFinite(framesPerDay) || framesPerDay <= 0) {
          showToast("Nhập frame hoàn thiện trong ngày (> 0).", "error");
          return;
        }
        framePerHour = framesPerDay / WORKING_HOURS_PER_DAY;
      } else {
        var fph = Number(framesPerHourInput && framesPerHourInput.value);
        if (!isFinite(fph) || fph <= 0) {
          showToast("Nhập số frame làm được trong 1 giờ (> 0).", "error");
          return;
        }
        framePerHour = fph;
      }
      var baseMinutes =
        window.Calculator.minutesNeeded(totalFrames, framePerHour);
      if (baseMinutes == null || !isFinite(baseMinutes)) {
        showToast("Không tính được thời gian.", "error");
        return;
      }

      var bufferPct = Number(bufferSelect && bufferSelect.value) || 100;
      if (!isFinite(bufferPct) || bufferPct <= 0) bufferPct = 100;
      var bufferedMinutes = baseMinutes * (bufferPct / 100);

      var startAt = parseDatetimeLocal(startInput && startInput.value);
      var alignedStart = window.DateTime.alignToWorkingTime(startAt);

      var deadlineBase = window.DateTime.addWorkingMinutes(
        startAt,
        baseMinutes
      );
      var deadlineSafe =
        bufferPct > 100.0001
          ? window.DateTime.addWorkingMinutes(startAt, bufferedMinutes)
          : null;

      var hm = splitHoursMinutes(baseMinutes);

      if (elHours) elHours.textContent = String(hm.hours);
      if (elMins) elMins.textContent = String(hm.minutes);
      if (elTime) elTime.textContent = formatTimeClock(deadlineBase);
      if (elDate) elDate.textContent = formatDateVi(deadlineBase);

      if (bufferPct > 100.0001 && deadlineSafe && safeWrap && elTimeSafe && elDateSafe) {
        safeWrap.hidden = false;
        if (safeCaption) {
          safeCaption.textContent =
            "Đệm " +
            bufferPct +
            "%: dùng " +
            Math.round(bufferedMinutes) +
            " phút làm việc (thay vì " +
            Math.round(baseMinutes) +
            ") trước khi quy đổi sang lịch.";
        }
        elTimeSafe.textContent = formatTimeClock(deadlineSafe);
        elDateSafe.textContent = formatDateVi(deadlineSafe);
      } else if (safeWrap) {
        safeWrap.hidden = true;
      }

      if (detailEl && detailLine1 && detailLine2) {
        detailEl.hidden = false;
        detailLine1.textContent =
          "Phút làm việc cần thiết ≈ " +
          baseMinutes.toFixed(1) +
          " (~" +
          (baseMinutes / 60).toFixed(2) +
          " giờ hiệu quả). Công thức: " +
          totalFrames +
          " frame ÷ (" +
          framePerHour +
          " frame/giờ ÷ 60) = phút làm.";
        detailLine2.textContent =
          "Deadline không cộng liên tục trên đồng hồ: trưa 12:00–13:00, sau 17:30 và Chủ nhật chuyển sang ngày làm tiếp theo.";

        if (detailLine3) {
          var deltaMs = Math.abs(
            alignedStart.getTime() - startAt.getTime()
          );
          if (deltaMs >= 60000) {
            detailLine3.hidden = false;
            detailLine3.textContent =
              "Bạn nhập mốc " +
              formatDateTimeVi(startAt) +
              " — hệ thống chỉ tính tiến độ kể từ " +
              formatDateTimeVi(alignedStart) +
              " (căn ca 08:30–17:30, bỏ qua giờ nghỉ trong ngày).";
          } else {
            detailLine3.hidden = true;
            detailLine3.textContent = "";
          }
        }
      }
    });
  }

  function initTabsToast() {
    var links = document.querySelectorAll(".kpi-timecalc-tabs__link");
    if (!links.length) return;

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        if (link.classList.contains("kpi-timecalc-tabs__link--active")) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        showToast("Đang được phát triển", "info");
      });
    });
  }

  function boot() {
    initForm();
    initTabsToast();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
