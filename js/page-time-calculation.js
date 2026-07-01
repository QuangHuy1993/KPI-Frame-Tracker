/**
 * @file Time calculation page — wiring form to Calculator + DateTime, integrating LocalStorage and real-time dashboard.
 * Depends: calculator.js, datetime.js, storage.js (loaded before this file).
 */
(function () {
  "use strict";

  var WORKING_HOURS_PER_DAY = 7.75;

  // Real-time ticker timer id
  var timerTickerInterval = null;

  // Calculation state
  var lastCalculatedData = null;
  var selectedDeadlineType = "base"; // "base" or "safe"

  /**
   * Parse datetime-local value as **local** components.
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

  /** DD/MM/YYYY HH:mm */
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
   * Notyf — 3rd party toast library
   */
  function getNotyf() {
    if (notyfInstance) return notyfInstance;
    if (typeof Notyf === "undefined") return null;

    notyfInstance = new Notyf({
      duration: 3500,
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
            text: "info",
            color: "#ffffff",
          },
        },
      ],
    });

    return notyfInstance;
  }

  /**
   * @param {string} text
   * @param {"info"|"error"} [variant]
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

  // ----------------------------------------------------
  // Seed & Storage Defaults + Migration
  // ----------------------------------------------------
  function initSeedData() {
    // Seed default Ranks if none exist
    var ranks = window.StorageService.loadRankConfigs();
    if (ranks.length === 0) {
      window.StorageService.upsertRankConfig({
        id: "rank_A",
        rank: "A",
        name: "Rank A",
        frameRequirements: [900], // frames per day
      });
      window.StorageService.upsertRankConfig({
        id: "rank_B",
        rank: "B",
        name: "Rank B",
        frameRequirements: [700], // frames per day
      });
    }

    // Seed default Members if none exist
    var members = window.StorageService.loadMembers();
    if (members.length === 0) {
      var freshRanks = window.StorageService.loadRankConfigs();
      var rankAId = freshRanks.find(function (r) { return r.rank === "A"; })?.id || "rank_A";
      var rankBId = freshRanks.find(function (r) { return r.rank === "B"; })?.id || "rank_B";

      window.StorageService.addMember({
        name: "Nguyễn Văn A",
        rankConfigId: rankAId,
        framePerHourOverride: 0,
      });
      window.StorageService.addMember({
        name: "Trần Thị B",
        rankConfigId: rankBId,
        framePerHourOverride: 0,
      });
      window.StorageService.addMember({
        name: "Lê Văn C",
        rankConfigId: rankBId,
        framePerHourOverride: 800, // Speed override (frames per day)
      });
    }

    // --- MIGRATION: Convert old hourly values in localStorage to daily values ---
    var currentRanks = window.StorageService.loadRankConfigs();
    var ranksMigrated = false;
    currentRanks.forEach(function (r) {
      if (r.frameRequirements && r.frameRequirements.length > 0) {
        if (r.frameRequirements[0] < 150) { // If value is small, it was frames per hour
          r.frameRequirements[0] = Math.round(r.frameRequirements[0] * WORKING_HOURS_PER_DAY);
          ranksMigrated = true;
        }
      }
    });
    if (ranksMigrated) {
      window.StorageService.saveRankConfigs(currentRanks);
    }

    var currentMembers = window.StorageService.loadMembers();
    var membersMigrated = false;
    currentMembers.forEach(function (m) {
      if (m.framePerHourOverride > 0 && m.framePerHourOverride < 150) {
        m.framePerHourOverride = Math.round(m.framePerHourOverride * WORKING_HOURS_PER_DAY);
        membersMigrated = true;
      }
    });
    if (membersMigrated) {
      window.StorageService.saveMembers(currentMembers);
    }
  }

  // ----------------------------------------------------
  // Member Dropdown synchronization on Form (Tab 1)
  // ----------------------------------------------------
  function populateMemberDropdown() {
    var select = document.getElementById("kpi-timecalc-member");
    if (!select) return;

    var currentVal = select.value;
    select.innerHTML = "";

    var members = window.StorageService.loadMembers();
    var configs = window.StorageService.loadRankConfigs();

    members.forEach(function (member) {
      var opt = document.createElement("option");
      opt.value = member.id;
      var rankConfig = configs.find(function (c) { return c.id === member.rankConfigId; });
      var rankName = rankConfig ? rankConfig.name : "Khác";
      opt.textContent = member.name + " (" + rankName + ")";
      select.appendChild(opt);
    });

    if (currentVal && Array.from(select.options).some(function (o) { return o.value === currentVal; })) {
      select.value = currentVal;
    } else if (select.options.length > 0) {
      select.selectedIndex = 0;
    }

    updateWorkFormSpeedFromSelectedMember();
  }

  function updateWorkFormSpeedFromSelectedMember() {
    var select = document.getElementById("kpi-timecalc-member");
    if (!select || !select.value) return;

    var memberId = select.value;
    var member = window.StorageService.loadMembers().find(function (m) { return m.id === memberId; });
    if (!member) return;

    // Resolve effective speed per day
    var speedPerDay = 0;
    if (member.framePerHourOverride > 0) {
      speedPerDay = member.framePerHourOverride;
    } else {
      var rankConfig = window.StorageService.loadRankConfigs().find(function (c) { return c.id === member.rankConfigId; });
      if (rankConfig && rankConfig.frameRequirements.length > 0) {
        speedPerDay = rankConfig.frameRequirements[0];
      } else {
        var rankChar = rankConfig ? rankConfig.rank : "B";
        speedPerDay = window.Calculator.framePerDayFromRank(rankChar) || 700;
      }
    }

    var form = document.getElementById("kpi-timecalc-form");
    var checkedRadio = form.querySelector('input[name="kpiFrameRateMode"]:checked');
    var mode = checkedRadio ? checkedRadio.value : "perDay";

    var perDayInput = document.getElementById("kpi-timecalc-frames-per-day");
    var perHourInput = document.getElementById("kpi-timecalc-frames-per-hour");

    if (mode === "perDay") {
      if (perDayInput) {
        perDayInput.value = speedPerDay;
      }
    } else {
      if (perHourInput) {
        perHourInput.value = (speedPerDay / WORKING_HOURS_PER_DAY).toFixed(2);
      }
    }
  }

  // ----------------------------------------------------
  // Form Calculation Init & Wiring
  // ----------------------------------------------------
  function initForm() {
    var form = document.getElementById("kpi-timecalc-form");
    var memberSelect = document.getElementById("kpi-timecalc-member");
    var startInput = document.getElementById("kpi-timecalc-start");
    var totalFramesInput = document.getElementById("kpi-timecalc-total-frames");
    var framesPerDayInput = document.getElementById("kpi-timecalc-frames-per-day");
    var framesPerHourInput = document.getElementById("kpi-timecalc-frames-per-hour");
    var panelPerDay = document.getElementById("kpi-timecalc-panel-per-day");
    var panelPerHour = document.getElementById("kpi-timecalc-panel-per-hour");
    var modeRadios = form ? form.querySelectorAll('input[name="kpiFrameRateMode"]') : [];
    var bufferSelect = document.getElementById("kpi-timecalc-buffer");
    var saveBtn = document.getElementById("kpi-timecalc-save-btn");

    var elHours = document.getElementById("kpi-timecalc-result-hours");
    var elMins = document.getElementById("kpi-timecalc-result-minutes");
    var elTime = document.getElementById("kpi-timecalc-result-time");
    var elDate = document.getElementById("kpi-timecalc-result-date");
    var elMemberName = document.getElementById("kpi-timecalc-result-member");

    var safeWrap = document.getElementById("kpi-timecalc-safe-wrap");
    var safeCaption = document.getElementById("kpi-timecalc-safe-caption");
    var elTimeSafe = document.getElementById("kpi-timecalc-result-time-safe");
    var elDateSafe = document.getElementById("kpi-timecalc-result-date-safe");
    var elMemberNameSafe = document.getElementById("kpi-timecalc-result-member-safe");

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
      if (elMemberName) elMemberName.textContent = "";
      if (elTimeSafe) elTimeSafe.textContent = "—";
      if (elDateSafe) elDateSafe.textContent = "—";
      if (elMemberNameSafe) elMemberNameSafe.textContent = "";
      if (safeCaption) safeCaption.textContent = "";
      if (safeWrap) {
        safeWrap.hidden = true;
        safeWrap.classList.remove("kpi-deadline-card--selected");
      }
      var baseCard = document.getElementById("kpi-card-deadline-base");
      if (baseCard) {
        baseCard.classList.add("kpi-deadline-card--selected");
        var ind = baseCard.querySelector(".kpi-deadline-card__indicator");
        if (ind) ind.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>Đang chọn</span>';
      }
      if (detailEl) detailEl.hidden = true;
      if (detailLine1) detailLine1.textContent = "";
      if (detailLine2) detailLine2.textContent = "";
      if (detailLine3) {
        detailLine3.textContent = "";
        detailLine3.hidden = true;
      }
      if (saveBtn) saveBtn.disabled = true;
      lastCalculatedData = null;
    }

    showPlaceholder();

    if (startInput && !startInput.value) {
      var now = new Date();
      startInput.value =
        now.getFullYear() +
        "-" +
        pad2(now.getMonth() + 1) +
        "-" +
        pad2(now.getDate()) +
        "T" +
        pad2(now.getHours()) +
        ":" +
        pad2(now.getMinutes());
    }

    function getFrameRateMode() {
      var checked = form.querySelector('input[name="kpiFrameRateMode"]:checked');
      return checked && checked.value === "perHour" ? "perHour" : "perDay";
    }

    function syncRatePanels() {
      var mode = getFrameRateMode();
      var isDay = mode === "perDay";
      if (panelPerDay) panelPerDay.hidden = !isDay;
      if (panelPerHour) panelPerHour.hidden = isDay;
      if (framesPerDayInput) framesPerDayInput.disabled = !isDay;
      if (framesPerHourInput) framesPerHourInput.disabled = isDay;
      updateWorkFormSpeedFromSelectedMember();
    }

    modeRadios.forEach(function (radio) {
      radio.addEventListener("change", syncRatePanels);
    });

    if (memberSelect) {
      memberSelect.addEventListener("change", updateWorkFormSpeedFromSelectedMember);
    }

    syncRatePanels();

    // Setup deadline card clicking to choose saving deadline
    var baseCard = document.getElementById("kpi-card-deadline-base");
    var safeCard = document.getElementById("kpi-timecalc-safe-wrap");

    if (baseCard) {
      baseCard.addEventListener("click", function () {
        var bufferPct = Number(bufferSelect && bufferSelect.value) || 100;
        if (bufferPct <= 100) return;
        selectDeadline("base");
      });
    }

    if (safeCard) {
      safeCard.addEventListener("click", function () {
        selectDeadline("safe");
      });
    }

    function selectDeadline(type) {
      selectedDeadlineType = type;
      if (type === "base") {
        if (baseCard) baseCard.classList.add("kpi-deadline-card--selected");
        if (safeCard) safeCard.classList.remove("kpi-deadline-card--selected");

        var indBase = baseCard?.querySelector(".kpi-deadline-card__indicator");
        if (indBase) indBase.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>Đang chọn</span>';

        var indSafe = safeCard?.querySelector(".kpi-deadline-card__indicator");
        if (indSafe) indSafe.innerHTML = '<span class="material-symbols-outlined">radio_button_unchecked</span><span>Chọn</span>';
      } else {
        if (baseCard) baseCard.classList.remove("kpi-deadline-card--selected");
        if (safeCard) safeCard.classList.add("kpi-deadline-card--selected");

        var indBase = baseCard?.querySelector(".kpi-deadline-card__indicator");
        if (indBase) indBase.innerHTML = '<span class="material-symbols-outlined">radio_button_unchecked</span><span>Chọn</span>';

        var indSafe = safeCard?.querySelector(".kpi-deadline-card__indicator");
        if (indSafe) indSafe.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>Đang chọn</span>';
      }
    }

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
      var baseMinutes = window.Calculator.minutesNeeded(totalFrames, framePerHour);
      if (baseMinutes == null || !isFinite(baseMinutes)) {
        showToast("Không tính được thời gian.", "error");
        return;
      }

      var bufferPct = Number(bufferSelect && bufferSelect.value) || 100;
      if (!isFinite(bufferPct) || bufferPct <= 0) bufferPct = 100;
      var bufferedMinutes = baseMinutes * (bufferPct / 100);

      var startAt = parseDatetimeLocal(startInput && startInput.value);
      var alignedStart = window.DateTime.alignToWorkingTime(startAt);

      var deadlineBase = window.DateTime.addWorkingMinutes(startAt, baseMinutes);
      var deadlineSafe = bufferPct > 100.0001
        ? window.DateTime.addWorkingMinutes(startAt, bufferedMinutes)
        : null;

      var hm = splitHoursMinutes(baseMinutes);

      if (elHours) elHours.textContent = String(hm.hours);
      if (elMins) elMins.textContent = String(hm.minutes);
      if (elTime) elTime.textContent = formatTimeClock(deadlineBase);
      if (elDate) elDate.textContent = formatDateVi(deadlineBase);

      // Fetch member name to display beside time
      var selectedMemberId = memberSelect ? memberSelect.value : "";
      var members = window.StorageService.loadMembers();
      var selectedMember = members.find(function (m) { return m.id === selectedMemberId; });
      var memberDisplayName = selectedMember ? " - " + selectedMember.name : "";

      if (elMemberName) elMemberName.textContent = memberDisplayName;

      if (bufferPct > 100.0001 && deadlineSafe && safeWrap && elTimeSafe && elDateSafe) {
        safeWrap.hidden = false;
        if (safeCaption) {
          safeCaption.textContent =
            "Đệm " +
            bufferPct +
            "%: dùng " +
            Math.round(bufferedMinutes) +
            " phút làm (thay vì " +
            Math.round(baseMinutes) +
            ")";
        }
        elTimeSafe.textContent = formatTimeClock(deadlineSafe);
        elDateSafe.textContent = formatDateVi(deadlineSafe);
        if (elMemberNameSafe) elMemberNameSafe.textContent = memberDisplayName;
      } else if (safeWrap) {
        safeWrap.hidden = true;
      }

      // Reset selection state
      selectDeadline("base");

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
          var deltaMs = Math.abs(alignedStart.getTime() - startAt.getTime());
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

      // Cache calculation result
      lastCalculatedData = {
        totalFrames: totalFrames,
        framePerHour: framePerHour,
        startAt: startAt,
        baseDeadline: deadlineBase.toISOString(),
        safeDeadline: deadlineSafe ? deadlineSafe.toISOString() : null,
        bufferPct: bufferPct,
      };

      // Enable save button
      if (saveBtn) saveBtn.disabled = false;
    });

    // Setup Save button click logic
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        if (!lastCalculatedData) return;

        var selectedMemberId = memberSelect ? memberSelect.value : "";
        var members = window.StorageService.loadMembers();
        var selectedMember = members.find(function (m) { return m.id === selectedMemberId; });
        if (!selectedMember) {
          showToast("Vui lòng chọn nhân viên.", "error");
          return;
        }

        var deadlineToSave = selectedDeadlineType === "base"
          ? lastCalculatedData.baseDeadline
          : lastCalculatedData.safeDeadline;

        if (!deadlineToSave) {
          deadlineToSave = lastCalculatedData.baseDeadline;
        }

        // Prepare task payload
        var tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        var newTask = {
          id: "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          name: "KPI Task - " + lastCalculatedData.totalFrames + " frames",
          memberId: selectedMember.id,
          memberName: selectedMember.name,
          totalFrames: lastCalculatedData.totalFrames,
          framePerHour: lastCalculatedData.framePerHour,
          startAt: lastCalculatedData.startAt.toISOString(),
          deadline: deadlineToSave,
          deadlineType: selectedDeadlineType,
          bufferPct: lastCalculatedData.bufferPct,
          createdAt: new Date().toISOString(),
        };

        tasks.push(newTask);
        localStorage.setItem("tasks", JSON.stringify(tasks));

        showToast("Đã lưu tiến độ của " + selectedMember.name + " thành công!", "info");

        // Reset form & states
        form.reset();

        if (startInput) {
          var now = new Date();
          startInput.value =
            now.getFullYear() +
            "-" +
            pad2(now.getMonth() + 1) +
            "-" +
            pad2(now.getDate()) +
            "T" +
            pad2(now.getHours()) +
            ":" +
            pad2(now.getMinutes());
        }

        showPlaceholder();

        // Switch to Member tab
        switchTab("member");
      });
    }
  }

  // ----------------------------------------------------
  // Tab Switching Infrastructure
  // ----------------------------------------------------
  function switchTab(tabId) {
    var triggers = document.querySelectorAll("[data-kpi-tab-trigger]");
    var contents = document.querySelectorAll(".kpi-tab-content");

    triggers.forEach(function (t) {
      if (t.getAttribute("data-kpi-tab-trigger") === tabId) {
        t.classList.add("kpi-timecalc-tabs__link--active");
        t.setAttribute("aria-current", "page");
      } else {
        t.classList.remove("kpi-timecalc-tabs__link--active");
        t.removeAttribute("aria-current");
      }
    });

    contents.forEach(function (c) {
      if (c.id === "kpi-tab-content-" + tabId) {
        c.style.display = "block";
      } else {
        c.style.display = "none";
      }
    });

    // Sub-renders
    if (tabId === "member") {
      renderMemberTab();
    } else if (tabId === "rank") {
      renderRankTab();
    } else if (tabId === "schedule") {
      populateMemberDropdown();
    }
  }

  function initTabs() {
    var triggers = document.querySelectorAll("[data-kpi-tab-trigger]");
    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        var tabId = trigger.getAttribute("data-kpi-tab-trigger");
        switchTab(tabId);
      });
    });
  }

  // ----------------------------------------------------
  // Rank Tab Rendering & Form Submission (Tab 2)
  // ----------------------------------------------------
  function renderRankTab() {
    var rankList = document.getElementById("kpi-rank-list");
    if (!rankList) return;

    rankList.innerHTML = "";
    var configs = window.StorageService.loadRankConfigs();

    configs.forEach(function (cfg) {
      var li = document.createElement("li");
      li.className = "kpi-list-item";
      li.innerHTML = `
        <div class="kpi-list-item__info">
          <span class="kpi-list-item__name">${cfg.name} (${cfg.rank})</span>
          <span class="kpi-list-item__meta">Tốc độ mặc định: ${cfg.frameRequirements.join(", ")} frame/ngày</span>
        </div>
        <div class="kpi-list-item__actions">
          <button type="button" class="kpi-list-item__btn kpi-list-item__btn--danger" data-rank-del-id="${cfg.id}">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `;

      // Click to edit rank handler
      li.addEventListener("click", function (evt) {
        if (evt.target.closest(".kpi-list-item__btn--danger") || evt.target.closest("button")) {
          return;
        }

        document.getElementById("kpi-rank-id").value = cfg.id;
        document.getElementById("kpi-rank-code").value = cfg.rank;
        document.getElementById("kpi-rank-name").value = cfg.name;
        document.getElementById("kpi-rank-requirements").value = cfg.frameRequirements.join(", ");

        var rankForm = document.getElementById("kpi-rank-form");
        var submitBtn = rankForm ? rankForm.querySelector('button[type="submit"]') : null;
        if (submitBtn) {
          submitBtn.innerHTML = '<span class="material-symbols-outlined">edit</span> Cập nhật Rank';
        }
        showToast("Đã chọn Rank " + cfg.rank + " để sửa.", "info");
      });

      rankList.appendChild(li);
    });

    // Delete rank handlers
    var delButtons = rankList.querySelectorAll("[data-rank-del-id]");
    delButtons.forEach(function (btn) {
      btn.addEventListener("click", function (evt) {
        evt.stopPropagation();
        var id = btn.getAttribute("data-rank-del-id");
        var members = window.StorageService.loadMembers();
        var membersUsing = members.some(function (m) { return m.rankConfigId === id; });
        if (membersUsing) {
          showToast("Không thể xóa Rank đang được nhân sự sử dụng.", "error");
          return;
        }
        window.StorageService.removeRankConfig(id);
        showToast("Đã xóa cấu hình Rank.", "info");
        renderRankTab();
      });
    });
  }

  function setupRankForm() {
    var form = document.getElementById("kpi-rank-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var rankId = document.getElementById("kpi-rank-id").value;
      var code = document.getElementById("kpi-rank-code").value.trim().toUpperCase();
      var name = document.getElementById("kpi-rank-name").value.trim();
      var reqsRaw = document.getElementById("kpi-rank-requirements").value.trim();

      if (!code || !name || !reqsRaw) {
        showToast("Vui lòng nhập đầy đủ thông tin Rank.", "error");
        return;
      }

      var speed = Number(reqsRaw);
      if (isNaN(speed) || speed <= 0) {
        showToast("Yêu cầu frame/ngày phải là số lớn hơn 0.", "error");
        return;
      }

      window.StorageService.upsertRankConfig({
        id: rankId || undefined,
        rank: code,
        name: name,
        frameRequirements: [speed],
      });

      if (rankId) {
        showToast("Đã cập nhật cấu hình Rank thành công!", "info");
      } else {
        showToast("Đã thêm cấu hình Rank mới thành công!", "info");
      }

      form.reset();
      document.getElementById("kpi-rank-id").value = "";
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Lưu Rank';
      }
      renderRankTab();
    });

    var resetBtn = document.getElementById("kpi-rank-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        form.reset();
        document.getElementById("kpi-rank-id").value = "";
        var submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Lưu Rank';
        }
      });
    }
  }

  // ----------------------------------------------------
  // Member Tab & Real-time Task Dashboard (Tab 3)
  // ----------------------------------------------------
  function renderMemberRankDropdowns() {
    var memberRankSelect = document.getElementById("kpi-member-rank");
    if (!memberRankSelect) return;

    memberRankSelect.innerHTML = "";
    var configs = window.StorageService.loadRankConfigs();
    configs.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name + " (" + c.rank + ")";
      memberRankSelect.appendChild(opt);
    });

    prefillOverrideSpeedFromSelectedRank();
  }

  function prefillOverrideSpeedFromSelectedRank() {
    var select = document.getElementById("kpi-member-rank");
    var overrideInput = document.getElementById("kpi-member-override");
    if (!select || !overrideInput) return;

    var rankId = select.value;
    var configs = window.StorageService.loadRankConfigs();
    var cfg = configs.find(function (c) { return c.id === rankId; });
    if (cfg && cfg.frameRequirements && cfg.frameRequirements.length > 0) {
      overrideInput.value = cfg.frameRequirements[0];
    } else {
      overrideInput.value = 700;
    }
  }

  function renderMemberList() {
    var list = document.getElementById("kpi-member-list");
    if (!list) return;

    list.innerHTML = "";
    var members = window.StorageService.loadMembers();
    var configs = window.StorageService.loadRankConfigs();

    members.forEach(function (m) {
      var rankCfg = configs.find(function (c) { return c.id === m.rankConfigId; });
      var rankLabel = rankCfg ? rankCfg.name : "-";
      var speedText = m.framePerHourOverride > 0 
        ? m.framePerHourOverride + " f/ngày (tốc độ làm việc)"
        : (rankCfg && rankCfg.frameRequirements.length > 0 ? rankCfg.frameRequirements[0] + " f/ngày" : "-");

      var li = document.createElement("li");
      li.className = "kpi-list-item";
      li.innerHTML = `
        <div class="kpi-list-item__info">
          <span class="kpi-list-item__name">${m.name}</span>
          <span class="kpi-list-item__meta">Rank: ${rankLabel} | Tốc độ: ${speedText}</span>
        </div>
        <div class="kpi-list-item__actions">
          <button type="button" class="kpi-list-item__btn kpi-list-item__btn--danger" data-member-del-id="${m.id}">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `;

      // Click to edit member handler
      li.addEventListener("click", function (evt) {
        if (evt.target.closest(".kpi-list-item__btn--danger") || evt.target.closest("button")) {
          return;
        }

        document.getElementById("kpi-member-id").value = m.id;
        document.getElementById("kpi-member-name").value = m.name;
        document.getElementById("kpi-member-rank").value = m.rankConfigId;
        
        var overrideInput = document.getElementById("kpi-member-override");
        if (overrideInput) {
          if (m.framePerHourOverride > 0) {
            overrideInput.value = m.framePerHourOverride;
          } else {
            var configs = window.StorageService.loadRankConfigs();
            var rankCfg = configs.find(function (c) { return c.id === m.rankConfigId; });
            overrideInput.value = (rankCfg && rankCfg.frameRequirements.length > 0) ? rankCfg.frameRequirements[0] : 700;
          }
        }

        var memberForm = document.getElementById("kpi-member-form");
        var submitBtn = memberForm ? memberForm.querySelector('button[type="submit"]') : null;
        if (submitBtn) {
          submitBtn.innerHTML = '<span class="material-symbols-outlined">edit</span> Cập nhật nhân sự';
        }
        showToast("Đã chọn nhân sự " + m.name + " để sửa.", "info");
      });

      list.appendChild(li);
    });

    // Delete member handlers
    var delButtons = list.querySelectorAll("[data-member-del-id]");
    delButtons.forEach(function (btn) {
      btn.addEventListener("click", function (evt) {
        evt.stopPropagation();
        var id = btn.getAttribute("data-member-del-id");
        window.StorageService.removeMember(id);
        showToast("Đã xóa nhân sự.", "info");
        renderMemberTab();
      });
    });
  }

  function formatRemainingWorkingMinutes(minutes) {
    if (minutes <= 0) return "Đã hết thời gian";
    var rounded = Math.round(minutes);
    var days = Math.floor(rounded / window.DateTime.WORKING_MINUTES_PER_DAY);
    var remainingMins = rounded % window.DateTime.WORKING_MINUTES_PER_DAY;
    var hours = Math.floor(remainingMins / 60);
    var mins = remainingMins % 60;

    var parts = [];
    if (days > 0) parts.push(days + " ngày");
    if (hours > 0) parts.push(hours + " giờ");
    if (mins > 0 || parts.length === 0) parts.push(mins + " phút");

    return "Còn " + parts.join(" ") + " làm việc";
  }

  function formatOverdueMinutes(minutes) {
    var rounded = Math.round(minutes);
    var days = Math.floor(rounded / window.DateTime.WORKING_MINUTES_PER_DAY);
    var remainingMins = rounded % window.DateTime.WORKING_MINUTES_PER_DAY;
    var hours = Math.floor(remainingMins / 60);
    var mins = remainingMins % 60;

    var parts = [];
    if (days > 0) parts.push(days + " ngày");
    if (hours > 0) parts.push(hours + " giờ");
    if (mins > 0 || parts.length === 0) parts.push(mins + " phút");

    return "Đã trễ " + parts.join(" ");
  }

  function updateDashboardTimers() {
    var grid = document.getElementById("kpi-dashboard-grid");
    if (!grid) return;

    var tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    var now = new Date();

    tasks.forEach(function (task) {
      var cardEl = grid.querySelector(`[data-task-card-id="${task.id}"]`);
      if (!cardEl) return;

      var deadline = new Date(task.deadline);
      var countdownTextEl = cardEl.querySelector(".kpi-task-card__countdown-text");
      var badgeEl = cardEl.querySelector(".kpi-task-card__badge");

      if (now >= deadline) {
        // Red color state: Overdue
        cardEl.className = "kpi-task-card kpi-task-card--red";
        if (badgeEl) badgeEl.textContent = "Hết thời gian 💀";
        
        var overdueMins = window.DateTime.workingMinutesBetween(deadline, now);
        var overdueStr = formatOverdueMinutes(overdueMins);
        if (countdownTextEl) countdownTextEl.textContent = overdueStr;
      } else {
        // Working minutes remaining
        var remainMins = window.DateTime.workingMinutesBetween(now, deadline);
        var remainStr = formatRemainingWorkingMinutes(remainMins);
        if (countdownTextEl) countdownTextEl.textContent = remainStr;

        // Color threshold coding (Green if plenty, Yellow if close to deadline <= 4 hours)
        if (remainMins <= 240) {
          cardEl.className = "kpi-task-card kpi-task-card--yellow";
          if (badgeEl) badgeEl.textContent = "Sắp hết thời gian ⚠️";
        } else {
          cardEl.className = "kpi-task-card kpi-task-card--green";
          if (badgeEl) badgeEl.textContent = "Dư thời gian ✅";
        }
      }
    });
  }

  function renderMemberTab() {
    renderMemberRankDropdowns();
    renderMemberList();

    var grid = document.getElementById("kpi-dashboard-grid");
    if (!grid) return;

    var tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    if (tasks.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; color: var(--kpi-timecalc-color-on-surface-variant);">
          <span class="material-symbols-outlined" style="font-size: 48px; color: var(--kpi-timecalc-color-outline-variant); margin-bottom: 12px;">event_busy</span>
          <p style="font-weight: 600; margin: 0;">Chưa có tiến độ nào được lưu</p>
          <p style="font-size: 13px; margin: 4px 0 0; opacity: 0.8;">Hãy qua tab "Tính thời gian" để tạo kịch bản KPI và lưu lại.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = "";
    tasks.forEach(function (task) {
      var card = document.createElement("div");
      card.className = "kpi-task-card";
      card.setAttribute("data-task-card-id", task.id);

      var deadlineDate = new Date(task.deadline);
      var formattedDeadline = formatDateTimeVi(deadlineDate);
      var formattedStart = formatDateTimeVi(new Date(task.startAt));

      card.innerHTML = `
        <div class="kpi-task-card__header">
          <h3 class="kpi-task-card__title">${task.memberName}</h3>
          <span class="kpi-task-card__badge">Đang tải</span>
        </div>
        <div class="kpi-task-card__body">
          <div class="kpi-task-card__row">
            <span>Khối lượng:</span>
            <span class="kpi-task-card__value">${task.totalFrames} frame</span>
          </div>
          <div class="kpi-task-card__row">
            <span>Tốc độ KPI:</span>
            <span class="kpi-task-card__value">${(task.framePerHour * WORKING_HOURS_PER_DAY).toFixed(0)} f/ngày</span>
          </div>
          <div class="kpi-task-card__row">
            <span>Bắt đầu lúc:</span>
            <span class="kpi-task-card__value">${formattedStart}</span>
          </div>
          <div class="kpi-task-card__row">
            <span>Đệm an toàn:</span>
            <span class="kpi-task-card__value">${task.bufferPct}%</span>
          </div>
          <div class="kpi-task-card__deadline-section">
            <div class="kpi-task-card__deadline-label">Hạn hoàn thành ${task.deadlineType === "safe" ? "(An Toàn)" : "(Tiêu Chuẩn)"}</div>
            <div class="kpi-task-card__deadline-value">${formattedDeadline}</div>
          </div>
          <div class="kpi-task-card__countdown">
            <span class="material-symbols-outlined" style="font-size: 18px;">schedule</span>
            <span class="kpi-task-card__countdown-text">Tính toán...</span>
          </div>
        </div>
        <div class="kpi-task-card__footer">
          <button type="button" class="kpi-task-card__btn" data-task-recalc-id="${task.id}">
            <span class="material-symbols-outlined" style="font-size: 16px;">calculate</span> Tính KPI mới
          </button>
          <button type="button" class="kpi-task-card__btn kpi-task-card__btn--danger" data-task-del-id="${task.id}">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span> Xóa
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Recalculate button handler
    var recalcBtns = grid.querySelectorAll("[data-task-recalc-id]");
    recalcBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-task-recalc-id");
        var task = tasks.find(function (t) { return t.id === id; });
        if (!task) return;

        // Switch to tab 1
        switchTab("schedule");

        // Fill form fields
        var memberSelect = document.getElementById("kpi-timecalc-member");
        if (memberSelect) {
          memberSelect.value = task.memberId;
        }

        var totalFramesInput = document.getElementById("kpi-timecalc-total-frames");
        if (totalFramesInput) {
          totalFramesInput.value = task.totalFrames;
        }

        var startInput = document.getElementById("kpi-timecalc-start");
        if (startInput) {
          var d = new Date(task.startAt);
          startInput.value =
            d.getFullYear() +
            "-" +
            pad2(d.getMonth() + 1) +
            "-" +
            pad2(d.getDate()) +
            "T" +
            pad2(d.getHours()) +
            ":" +
            pad2(d.getMinutes());
        }

        var bufferSelect = document.getElementById("kpi-timecalc-buffer");
        if (bufferSelect) {
          bufferSelect.value = task.bufferPct;
        }

        // Trigger change to update speeds
        updateWorkFormSpeedFromSelectedMember();

        // Submit form
        var form = document.getElementById("kpi-timecalc-form");
        if (form) {
          form.dispatchEvent(new Event("submit"));
        }
      });
    });

    // Delete task handler
    var delBtns = grid.querySelectorAll("[data-task-del-id]");
    delBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-task-del-id");
        var nextTasks = tasks.filter(function (t) { return t.id !== id; });
        localStorage.setItem("tasks", JSON.stringify(nextTasks));
        showToast("Đã xóa tiến độ khỏi danh sách.", "info");
        renderMemberTab();
      });
    });

    updateDashboardTimers();
  }

  function setupMemberForm() {
    var form = document.getElementById("kpi-member-form");
    if (!form) return;

    var select = document.getElementById("kpi-member-rank");
    if (select) {
      select.addEventListener("change", prefillOverrideSpeedFromSelectedRank);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var memberId = document.getElementById("kpi-member-id").value;
      var name = document.getElementById("kpi-member-name").value.trim();
      var rankConfigId = document.getElementById("kpi-member-rank").value;
      var overrideRaw = document.getElementById("kpi-member-override").value.trim();

      if (!name || !rankConfigId) {
        showToast("Vui lòng nhập đầy đủ tên nhân viên và Rank.", "error");
        return;
      }

      var enteredOverride = overrideRaw !== "" ? Number(overrideRaw) : 0;
      if (overrideRaw !== "" && (isNaN(enteredOverride) || enteredOverride < 0)) {
        showToast("Tốc độ làm việc không hợp lệ.", "error");
        return;
      }

      // Check if entered override matches the selected Rank's speed
      var configs = window.StorageService.loadRankConfigs();
      var rankCfg = configs.find(function (c) { return c.id === rankConfigId; });
      var rankSpeed = rankCfg && rankCfg.frameRequirements.length > 0 ? rankCfg.frameRequirements[0] : 700;

      var framePerHourOverride = 0;
      if (enteredOverride > 0 && enteredOverride !== rankSpeed) {
        framePerHourOverride = enteredOverride;
      }

      if (memberId) {
        // Update existing member
        window.StorageService.updateMember(memberId, {
          name: name,
          rankConfigId: rankConfigId,
          framePerHourOverride: framePerHourOverride,
        });
        showToast("Đã cập nhật nhân sự thành công!", "info");
      } else {
        // Add new member
        window.StorageService.addMember({
          name: name,
          rankConfigId: rankConfigId,
          framePerHourOverride: framePerHourOverride,
        });
        showToast("Đã lưu nhân sự mới!", "info");
      }

      form.reset();
      document.getElementById("kpi-member-id").value = "";
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = '<span class="material-symbols-outlined">person_add</span> Lưu nhân sự';
      }
      renderMemberTab();
    });

    var resetBtn = document.getElementById("kpi-member-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        form.reset();
        document.getElementById("kpi-member-id").value = "";
        var submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.innerHTML = '<span class="material-symbols-outlined">person_add</span> Lưu nhân sự';
        }
        prefillOverrideSpeedFromSelectedRank();
      });
    }
  }

  // ----------------------------------------------------
  // Initial Boot
  // ----------------------------------------------------
  function boot() {
    initSeedData();
    initTabs();
    initForm();
    setupRankForm();
    setupMemberForm();

    // Populate members in schedule dropdown initially
    populateMemberDropdown();

    // Set up 1-second real-time timer ticker
    if (timerTickerInterval) clearInterval(timerTickerInterval);
    timerTickerInterval = setInterval(updateDashboardTimers, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
