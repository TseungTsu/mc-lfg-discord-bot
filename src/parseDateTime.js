// Lightweight, dependency-free parsing for the /lfg "date" and "time" options.
// Goal: accept a bunch of loose formats humans actually type, and turn them
// into a real Date so we can display it as a proper "Saturday, September 20
// at 3:00 PM" (via Discord's own <t:...> timestamp markdown) instead of just
// echoing back whatever raw text was typed.

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

// Returns { hour, minute } (24h) or null.
function parseTime(input) {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '');

  if (raw === 'noon') return { hour: 12, minute: 0 };
  if (raw === 'midnight') return { hour: 0, minute: 0 };

  // 10:00, 10:00am, 3:30pm, 15:30
  let m = raw.match(/^(\d{1,2}):(\d{2})(am|pm)?$/);
  if (m) return applyMeridiem(Number(m[1]), Number(m[2]), m[3]);

  // 10am, 3pm
  m = raw.match(/^(\d{1,2})(am|pm)$/);
  if (m) return applyMeridiem(Number(m[1]), 0, m[2]);

  // Military-ish: 1000, 930, 0930
  m = raw.match(/^(\d{3,4})$/);
  if (m) {
    const digits = m[1].padStart(4, '0');
    let hour = Number(digits.slice(0, 2));
    const minute = Number(digits.slice(2));
    if (hour <= 23 && minute <= 59) {
      // No am/pm given, so the hour alone is ambiguous. Game stores are only
      // open 10:00-22:00, and any hour under 10 falls outside that window as
      // AM but lands inside it as PM, so assume PM in that case.
      if (hour < 10) hour += 12;
      return { hour, minute };
    }
  }

  return null;
}

function applyMeridiem(hour, minute, meridiem) {
  if (hour < 0 || hour > 23 || minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  }
  return { hour, minute };
}

function isSameCalendarDate(date, month, day) {
  return date.getMonth() === month && date.getDate() === day;
}

// Combines a parsed day + time into a concrete Date, resolving an ambiguous
// (month-less) day to the next upcoming occurrence. Returns { date } or
// { error: 'format' | 'invalid-date' }.
function resolveSchedule(dayInput, timeInput, referenceDate = new Date()) {
  const dayParts = parseDay(dayInput);
  const timeParts = parseTime(timeInput);
  if (!dayParts || !timeParts) return { error: 'format' };

  const { hour, minute } = timeParts;
  const now = referenceDate;

  if (dayParts.weekday !== undefined) {
    let candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    const diffDays = (dayParts.weekday - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + diffDays);
    if (candidate.getTime() < now.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }
    return { date: candidate };
  }

  if (dayParts.month !== undefined) {
    const year = dayParts.year ?? now.getFullYear();
    let candidate = new Date(year, dayParts.month, dayParts.day, hour, minute, 0, 0);
    if (!isSameCalendarDate(candidate, dayParts.month, dayParts.day)) {
      return { error: 'invalid-date' };
    }
    if (dayParts.year === undefined && candidate.getTime() < now.getTime()) {
      candidate = new Date(year + 1, dayParts.month, dayParts.day, hour, minute, 0, 0);
    }
    return { date: candidate };
  }

  // Only a bare day-of-month was given — find the next time it occurs.
  const day = dayParts.day;
  let year = now.getFullYear();
  let month = now.getMonth();
  let candidate = new Date(year, month, day, hour, minute, 0, 0);
  if (!isSameCalendarDate(candidate, month, day)) return { error: 'invalid-date' };

  if (candidate.getTime() < now.getTime()) {
    month += 1;
    candidate = new Date(year, month, day, hour, minute, 0, 0);
    if (!isSameCalendarDate(candidate, month % 12, day)) {
      // e.g. asked for the 31st and next month is shorter — skip ahead once more
      month += 1;
      candidate = new Date(year, month, day, hour, minute, 0, 0);
    }
  }
  return { date: candidate };
}

module.exports = { parseDay, parseTime, resolveSchedule };
