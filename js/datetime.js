(() => {
  /**
   * @file Working-time schedule and deadline algorithm.
   * Non-goal: this module does not access DOM or localStorage.
   * Used by: app logic for deadline, worked hours, and realtime counters.
   * @see .cursor/rules/04-deadline-core-logic.mdc
   * @see .cursor/rules/02-time-work-schedule.mdc
   */

  const SCHEDULE = Object.freeze({
    WORK_START: 8 * 60 + 30, // 08:30
    LUNCH_START: 12 * 60, // 12:00
    LUNCH_END: 13 * 60 + 15, // 13:15
    WORK_END: 17 * 60 + 30, // 17:30
  });
  const WORKING_MINUTES_PER_DAY =
    (SCHEDULE.LUNCH_START - SCHEDULE.WORK_START) + (SCHEDULE.WORK_END - SCHEDULE.LUNCH_END);

  function toDate(value = new Date()) {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
  }

  function setMinutesOfDay(date, totalMinutes) {
    const d = toDate(date);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(totalMinutes);
    return d;
  }

  function getMinutesOfDay(date) {
    const d = toDate(date);
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }

  function isSunday(date) {
    return toDate(date).getDay() === 0;
  }

  function isInsideLunchBreak(date) {
    const minute = getMinutesOfDay(date);
    return minute >= SCHEDULE.LUNCH_START && minute < SCHEDULE.LUNCH_END;
  }

  function isBeforeWork(date) {
    return getMinutesOfDay(date) < SCHEDULE.WORK_START;
  }

  function isAfterWork(date) {
    return getMinutesOfDay(date) >= SCHEDULE.WORK_END;
  }

  function nextMondayAtWorkStart(date) {
    const d = toDate(date);
    const currentDay = d.getDay();
    const daysToMonday = currentDay === 0 ? 1 : (8 - currentDay) % 7;
    d.setDate(d.getDate() + daysToMonday);
    return setMinutesOfDay(d, SCHEDULE.WORK_START);
  }

  function nextWorkingDayAtWorkStart(date) {
    const d = toDate(date);
    d.setDate(d.getDate() + 1);
    return setMinutesOfDay(d, SCHEDULE.WORK_START);
  }

  /**
   * Move datetime into a valid working timestamp:
   * - skip Sunday
   * - skip lunch (12:00-13:00)
   * - skip after work (>=17:30 -> next day 08:30)
   * - normalize before work (<08:30 -> 08:30)
   * @param {Date|string|number} date Raw datetime.
   * @returns {Date} Next valid working datetime.
   */
  function alignToWorkingTime(date) {
    let now = toDate(date);
    while (true) {
      if (isSunday(now)) {
        now = nextMondayAtWorkStart(now);
        continue;
      }
      if (isBeforeWork(now)) {
        now = setMinutesOfDay(now, SCHEDULE.WORK_START);
        continue;
      }
      if (isInsideLunchBreak(now)) {
        now = setMinutesOfDay(now, SCHEDULE.LUNCH_END);
        continue;
      }
      if (isAfterWork(now)) {
        now = nextWorkingDayAtWorkStart(now);
        continue;
      }
      return now;
    }
  }

  function minutesUntilPause(date) {
    const now = alignToWorkingTime(date);
    const minute = getMinutesOfDay(now);
    const nextPauseMinute = minute < SCHEDULE.LUNCH_START ? SCHEDULE.LUNCH_START : SCHEDULE.WORK_END;
    return Math.max(nextPauseMinute - minute, 0);
  }

  function addMinutes(date, minutes) {
    const d = toDate(date);
    d.setTime(d.getTime() + minutes * 60 * 1000);
    return d;
  }

  /**
   * Add only effective working minutes to a datetime.
   * Invariant: remaining minutes always decrease and `current` stays on working time boundaries.
   * @param {Date|string|number} from Start datetime.
   * @param {number} workingMinutes Minutes in working-time domain.
   * @returns {Date} End datetime after skipping lunch/off-hours/Sunday.
   * @example
   * DateTime.addWorkingMinutes("2026-05-10T11:30:00", 120); // skips lunch automatically
   */
  function addWorkingMinutes(from, workingMinutes) {
    let remaining = Math.max(Number(workingMinutes) || 0, 0);
    let current = alignToWorkingTime(from);
    if (remaining <= 0) return current;

    while (remaining > 0) {
      current = alignToWorkingTime(current);
      const available = minutesUntilPause(current);
      if (available <= 0) {
        current = addMinutes(current, 1);
        continue;
      }
      const used = Math.min(remaining, available);
      current = addMinutes(current, used);
      remaining -= used;
    }
    return alignToWorkingTime(current);
  }

  function nextPauseTime(date) {
    const current = alignToWorkingTime(date);
    const minute = getMinutesOfDay(current);
    if (minute < SCHEDULE.LUNCH_START) {
      return setMinutesOfDay(current, SCHEDULE.LUNCH_START);
    }
    return setMinutesOfDay(current, SCHEDULE.WORK_END);
  }

  /**
   * Calculate effective working minutes between two datetimes.
   * @param {Date|string|number} start Start datetime.
   * @param {Date|string|number} end End datetime.
   * @returns {number} Worked minutes in schedule domain.
   */
  function workingMinutesBetween(start, end) {
    const rawStart = toDate(start);
    const rawEnd = toDate(end);
    if (rawEnd <= rawStart) return 0;

    let cursor = alignToWorkingTime(rawStart);
    let total = 0;
    while (cursor < rawEnd) {
      cursor = alignToWorkingTime(cursor);
      if (cursor >= rawEnd) break;
      const pause = nextPauseTime(cursor);
      const chunkEnd = pause < rawEnd ? pause : rawEnd;
      total += (chunkEnd.getTime() - cursor.getTime()) / 60000;
      cursor = chunkEnd;
      if (cursor < rawEnd) cursor = addMinutes(cursor, 1 / 60);
    }
    return Math.max(total, 0);
  }

  /**
   * @param {Date|string|number} start Start datetime.
   * @param {Date|string|number} end End datetime.
   * @returns {number} Worked hours.
   */
  function workingHoursBetween(start, end) {
    return workingMinutesBetween(start, end) / 60;
  }

  /**
   * Estimate task deadline from remaining frames and speed.
   * @param {object} params Deadline input.
   * @param {Date|string|number} params.currentDateTime Current datetime.
   * @param {number} params.totalFrames Total task frames.
   * @param {number} params.completedFrames Completed frames.
   * @param {number} params.framePerHour Speed in frame/hour.
   * @returns {Date|null} Estimated deadline, or null if speed invalid.
   */
  function estimateDeadline(params = {}) {
    const currentDateTime = params.currentDateTime ?? new Date();
    const totalFrames = Math.max(Number(params.totalFrames) || 0, 0);
    const completedFrames = Math.max(Number(params.completedFrames) || 0, 0);
    const framePerHour = Math.max(Number(params.framePerHour) || 0, 0);
    if (framePerHour <= 0) return null;

    const remainingFrames = Math.max(totalFrames - Math.min(completedFrames, totalFrames), 0);
    if (remainingFrames <= 0) return alignToWorkingTime(currentDateTime);

    const framePerMinute = framePerHour / 60;
    const remainingMinutes = remainingFrames / framePerMinute;
    return addWorkingMinutes(currentDateTime, remainingMinutes);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  /**
   * @param {Date|string|number} [value] Input datetime.
   * @returns {string} ISO-like local text "YYYY-MM-DD HH:mm:ss".
   */
  function formatDateTime(value = new Date()) {
    const d = toDate(value);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  window.DateTime = {
    SCHEDULE,
    WORKING_MINUTES_PER_DAY,
    isSunday,
    isInsideLunchBreak,
    isBeforeWork,
    isAfterWork,
    alignToWorkingTime,
    addWorkingMinutes,
    workingMinutesBetween,
    workingHoursBetween,
    estimateDeadline,
    formatDateTime,
    formatNow() {
      return formatDateTime(new Date());
    },
  };
})();
