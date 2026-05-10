(() => {
  /**
   * @file KPI math and performance formulas.
   * Non-goal: this module does not access DOM or localStorage.
   * Used by: app logic, task summary, deadline estimation inputs.
   * @see .cursor/rules/03-kpi-speed-and-formulas.mdc
   */

  const WORKING_HOURS_PER_DAY = 8;
  const SPEED_RANKS = Object.freeze({
    A: 900,
    B: 700,
  });

  function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * @param {string} rank Rank name (A/B).
   * @returns {number|null} Frames/day for rank, null if unsupported.
   */
  function framePerDayFromRank(rank) {
    const normalized = String(rank || "")
      .trim()
      .toUpperCase();
    return SPEED_RANKS[normalized] ?? null;
  }

  /**
   * framePerHour = framePerDay / 8
   * @param {number} framePerDay Frames per day.
   * @returns {number} Frames per hour.
   */
  function framePerHourFromDay(framePerDay) {
    const daily = Math.max(toFiniteNumber(framePerDay), 0);
    return daily / WORKING_HOURS_PER_DAY;
  }

  /**
   * @param {string} rank Rank name (A/B).
   * @returns {number|null} Frames per hour derived from rank.
   * @example
   * Calculator.framePerHourFromRank("A"); // 112.5
   */
  function framePerHourFromRank(rank) {
    const perDay = framePerDayFromRank(rank);
    if (perDay == null) return null;
    return framePerHourFromDay(perDay);
  }

  /**
   * framePerMinute = framePerHour / 60
   * @param {number} framePerHour Frames per hour.
   * @returns {number} Frames per minute.
   */
  function framePerMinute(framePerHour) {
    return Math.max(toFiniteNumber(framePerHour), 0) / 60;
  }

  /**
   * framePerSecond = framePerHour / 3600
   * @param {number} framePerHour Frames per hour.
   * @returns {number} Frames per second.
   */
  function framePerSecond(framePerHour) {
    return Math.max(toFiniteNumber(framePerHour), 0) / 3600;
  }

  /**
   * secondsPerFrame = 3600 / framePerHour
   * @param {number} framePerHour Frames per hour.
   * @returns {number|null} Seconds per frame, null when speed is zero.
   */
  function secondsPerFrame(framePerHour) {
    const perHour = Math.max(toFiniteNumber(framePerHour), 0);
    if (perHour <= 0) return null;
    return 3600 / perHour;
  }

  /**
   * minutesNeeded = totalFrames / framePerMinute
   * @param {number} totalFrames Total frames.
   * @param {number} framePerHour Frames per hour.
   * @returns {number|null} Total working minutes required.
   */
  function minutesNeeded(totalFrames, framePerHour) {
    const perMinute = framePerMinute(framePerHour);
    const total = Math.max(toFiniteNumber(totalFrames), 0);
    if (perMinute <= 0) return null;
    return total / perMinute;
  }

  /**
   * remainingFrames = totalFrames - completedFrames
   * @param {number} totalFrames Total frames.
   * @param {number} completedFrames Completed frames.
   * @returns {number} Remaining frames, never negative.
   */
  function remainingFrames(totalFrames, completedFrames) {
    const total = Math.max(toFiniteNumber(totalFrames), 0);
    const completed = clamp(toFiniteNumber(completedFrames), 0, total);
    return total - completed;
  }

  /**
   * remainingMinutes = remainingFrames / framePerMinute
   * @param {number} totalFrames Total frames.
   * @param {number} completedFrames Completed frames.
   * @param {number} framePerHour Frames per hour.
   * @returns {number|null} Remaining working minutes.
   */
  function remainingMinutes(totalFrames, completedFrames, framePerHour) {
    const remain = remainingFrames(totalFrames, completedFrames);
    const perMinute = framePerMinute(framePerHour);
    if (perMinute <= 0) return null;
    return remain / perMinute;
  }

  /**
   * progressPercent = (completedFrames / totalFrames) * 100
   * @param {number} totalFrames Total frames.
   * @param {number} completedFrames Completed frames.
   * @returns {number} Progress percent between 0..100.
   */
  function progressPercent(totalFrames, completedFrames) {
    const total = Math.max(toFiniteNumber(totalFrames), 0);
    if (total === 0) return 0;
    const completed = clamp(toFiniteNumber(completedFrames), 0, total);
    return (completed / total) * 100;
  }

  /**
   * actualFramePerHour = completedFrames / workedHours
   * @param {number} completedFrames Completed frames.
   * @param {number} workedHours Effective worked hours.
   * @returns {number|null} Actual speed (frame/hour), null if workedHours <= 0.
   */
  function actualFramePerHour(completedFrames, workedHours) {
    const hours = Math.max(toFiniteNumber(workedHours), 0);
    if (hours <= 0) return null;
    return Math.max(toFiniteNumber(completedFrames), 0) / hours;
  }

  /**
   * @param {object} params Required speed context.
   * @param {string} [params.rank] Speed rank (A/B).
   * @param {number} [params.framePerDay] Frames/day explicit.
   * @param {number} [params.framePerHour] Frames/hour explicit.
   * @returns {number|null} Required frame/hour.
   */
  function requiredFramePerHour(params = {}) {
    const directPerHour = Math.max(toFiniteNumber(params.framePerHour), 0);
    if (directPerHour > 0) return directPerHour;

    const directPerDay = Math.max(toFiniteNumber(params.framePerDay), 0);
    if (directPerDay > 0) return framePerHourFromDay(directPerDay);

    return framePerHourFromRank(params.rank);
  }

  /**
   * @param {object} params KPI comparison input.
   * @param {number|null} params.actualFramePerHour Current measured speed.
   * @param {number|null} params.requiredFramePerHour Target speed.
   * @param {number} [params.warningRatio=0.95] WARNING threshold ratio.
   * @returns {"ON_TRACK"|"WARNING"|"LATE"} KPI status.
   */
  function evaluateKpiStatus(params = {}) {
    const actual = toFiniteNumber(params.actualFramePerHour, NaN);
    const required = toFiniteNumber(params.requiredFramePerHour, NaN);
    const warningRatio = clamp(toFiniteNumber(params.warningRatio, 0.95), 0, 1);

    if (!Number.isFinite(required) || required <= 0) return "WARNING";
    if (!Number.isFinite(actual) || actual <= 0) return "LATE";
    if (actual >= required) return "ON_TRACK";
    if (actual >= required * warningRatio) return "WARNING";
    return "LATE";
  }

  window.Calculator = {
    WORKING_HOURS_PER_DAY,
    SPEED_RANKS,
    framePerDayFromRank,
    framePerHourFromDay,
    framePerHourFromRank,
    framePerMinute,
    framePerSecond,
    secondsPerFrame,
    minutesNeeded,
    remainingFrames,
    remainingMinutes,
    progressPercent,
    actualFramePerHour,
    requiredFramePerHour,
    evaluateKpiStatus,
  };
})();
