// Lightweight, dependency-free parsing for the /lfg "date" and "time" options.
// Goal: accept a bunch of loose formats humans actually type, and turn them
// into a real Date so we can display it as a proper "Saturday, September 20
// at 3:00 PM" (via Discord's own <t:...> timestamp markdown) instead of just
// echoing back whatever raw text was typed.
//
// Typed times are interpreted in one fixed community timezone (see
// DEFAULT_TIMEZONE), not the timezone of whatever machine the bot runs on.

const DEFAULT_TIMEZONE = 'America/Denver';

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const WEEKDAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

// Returns { day, month?, year? } or { weekday } or null. month is 0-indexed when present.
function parseDay(input) {
  const raw = input.trim().toLowerCase();

  // Weekday name or shorthand: "sunday", "sun", "tue", "thurs"
  if (/^[a-z]+$/.test(raw) && raw.length >= 3) {
    const weekdayIdx = WEEKDAY_NAMES.findIndex(name => name.startsWith(raw));
    if (weekdayIdx !== -1) return { weekday: weekdayIdx };
  }

  // ISO: 2026-09-20
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };

  // 9/20, 9/20/2026, 09-20-26
  m = raw.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    return { year, month: Number(m[1]) - 1, day: Number(m[2]) };
  }

  // "september 20", "sept 20th", "sep 20, 2026"
  m = raw.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/);
  if (m) {
    const monthIdx = MONTH_NAMES.findIndex(name => name.startsWith(m[1]));
    if (monthIdx !== -1) {
      return { year: m[3] ? Number(m[3]) : undefined, month: monthIdx, day: Number(m[2]) };
    }
  }

  // Just a day number: "20", "20th" — month/year resolved by the caller
  // (next upcoming occurrence of that day-of-month).
  m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  if (m) return { day: Number(m[1]) };

  return null;
}

// Returns { hour, minute, explicit } (24h) or null. `explicit` is false when
// the input leaves AM/PM to a guess — e.g. "1000" could be 10 AM or 10 PM —
// and true when it can't be misread: an am/pm suffix, noon/midnight, a
// 24-hour hour (13-23), or a leading zero ("0930", "09:30").
function parseTime(input) {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '');

  if (raw === 'noon') return { hour: 12, minute: 0, explicit: true };
  if (raw === 'midnight') return { hour: 0, minute: 0, explicit: true };

  // 10:00, 10:00am, 3:30pm, 15:30
  let m = raw.match(/^(\d{1,2}):(\d{2})(am|pm)?$/);
  if (m) return applyMeridiem(Number(m[1]), Number(m[2]), m[3], m[1].length === 2 && m[1][0] === '0');

  // 10am, 3pm
  m = raw.match(/^(\d{1,2})(am|pm)$/);
  if (m) return applyMeridiem(Number(m[1]), 0, m[2]);

  // 300pm, 1030pm
  m = raw.match(/^(\d{1,2})(\d{2})(am|pm)$/);
  if (m) return applyMeridiem(Number(m[1]), Number(m[2]), m[3]);

  // Military-ish: 1000, 930, 0930
  m = raw.match(/^(\d{3,4})$/);
  if (m) {
    const digits = m[1].padStart(4, '0');
    let hour = Number(digits.slice(0, 2));
    const minute = Number(digits.slice(2));
    if (hour <= 23 && minute <= 59) {
      const explicit = hour >= 13 || (m[1].length === 4 && m[1][0] === '0');
      // No am/pm given, so the hour alone is ambiguous. Game stores are only
      // open 10:00-22:00, and any hour under 10 falls outside that window as
      // AM but lands inside it as PM, so assume PM in that case — unless a
      // leading zero ("0930") says they meant 24-hour time.
      if (hour < 10 && !explicit) hour += 12;
      return { hour, minute, explicit };
    }
  }

  return null;
}

function applyMeridiem(hour, minute, meridiem, leadingZero = false) {
  if (hour < 0 || hour > 23 || minute > 59) return null;
  const explicit = !!meridiem || hour === 0 || hour >= 13 || leadingZero;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  }
  return { hour, minute, explicit };
}

// --- Timezone helpers ------------------------------------------------------
// Node can format a moment in any IANA timezone (Intl) but can't build a Date
// from wall-clock fields in one, so we do both directions here.

function assertValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new Error(`Invalid TIMEZONE "${timeZone}" — use an IANA name like America/Denver.`);
  }
}

// Wall-clock fields of `date` as seen in `timeZone`. month is 0-indexed,
// weekday is 0 (Sunday) - 6.
function zonedParts(date, timeZone) {
  const fields = {};
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
  }).formatToParts(date);
  for (const p of parts) fields[p.type] = p.value;
  return {
    year: Number(fields.year),
    month: Number(fields.month) - 1,
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(fields.weekday),
  };
}

// How far `timeZone` is ahead of UTC at instant `ts`, in ms (negative for Denver).
function offsetMs(ts, timeZone) {
  const p = zonedParts(new Date(ts), timeZone);
  return Date.UTC(p.year, p.month, p.day, p.hour, p.minute) - Math.floor(ts / 60000) * 60000;
}

// The real instant at which the wall clock in `timeZone` reads the given
// fields. Two passes so the offset is taken at the right side of a DST change.
function wallToDate(year, month, day, hour, minute, timeZone) {
  const wallAsUtc = Date.UTC(year, month, day, hour, minute);
  const first = wallAsUtc - offsetMs(wallAsUtc, timeZone);
  return new Date(wallAsUtc - offsetMs(first, timeZone));
}

// Calendar arithmetic on plain year/month/day (no timezone involved), so
// overflow like "day 35 of September" rolls into the next month correctly.
function normalizeDate(year, month, day) {
  const d = new Date(Date.UTC(year, month, day));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

function isRealDate(year, month, day) {
  const d = normalizeDate(year, month, day);
  return d.month === ((month % 12) + 12) % 12 && d.day === day;
}

// Combines a parsed day + time into a concrete Date, resolving an ambiguous
// (month-less) day to the next upcoming occurrence. All of it is read in
// `timeZone`. With `requireMeridiem`, a time that could be AM or PM is
// rejected instead of guessed. Returns { date } or
// { error: 'format' | 'invalid-date' | 'ambiguous-time' }.
function resolveSchedule(dayInput, timeInput, options = {}) {
  const {
    referenceDate = new Date(),
    timeZone = DEFAULT_TIMEZONE,
    requireMeridiem = false,
  } = options;

  const dayParts = parseDay(dayInput);
  const timeParts = parseTime(timeInput);
  if (!dayParts || !timeParts) return { error: 'format' };
  if (requireMeridiem && !timeParts.explicit) return { error: 'ambiguous-time' };

  const { hour, minute } = timeParts;
  const nowMs = referenceDate.getTime();
  const now = zonedParts(referenceDate, timeZone);
  const at = ({ year, month, day }) => wallToDate(year, month, day, hour, minute, timeZone);

  if (dayParts.weekday !== undefined) {
    const diffDays = (dayParts.weekday - now.weekday + 7) % 7;
    let candidate = at(normalizeDate(now.year, now.month, now.day + diffDays));
    if (candidate.getTime() < nowMs) {
      candidate = at(normalizeDate(now.year, now.month, now.day + diffDays + 7));
    }
    return { date: candidate };
  }

  if (dayParts.month !== undefined) {
    const year = dayParts.year ?? now.year;
    if (!isRealDate(year, dayParts.month, dayParts.day)) return { error: 'invalid-date' };
    let candidate = at({ year, month: dayParts.month, day: dayParts.day });
    if (dayParts.year === undefined && candidate.getTime() < nowMs) {
      candidate = at({ year: year + 1, month: dayParts.month, day: dayParts.day });
    }
    return { date: candidate };
  }

  // Only a bare day-of-month was given — find the next time it occurs.
  const { day } = dayParts;
  if (!isRealDate(now.year, now.month, day)) return { error: 'invalid-date' };

  let candidate = at({ year: now.year, month: now.month, day });
  if (candidate.getTime() < nowMs) {
    // Next month that actually has this day (e.g. skip ahead past a short
    // month when asked for the 31st).
    for (let ahead = 1; ahead <= 3; ahead++) {
      const next = normalizeDate(now.year, now.month + ahead, 1);
      if (isRealDate(next.year, next.month, day)) {
        candidate = at({ year: next.year, month: next.month, day });
        break;
      }
    }
  }
  return { date: candidate };
}

module.exports = {
  DEFAULT_TIMEZONE,
  assertValidTimeZone,
  parseDay,
  parseTime,
  resolveSchedule,
};
