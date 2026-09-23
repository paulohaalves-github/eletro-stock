import { defaultBusinessHours, INBOX_TIMEZONES } from "./constants";

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function normalizeClock(value, fallback = "08:00") {
  const match = String(value || "").trim().match(TIME_RE);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function minutesOf(clock) {
  const [hour, minute] = normalizeClock(clock).split(":").map(Number);
  return hour * 60 + minute;
}

export function normalizeTimezone(value) {
  const timezone = String(value || "").trim();
  if (INBOX_TIMEZONES.some((item) => item.value === timezone)) return timezone;
  return "America/Sao_Paulo";
}

export function normalizeBusinessHours(value) {
  const source = Array.isArray(value) ? value : [];
  return defaultBusinessHours().map((day) => {
    const row = source.find((item) => Number(item?.weekday) === day.weekday) || day;
    return {
      weekday: day.weekday,
      enabled: Boolean(row.enabled),
      start: normalizeClock(row.start, day.start),
      end: normalizeClock(row.end, day.end),
    };
  });
}

export function zonedWeekdayAndMinutes(date = new Date(), timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimezone(timeZone),
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekdayLabel = parts.find((part) => part.type === "weekday")?.value;
  let hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  if (hour === 24) hour = 0;
  return {
    weekday: weekdayMap[weekdayLabel] ?? 0,
    minutes: hour * 60 + minute,
  };
}

export function isWithinBusinessHours(channel, date = new Date()) {
  if (!channel?.businessHoursEnabled) return true;
  const hours = normalizeBusinessHours(channel.businessHours);
  const { weekday, minutes } = zonedWeekdayAndMinutes(date, channel.timezone);
  const day = hours.find((item) => item.weekday === weekday);
  if (!day?.enabled) return false;
  const start = minutesOf(day.start);
  const end = minutesOf(day.end);
  if (start === end) return true;
  if (end > start) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}
