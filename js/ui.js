(() => {
  /**
   * @file UI flow with 3 tabs:
   * - Tab 1: Work time calculator
   * - Tab 2: Rank/frame requirements config
   * - Tab 3: Member config
   */

  const TAB_WORK = "work";
  const TAB_RANK = "rank";
  const TAB_MEMBER = "member";

  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toDatetimeLocalValue(iso) {
    const d = new Date(iso || Date.now());
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toIsoFromLocal(localValue) {
    const d = new Date(localValue);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  function parseRequirements(input) {
    return String(input || "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((num) => Number.isFinite(num) && num > 0);
  }

  function formatDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) return "0 phut";
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours <= 0) return `${mins} phut`;
    return `${hours} gio ${mins} phut`;
  }

  function getRankConfigs() {
    return window.StorageService.loadRankConfigs();
  }

  function getMembers() {
    return window.StorageService.loadMembers();
  }

  function findRankConfig(rankConfigId) {
    return getRankConfigs().find((cfg) => cfg.id === String(rankConfigId)) || null;
  }

  function resolveMemberFramePerHour(member) {
    if (!member) return 0;
    if (member.framePerHourOverride > 0) return member.framePerHourOverride;
    const rankConfig = findRankConfig(member.rankConfigId);
    if (rankConfig && rankConfig.frameRequirements.length > 0) {
      return rankConfig.frameRequirements[0];
    }
    return window.Calculator.framePerHourFromRank(rankConfig?.rank || "B") || 0;
  }

  function switchTab(tabId) {
    document.querySelectorAll("[data-tab-trigger]").forEach((trigger) => {
      trigger.classList.toggle("is-active", trigger.dataset.tabTrigger === tabId);
    });
    document.querySelectorAll("[data-tab-content]").forEach((content) => {
      content.classList.toggle("hidden", content.dataset.tabContent !== tabId);
    });
  }

  function renderRankOptionsForMemberForm() {
    const select = $("memberRankConfig");
    const configs = getRankConfigs();
    select.innerHTML = "";
    configs.forEach((cfg) => {
      const option = document.createElement("option");
      option.value = cfg.id;
      option.textContent = `${cfg.name} (${cfg.rank})`;
      select.appendChild(option);
    });
  }

  function renderMemberOptionsForWorkForm() {
    const select = $("workMember");
    const members = getMembers();
    select.innerHTML = "";
    if (members.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Chua co thanh vien. Hay them o Tab 3.";
      select.appendChild(option);
      select.disabled = true;
      $("workMemberHint").textContent = "Tab 3 -> them thanh vien truoc khi tinh.";
      $("workFramePerHour").value = "";
      return;
    }

    select.disabled = false;
    members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = member.name;
      select.appendChild(option);
    });
    updateMemberHintAndSpeed();
  }

  function updateMemberHintAndSpeed() {
    const memberId = $("workMember").value;
    const member = getMembers().find((item) => item.id === memberId);
    if (!member) {
      $("workMemberHint").textContent = "Chua chon thanh vien.";
      return;
    }
    const rankConfig = findRankConfig(member.rankConfigId);
    const resolved = resolveMemberFramePerHour(member);
    const requirementText =
      rankConfig && rankConfig.frameRequirements.length > 0
        ? rankConfig.frameRequirements.join(", ")
        : "khong co";

    $("workMemberHint").textContent =
      `Rank: ${rankConfig?.name || "-"} | moc frame/gio: ${requirementText} | mac dinh tinh theo rank: ${resolved} frame/gio (bo qua neu ban bat "Tu nhap toc do").`;
  }

  function syncCustomFramePerHourUi() {
    const wrap = $("workFramePerHourWrap");
    const checked = $("workCustomFramePerHour").checked;
    wrap.classList.toggle("hidden", !checked);
    if (!checked) $("workFramePerHour").value = "";
  }

  function renderRankList() {
    const list = $("rankList");
    const configs = getRankConfigs();
    list.innerHTML = "";
    configs.forEach((cfg) => {
      const li = document.createElement("li");
      li.className = "list__item";
      li.innerHTML = `
        <div class="list__title">${escapeHtml(cfg.name)} (${escapeHtml(cfg.rank)})</div>
        <div class="list__meta">Yeu cau frame/gio: ${escapeHtml(cfg.frameRequirements.join(", "))}</div>
        <div class="list__actions">
          <button type="button" class="btn btn-ghost btn-small" data-rank-edit="${escapeHtml(cfg.id)}">Sua</button>
          <button type="button" class="btn btn-danger btn-small" data-rank-delete="${escapeHtml(cfg.id)}">Xoa</button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  function renderMemberList() {
    const list = $("memberList");
    const members = getMembers();
    list.innerHTML = "";
    members.forEach((member) => {
      const rankConfig = findRankConfig(member.rankConfigId);
      const effectiveSpeed = resolveMemberFramePerHour(member);
      const li = document.createElement("li");
      li.className = "list__item";
      li.innerHTML = `
        <div class="list__title">${escapeHtml(member.name)}</div>
        <div class="list__meta">Rank: ${escapeHtml(rankConfig?.name || "-")} | frame/gio ap dung: ${escapeHtml(effectiveSpeed)}</div>
        <div class="list__actions">
          <button type="button" class="btn btn-ghost btn-small" data-member-edit="${escapeHtml(member.id)}">Sua</button>
          <button type="button" class="btn btn-danger btn-small" data-member-delete="${escapeHtml(member.id)}">Xoa</button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  function resetRankForm() {
    $("rankId").value = "";
    $("rankCode").value = "";
    $("rankName").value = "";
    $("rankRequirements").value = "";
  }

  function resetMemberForm() {
    $("memberId").value = "";
    $("memberName").value = "";
    $("memberFrameOverride").value = "";
    const select = $("memberRankConfig");
    if (select.options.length > 0) select.value = select.options[0].value;
  }

  function bindTabs() {
    document.querySelectorAll("[data-tab-trigger]").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        switchTab(trigger.dataset.tabTrigger);
      });
    });
  }

  function bindWorkTab() {
    $("workMember").addEventListener("change", updateMemberHintAndSpeed);
    $("workCustomFramePerHour").addEventListener("change", syncCustomFramePerHourUi);

    $("workForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const memberId = $("workMember").value;
      const member = getMembers().find((item) => item.id === memberId);
      if (!member) {
        window.alert("Hay chon thanh vien.");
        return;
      }

      const totalFrames = Number($("workTotalFrames").value);
      let framePerHour;
      if ($("workCustomFramePerHour").checked) {
        framePerHour = Number($("workFramePerHour").value);
        if (!Number.isFinite(framePerHour) || framePerHour <= 0) {
          window.alert("Nhap frame/gio hop le hoac bo chon 'Tu nhap toc do'.");
          return;
        }
      } else {
        framePerHour = resolveMemberFramePerHour(member);
        if (!Number.isFinite(framePerHour) || framePerHour <= 0) {
          window.alert("Khong lay duoc toc do tu rank. Hay kiem tra Tab 2 / Tab 3 hoac bat 'Tu nhap toc do'.");
          return;
        }
      }

      if (!Number.isFinite(totalFrames) || totalFrames <= 0) {
        window.alert("Tong frame phai lon hon 0.");
        return;
      }

      const minutes = window.Calculator.minutesNeeded(totalFrames, framePerHour);
      const startAt = toIsoFromLocal($("workStartAt").value);
      const deadline = window.DateTime.addWorkingMinutes(startAt, minutes || 0);
      $("resultDuration").textContent = formatDuration(minutes || 0);
      $("resultDeadline").textContent = window.DateTime.formatDateTime(deadline);
      $("workResult").classList.remove("hidden");
    });
  }

  function bindRankTab() {
    $("rankForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const rank = $("rankCode").value.trim().toUpperCase();
      const name = $("rankName").value.trim();
      const requirements = parseRequirements($("rankRequirements").value);
      if (!rank) {
        window.alert("Nhap rank.");
        return;
      }
      if (!name) {
        window.alert("Nhap ten rank.");
        return;
      }
      if (requirements.length === 0) {
        window.alert("Nhap it nhat 1 moc frame/gio.");
        return;
      }

      window.StorageService.upsertRankConfig({
        id: $("rankId").value || undefined,
        rank,
        name,
        frameRequirements: requirements,
      });

      resetRankForm();
      refreshAllViews();
    });

    $("rankReset").addEventListener("click", resetRankForm);

    $("rankList").addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const editId = target.getAttribute("data-rank-edit");
      const deleteId = target.getAttribute("data-rank-delete");

      if (editId) {
        const cfg = getRankConfigs().find((item) => item.id === editId);
        if (!cfg) return;
        $("rankId").value = cfg.id;
        $("rankCode").value = cfg.rank;
        $("rankName").value = cfg.name;
        $("rankRequirements").value = cfg.frameRequirements.join(", ");
        switchTab(TAB_RANK);
      }

      if (deleteId) {
        const membersUsing = getMembers().some((member) => member.rankConfigId === deleteId);
        if (membersUsing) {
          window.alert("Khong the xoa rank dang duoc thanh vien su dung.");
          return;
        }
        window.StorageService.removeRankConfig(deleteId);
        refreshAllViews();
      }
    });
  }

  function bindMemberTab() {
    $("memberForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("memberName").value.trim();
      const rankConfigId = $("memberRankConfig").value;
      const overrideRaw = $("memberFrameOverride").value.trim();
      const framePerHourOverride = overrideRaw === "" ? 0 : Number(overrideRaw);

      if (!name) {
        window.alert("Nhap ten thanh vien.");
        return;
      }
      if (!rankConfigId) {
        window.alert("Chon rank cho thanh vien.");
        return;
      }
      if (!Number.isFinite(framePerHourOverride) || framePerHourOverride < 0) {
        window.alert("Frame/giơ ca nhan khong hop le.");
        return;
      }

      const memberId = $("memberId").value;
      if (memberId) {
        window.StorageService.updateMember(memberId, {
          name,
          rankConfigId,
          framePerHourOverride,
        });
      } else {
        window.StorageService.addMember({
          name,
          rankConfigId,
          framePerHourOverride,
        });
      }

      resetMemberForm();
      refreshAllViews();
    });

    $("memberReset").addEventListener("click", resetMemberForm);

    $("memberList").addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const editId = target.getAttribute("data-member-edit");
      const deleteId = target.getAttribute("data-member-delete");

      if (editId) {
        const member = getMembers().find((item) => item.id === editId);
        if (!member) return;
        $("memberId").value = member.id;
        $("memberName").value = member.name;
        $("memberRankConfig").value = member.rankConfigId;
        $("memberFrameOverride").value =
          member.framePerHourOverride > 0 ? String(member.framePerHourOverride) : "";
        switchTab(TAB_MEMBER);
      }

      if (deleteId) {
        window.StorageService.removeMember(deleteId);
        refreshAllViews();
      }
    });
  }

  function refreshAllViews() {
    renderRankOptionsForMemberForm();
    renderMemberOptionsForWorkForm();
    renderRankList();
    renderMemberList();
  }

  function initDefaults() {
    window.StorageService.loadRankConfigs();
    if (window.StorageService.loadMembers().length === 0) {
      const rankConfigs = window.StorageService.loadRankConfigs();
      if (rankConfigs.length > 0) {
        window.StorageService.addMember({
          name: "Thanh vien 1",
          rankConfigId: rankConfigs[0].id,
          framePerHourOverride: 0,
        });
      }
    }
  }

  function init() {
    initDefaults();
    $("workStartAt").value = toDatetimeLocalValue(new Date().toISOString());
    $("workCustomFramePerHour").checked = false;
    syncCustomFramePerHourUi();
    bindTabs();
    bindWorkTab();
    bindRankTab();
    bindMemberTab();
    refreshAllViews();
    switchTab(TAB_WORK);
  }

  window.UI = { init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
