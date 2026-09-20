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

// --- Time ranges -----------------------------------------------------------
// "12-4pm", "1200-4", "noon-4pm", "9pm-1am", "3pm to 6pm".

const RANGE_SEPARATOR = /^(.+?)\s*(?:-|–|—|\bto\b)\s*(.+)$/i;

const minutesOf = ({ hour, minute }) => hour * 60 + minute;

// One end of a range. Like parseTime, but also accepts a bare hour ("4") since
// the other end usually supplies the context. Ambiguous ends carry both
// candidate readings (AM and PM) plus the single-time guess `lenient`.
function parseEndpoint(input) {
  const parsed = parseTime(input);
  if (parsed) {
    if (parsed.explicit) return { explicit: true, hour: parsed.hour, minute: parsed.minute };
    return {
      explicit: false,
      lenient: { hour: parsed.hour, minute: parsed.minute },
      candidates: [parsed.hour % 12, (parsed.hour % 12) + 12].map(hour => ({ hour, minute: parsed.minute })),
    };
  }

  const m = input.trim().match(/^(\d{1,2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  if (hour > 23) return null;
  if (hour === 0 || hour >= 13) return { explicit: true, hour, minute: 0 };
  return {
    explicit: false,
    // Same guess as a single time: an hour under 10 is PM (stores are open 10-10).
    lenient: { hour: hour < 10 ? hour + 12 : hour, minute: 0 },
    candidates: [hour % 12, (hour % 12) + 12].map(h => ({ hour: h, minute: 0 })),
  };
}

// Returns null if `input` isn't a range at all (so the caller treats it as a
// single time), { error } if it is one but can't be used, or
// { start, end } as { hour, minute } in 24h time.
//
// A game is always a single day: the end must be later than the start on the
// same day. The one exception is an end of 12:00 AM ("10pm-midnight"), which
// is read as the very end of the start's day and comes back as hour 24.
// Errors: 'format', 'ambiguous-time', 'invalid-range' (same start and end),
// 'overnight' (the end is before the start, so it would run past midnight).
function parseTimeRange(input, { requireMeridiem = false } = {}) {
  const sep = input.trim().match(RANGE_SEPARATOR);
  if (!sep) return null;

  const from = parseEndpoint(sep[1]);
  const to = parseEndpoint(sep[2]);
  if (!from || !to) return { error: 'format' };

  // With am/pm missing on both ends nothing pins the range down; where the
  // caller wants certainty (TTS), don't guess.
  if (!from.explicit && !to.explicit && requireMeridiem) return { error: 'ambiguous-time' };

  const readings = ep => (ep.explicit ? [{ hour: ep.hour, minute: ep.minute }] : ep.candidates);
  const atEndOfDay = (start, end) => (minutesOf(end) === 0 && minutesOf(start) > 0 ? { hour: 24, minute: 0 } : end);

  // Every start/end reading that forms a same-day range.
  const pairs = [];
  let sameTime = false;
  for (const start of readings(from)) {
    for (const rawEnd of readings(to)) {
      const end = atEndOfDay(start, rawEnd);
      if (minutesOf(end) === minutesOf(start)) sameTime = true;
      else if (minutesOf(end) > minutesOf(start)) pairs.push({ start, end });
    }
  }
  // "3-3pm": they typed the same clock time twice, which we won't stretch
  // into a 12-hour range.
  if (sameTime) return { error: 'invalid-range' };
  if (pairs.length === 0) return { error: 'overnight' };

  // Prefer the shortest range ("12-4" is noon to 4 PM, not midnight to 4 PM
  // or noon to 4 AM). When AM and PM read equally short ("12-4" could also be
  // midnight to 4 AM), fall back to the guess a lone start time would get.
  const startGuess = from.explicit ? null : minutesOf(from.lenient);
  const closenessToGuess = p => (startGuess === null ? 0 : Math.abs(minutesOf(p.start) - startGuess));
  pairs.sort((a, b) =>
    (minutesOf(a.end) - minutesOf(a.start)) - (minutesOf(b.end) - minutesOf(b.start))
    || closenessToGuess(a) - closenessToGuess(b));

  return pairs[0];
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
// rejected instead of guessed. The time may be a range ("12-4pm"), in which
// case `endDate` is returned too — always on the same day as `date`. Returns
// { date, endDate? } or { error: 'format' | 'invalid-date' | 'ambiguous-time'
// | 'invalid-range' | 'overnight' }.
function resolveSchedule(dayInput, timeInput, options = {}) {
  const { timeZone = DEFAULT_TIMEZONE, requireMeridiem = false } = options;

  const range = parseTimeRange(timeInput, { requireMeridiem });
  if (range && range.error) return { error: range.error };

  const timeParts = range ? range.start : parseTime(timeInput);
  if (!timeParts) return { error: 'format' };
  if (!range && requireMeridiem && !timeParts.explicit) return { error: 'ambiguous-time' };

  const result = resolveStart(dayInput, timeParts, options);
  if (result.error || !range) return result;

  // The end is on the start's calendar day in the community timezone (hour 24
  // means midnight at the very end of that day).
  const day = zonedParts(result.date, timeZone);
  return {
    date: result.date,
    endDate: wallToDate(day.year, day.month, day.day, range.end.hour, range.end.minute, timeZone),
  };
}

// Resolves the day + a single already-parsed start time to a concrete Date.
function resolveStart(dayInput, timeParts, { referenceDate = new Date(), timeZone = DEFAULT_TIMEZONE } = {}) {
  const dayParts = parseDay(dayInput);
  if (!dayParts) return { error: 'format' };

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
  parseTimeRange,
  resolveSchedule,
};
