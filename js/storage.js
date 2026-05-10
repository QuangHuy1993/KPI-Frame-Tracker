(() => {
  /**
   * @file LocalStorage data access for tasks, rank configs, and members.
   * Non-goal: this module does not render UI.
   * Used by: app logic and configuration tabs.
   * @see .cursor/rules/05-localstorage-and-tasks.mdc
   */

  const TASKS_KEY = "tasks";
  const RANK_CONFIGS_KEY = "rankConfigs";
  const MEMBERS_KEY = "members";

  function nowIso() {
    return new Date().toISOString();
  }

  function randomId() {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeRank(rank) {
    const normalized = String(rank || "B")
      .trim()
      .toUpperCase();
    return normalized || "B";
  }

  function clampCompletedFrames(totalFrames, completedFrames) {
    const total = Math.max(toFiniteNumber(totalFrames), 0);
    const completed = Math.max(toFiniteNumber(completedFrames), 0);
    return Math.min(completed, total);
  }

  /**
   * @param {unknown} input Raw task object.
   * @returns {object} Normalized task with safe defaults.
   */
  function normalizeTask(input) {
    const raw = input && typeof input === "object" ? input : {};
    const rank = normalizeRank(raw.rank);
    const totalFrames = Math.max(toFiniteNumber(raw.totalFrames), 0);
    const completedFrames = clampCompletedFrames(totalFrames, raw.completedFrames);

    const derivedFramePerHour = window.Calculator?.framePerHourFromRank?.(rank) ?? 0;
    const framePerHour = Math.max(toFiniteNumber(raw.framePerHour, derivedFramePerHour), 0);

    const createdAt = raw.createdAt ? new Date(raw.createdAt).toISOString() : nowIso();
    const updatedAt = raw.updatedAt ? new Date(raw.updatedAt).toISOString() : nowIso();
    const startAt = raw.startAt ? new Date(raw.startAt).toISOString() : nowIso();

    return {
      id: String(raw.id || randomId()),
      name: String(raw.name || "Untitled task").trim(),
      rank,
      totalFrames,
      completedFrames,
      framePerHour,
      startAt,
      createdAt,
      updatedAt,
    };
  }

  function parseJson(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function canUseLocalStorage() {
    try {
      const key = "__kpi_probe__";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  const hasLocalStorage = canUseLocalStorage();
  const memoryStore = new Map();

  function rawGet(key) {
    if (hasLocalStorage) return localStorage.getItem(key);
    return memoryStore.has(key) ? memoryStore.get(key) : null;
  }

  function rawSet(key, value) {
    if (hasLocalStorage) {
      localStorage.setItem(key, value);
      return;
    }
    memoryStore.set(key, value);
  }

  function rawRemove(key) {
    if (hasLocalStorage) {
      localStorage.removeItem(key);
      return;
    }
    memoryStore.delete(key);
  }

  function readJson(key, fallback) {
    return parseJson(rawGet(key), fallback);
  }

  function writeJson(key, value) {
    rawSet(key, JSON.stringify(value));
  }

  /**
   * @returns {object[]} Task list loaded from persistent storage.
   */
  function loadTasks() {
    const parsed = parseJson(rawGet(TASKS_KEY), []);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTask);
  }

  /**
   * @param {object[]} tasks Tasks to persist.
   * @returns {object[]} Saved normalized tasks.
   */
  function saveTasks(tasks) {
    const normalized = Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
    writeJson(TASKS_KEY, normalized);
    return normalized;
  }

  /**
   * @param {object} inputTask New task partial input.
   * @returns {object} Created task.
   */
  function addTask(inputTask) {
    const tasks = loadTasks();
    const created = normalizeTask({
      ...inputTask,
      id: inputTask?.id || randomId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    tasks.push(created);
    saveTasks(tasks);
    return created;
  }

  /**
   * @param {string} taskId Target task id.
   * @param {object} patch Task fields to update.
   * @returns {object|null} Updated task, null when not found.
   */
  function updateTask(taskId, patch = {}) {
    const tasks = loadTasks();
    const index = tasks.findIndex((task) => task.id === String(taskId));
    if (index < 0) return null;

    const merged = normalizeTask({
      ...tasks[index],
      ...patch,
      id: tasks[index].id,
      updatedAt: nowIso(),
    });
    tasks[index] = merged;
    saveTasks(tasks);
    return merged;
  }

  /**
   * @param {string} taskId Target task id.
   * @param {number} completedFrames New completed frame count.
   * @returns {object|null} Updated task.
   */
  function updateTaskProgress(taskId, completedFrames) {
    const task = getTaskById(taskId);
    if (!task) return null;
    return updateTask(taskId, {
      completedFrames: clampCompletedFrames(task.totalFrames, completedFrames),
    });
  }

  /**
   * @param {string} taskId Task id.
   * @returns {object|null} Task if found.
   */
  function getTaskById(taskId) {
    const tasks = loadTasks();
    return tasks.find((task) => task.id === String(taskId)) || null;
  }

  /**
   * @param {string} taskId Task id.
   * @returns {boolean} True if removed.
   */
  function removeTask(taskId) {
    const tasks = loadTasks();
    const next = tasks.filter((task) => task.id !== String(taskId));
    if (next.length === tasks.length) return false;
    saveTasks(next);
    return true;
  }

  function clearTasks() {
    rawRemove(TASKS_KEY);
  }

  function normalizeFrameRequirements(input, rank) {
    const list = Array.isArray(input)
      ? input
      : String(input || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    const numbers = list
      .map((value) => Math.max(toFiniteNumber(value), 0))
      .filter((value) => value > 0);
    if (numbers.length > 0) return numbers;

    const defaultFromRank = window.Calculator?.framePerHourFromRank?.(rank);
    return defaultFromRank && defaultFromRank > 0 ? [defaultFromRank] : [];
  }

  function normalizeRankConfig(input) {
    const raw = input && typeof input === "object" ? input : {};
    const rank = normalizeRank(raw.rank);
    return {
      id: String(raw.id || randomId()),
      rank,
      name: String(raw.name || `Rank ${rank}`).trim(),
      frameRequirements: normalizeFrameRequirements(raw.frameRequirements, rank),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : nowIso(),
    };
  }

  function defaultRankConfigs() {
    const a = window.Calculator?.framePerHourFromRank?.("A");
    const b = window.Calculator?.framePerHourFromRank?.("B");
    return [
      normalizeRankConfig({
        id: "rank_A",
        rank: "A",
        name: "Rank A",
        frameRequirements: [a || 112.5],
      }),
      normalizeRankConfig({
        id: "rank_B",
        rank: "B",
        name: "Rank B",
        frameRequirements: [b || 87.5],
      }),
    ];
  }

  /**
   * @returns {object[]} Rank configuration list.
   */
  function loadRankConfigs() {
    const parsed = readJson(RANK_CONFIGS_KEY, []);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = defaultRankConfigs();
      writeJson(RANK_CONFIGS_KEY, defaults);
      return defaults;
    }
    return parsed.map(normalizeRankConfig);
  }

  /**
   * @param {object[]} configs Rank config list.
   * @returns {object[]} Saved rank configs.
   */
  function saveRankConfigs(configs) {
    const normalized = Array.isArray(configs) ? configs.map(normalizeRankConfig) : [];
    writeJson(RANK_CONFIGS_KEY, normalized);
    return normalized;
  }

  /**
   * @param {object} input Rank config partial.
   * @returns {object} Created/updated rank config.
   */
  function upsertRankConfig(input) {
    const configs = loadRankConfigs();
    const normalized = normalizeRankConfig({
      ...input,
      updatedAt: nowIso(),
    });
    const index = configs.findIndex((item) => item.id === normalized.id);
    if (index >= 0) configs[index] = normalized;
    else configs.push(normalized);
    saveRankConfigs(configs);
    return normalized;
  }

  function removeRankConfig(configId) {
    const configs = loadRankConfigs();
    const next = configs.filter((config) => config.id !== String(configId));
    if (next.length === configs.length) return false;
    saveRankConfigs(next);
    return true;
  }

  function normalizeMember(input) {
    const raw = input && typeof input === "object" ? input : {};
    return {
      id: String(raw.id || randomId()),
      name: String(raw.name || "Unnamed member").trim(),
      rankConfigId: String(raw.rankConfigId || ""),
      framePerHourOverride: Math.max(toFiniteNumber(raw.framePerHourOverride), 0),
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : nowIso(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : nowIso(),
    };
  }

  /**
   * @returns {object[]} Members list.
   */
  function loadMembers() {
    const parsed = readJson(MEMBERS_KEY, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeMember);
  }

  /**
   * @param {object[]} members Members list.
   * @returns {object[]} Saved members.
   */
  function saveMembers(members) {
    const normalized = Array.isArray(members) ? members.map(normalizeMember) : [];
    writeJson(MEMBERS_KEY, normalized);
    return normalized;
  }

  function addMember(inputMember) {
    const members = loadMembers();
    const created = normalizeMember({
      ...inputMember,
      id: inputMember?.id || randomId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    members.push(created);
    saveMembers(members);
    return created;
  }

  function updateMember(memberId, patch = {}) {
    const members = loadMembers();
    const index = members.findIndex((member) => member.id === String(memberId));
    if (index < 0) return null;
    const merged = normalizeMember({
      ...members[index],
      ...patch,
      id: members[index].id,
      createdAt: members[index].createdAt,
      updatedAt: nowIso(),
    });
    members[index] = merged;
    saveMembers(members);
    return merged;
  }

  function removeMember(memberId) {
    const members = loadMembers();
    const next = members.filter((member) => member.id !== String(memberId));
    if (next.length === members.length) return false;
    saveMembers(next);
    return true;
  }

  window.StorageService = {
    TASKS_KEY,
    RANK_CONFIGS_KEY,
    MEMBERS_KEY,
    loadTasks,
    saveTasks,
    addTask,
    updateTask,
    updateTaskProgress,
    getTaskById,
    removeTask,
    clearTasks,
    normalizeTask,
    loadRankConfigs,
    saveRankConfigs,
    upsertRankConfig,
    removeRankConfig,
    loadMembers,
    saveMembers,
    addMember,
    updateMember,
    removeMember,
  };
})();
