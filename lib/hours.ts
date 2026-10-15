// Opening-hours helpers for the tasting night: pick a sensible evening window from a venue's
// real hours, and check a window the agent wrote against them.

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayName = (typeof DAY_NAMES)[number];

/** Minutes since midnight; a venue closing after midnight has close > 24*60. */
export interface OpenWindow {
  open: number;
  close: number;
}

export type WeekWindows = Record<DayName, OpenWindow[]>;

interface RawSlot {
  opens: string | null;
  closes: string | null;
  closed: boolean;
}

const EVENING_START = 17 * 60;
const TASTING_LENGTH = 3 * 60;
const MIN_TASTING_LENGTH = 2 * 60;
// Quiet weekday evenings first: the venue keeps its busy nights.
const DAY_PREFERENCE: DayName[] = ["Tue", "Wed", "Thu", "Mon", "Fri", "Sat", "Sun"];

function toMinutes(value: string | null): number | undefined {
  const match = value?.replace(/^T/, "").match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

/** Qloo's per-day hours as minute windows; undefined if Qloo has no usable hours. */
export function weekWindows(hours: Record<string, RawSlot[]> | undefined): WeekWindows | undefined {
  if (!hours) return undefined;
  const week = {} as WeekWindows;
  let known = false;
  for (const day of DAY_NAMES) {
    const slots = hours[fullName(day)] ?? [];
    week[day] = slots
      .filter((s) => !s.closed)
      .flatMap((s) => {
        const open = toMinutes(s.opens);
        let close = toMinutes(s.closes);
        if (open === undefined || close === undefined) return [];
        if (close <= open) close += 24 * 60;
        return [{ open, close }];
      });
    if (week[day].length > 0) known = true;
  }
  return known ? week : undefined;
}

function fullName(day: DayName): string {
  return { Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday", Fri: "friday", Sat: "saturday", Sun: "sunday" }[day];
}

export function clock(minutes: number): string {
  const m = minutes % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export interface Slot {
  day: DayName;
  start: number;
  end: number;
}

export function formatSlot(slot: Slot): string {
  return `${slot.day} ${clock(slot.start)}–${clock(slot.end)}`;
}

/** The best evening tasting window the venue's hours allow, or undefined if it is never open in the evening. */
export function eveningSlot(week: WeekWindows): Slot | undefined {
  for (const day of DAY_PREFERENCE) {
    for (const w of week[day]) {
      const start = Math.max(w.open, EVENING_START);
      const end = Math.min(w.close, start + TASTING_LENGTH);
      if (end - start >= MIN_TASTING_LENGTH) return { day, start, end };
    }
  }
  return undefined;
}

/** An evening window if there is one, otherwise the best daytime window the hours allow. */
export function suggestTastingSlot(week: WeekWindows): Slot | undefined {
  const evening = eveningSlot(week);
  if (evening) return evening;
  for (const day of DAY_PREFERENCE) {
    for (const w of week[day]) {
      const end = Math.min(w.close, w.open + TASTING_LENGTH);
      if (end - w.open >= MIN_TASTING_LENGTH) return { day, start: w.open, end };
    }
  }
  return undefined;
}

const DAY_PATTERN = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b/i;
const RANGE_PATTERN = /(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/;

/** A day and time window written in free text such as "Week 3, Tue 18:00–21:00", if it has both. */
export function parseSlot(text: string): Slot | undefined {
  const day = text.match(DAY_PATTERN)?.[1];
  const range = text.match(RANGE_PATTERN);
  if (!day || !range) return undefined;
  const start = Number(range[1]) * 60 + Number(range[2]);
  let end = Number(range[3]) * 60 + Number(range[4]);
  if (end <= start) end += 24 * 60;
  const name = DAY_NAMES.find((d) => d.toLowerCase() === day.slice(0, 3).toLowerCase());
  return name ? { day: name, start, end } : undefined;
}

/** Why a slot doesn't work for this venue, or undefined if it does. */
export function slotProblem(slot: Slot, week: WeekWindows): string | undefined {
  const windows = week[slot.day];
  if (windows.length === 0) return `closed on ${slot.day}`;
  if (!windows.some((w) => slot.start >= w.open && slot.end <= w.close)) return "outside opening hours";
  // Before 17:00 only counts as a problem if the venue is open in the evening on some day.
  if (slot.start < EVENING_START && eveningSlot(week)) return "starts before the evening";
  return undefined;
}
