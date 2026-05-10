(() => {
  /**
   * @file Application logic orchestrator (no DOM rendering).
   * Maps to:
   * - deadline/core schedule: .cursor/rules/04-deadline-core-logic.mdc
   * - KPI formulas: .cursor/rules/03-kpi-speed-and-formulas.mdc
   * - storage autosave: .cursor/rules/05-localstorage-and-tasks.mdc
   */

  function toDate(value, fallback = new Date()) {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date(fallback) : d;
  }

  function round(value, digits = 2) {
    if (!Number.isFinite(value)) return value;
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
  }

  function requiredFramePerHourForTask(task) {
    return window.Calculator.requiredFramePerHour({
      rank: task.rank,
      framePerHour: task.framePerHour,
    });
  }

  function resolveWorkedHours(task, nowDate) {
    const startAt = toDate(task.startAt, nowDate);
    const now = toDate(nowDate);
    return window.DateTime.workingHoursBetween(startAt, now);
  }

  /**
   * Build a realtime business snapshot for one task.
   * @param {object} task Normalized task.
   * @param {Date} [nowDate] Current datetime.
   * @returns {object} Task KPI + deadline snapshot.
   */
  function buildTaskSnapshot(task, nowDate = new Date()) {
    const requiredFramePerHour = requiredFramePerHourForTask(task);
    const workedHours = resolveWorkedHours(task, nowDate);
    const actualFramePerHour = window.Calculator.actualFramePerHour(task.completedFrames, workedHours);
    const remainingFrames = window.Calculator.remainingFrames(task.totalFrames, task.completedFrames);
    const progressPercent = window.Calculator.progressPercent(task.totalFrames, task.completedFrames);
    const remainingMinutes = window.Calculator.remainingMinutes(
      task.totalFrames,
      task.completedFrames,
      requiredFramePerHour || 0
    );
    const deadlineDate = window.DateTime.estimateDeadline({
      currentDateTime: nowDate,
      totalFrames: task.totalFrames,
      completedFrames: task.completedFrames,
      framePerHour: requiredFramePerHour || 0,
    });
    const kpiStatus = window.Calculator.evaluateKpiStatus({
      actualFramePerHour,
      requiredFramePerHour,
      warningRatio: 0.95,
    });
    const warningMessage =
      kpiStatus === "LATE" ? "RISK OF MISSING KPI 💀" : kpiStatus === "WARNING" ? "KPI WARNING" : "";

    return {
      id: task.id,
      name: task.name,
      rank: task.rank,
      totalFrames: task.totalFrames,
      completedFrames: task.completedFrames,
      remainingFrames,
      progressPercent: round(progressPercent),
      progressWidth: `${round(progressPercent)}%`,
      requiredFramePerHour: requiredFramePerHour == null ? null : round(requiredFramePerHour),
      actualFramePerHour: actualFramePerHour == null ? null : round(actualFramePerHour),
      remainingMinutes: remainingMinutes == null ? null : round(remainingMinutes),
      remainingHours: remainingMinutes == null ? null : round(remainingMinutes / 60),
      workingDaysLeft:
        remainingMinutes == null
          ? null
          : round(remainingMinutes / window.DateTime.WORKING_MINUTES_PER_DAY),
      deadline: deadlineDate ? window.DateTime.formatDateTime(deadlineDate) : null,
      deadlineDate,
      kpiStatus,
      warningMessage,
      now: window.DateTime.formatDateTime(nowDate),
      workedHours: round(workedHours),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startAt: task.startAt,
    };
  }

  function listTaskSnapshots(nowDate = new Date()) {
    const tasks = window.StorageService.loadTasks();
    return tasks.map((task) => buildTaskSnapshot(task, nowDate));
  }

  function createTask(inputTask) {
    const created = window.StorageService.addTask(inputTask);
    return buildTaskSnapshot(created, new Date());
  }

  function editTask(taskId, patch) {
    const updated = window.StorageService.updateTask(taskId, patch);
    return updated ? buildTaskSnapshot(updated, new Date()) : null;
  }

  function updateTaskProgress(taskId, completedFrames) {
    const updated = window.StorageService.updateTaskProgress(taskId, completedFrames);
    return updated ? buildTaskSnapshot(updated, new Date()) : null;
  }

  function removeTask(taskId) {
    return window.StorageService.removeTask(taskId);
  }

  let realtimeTimer = null;

  /**
   * Start 1-second realtime ticker for KPI/deadline snapshots.
   * @param {(snapshots: object[]) => void} listener Callback called every second.
   * @returns {() => void} Stop function.
   */
  function startRealtimeTicker(listener) {
    if (typeof listener !== "function") {
      throw new Error("startRealtimeTicker requires a callback listener.");
    }
    stopRealtimeTicker();

    const emit = () => listener(listTaskSnapshots(new Date()));
    emit();
    realtimeTimer = setInterval(emit, 1000);
    return stopRealtimeTicker;
  }

  function stopRealtimeTicker() {
    if (realtimeTimer != null) {
      clearInterval(realtimeTimer);
      realtimeTimer = null;
    }
  }

  window.KPIApp = {
    createTask,
    editTask,
    updateTaskProgress,
    removeTask,
    listTaskSnapshots,
    buildTaskSnapshot,
    startRealtimeTicker,
    stopRealtimeTicker,
  };
})();
