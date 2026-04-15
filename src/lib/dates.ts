/**
 * Date utility functions for the Gantt chart.
 * All dates are working days (Mon-Fri) only.
 */

export function parseDate(dateStr: string): Date {
	const [y, m, d] = dateStr.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function isWeekday(date: Date): boolean {
	const day = date.getDay();
	return day !== 0 && day !== 6;
}

export function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

/** Get all working days between two dates (inclusive) */
export function getWorkingDays(start: Date, end: Date): Date[] {
	const days: Date[] = [];
	const current = new Date(start);
	while (current <= end) {
		if (isWeekday(current)) {
			days.push(new Date(current));
		}
		current.setDate(current.getDate() + 1);
	}
	return days;
}

/** Get every calendar day (including weekends) between two dates, inclusive. */
export function getDays(start: Date, end: Date): Date[] {
	const days: Date[] = [];
	const current = new Date(start);
	while (current <= end) {
		days.push(new Date(current));
		current.setDate(current.getDate() + 1);
	}
	return days;
}

/** Whole calendar days between two dates (ignores time-of-day / DST jitter). */
export function daysBetween(start: Date, end: Date): number {
	const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
	const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
	return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Move to next working day if on a weekend */
export function toWorkingDay(date: Date): Date {
	const result = new Date(date);
	while (!isWeekday(result)) {
		result.setDate(result.getDate() + 1);
	}
	return result;
}

/** Add N working days to a date */
export function addWorkingDays(date: Date, days: number): Date {
	let result = new Date(date);
	let remaining = Math.abs(days);
	const direction = days >= 0 ? 1 : -1;
	while (remaining > 0) {
		result = addDays(result, direction);
		if (isWeekday(result)) {
			remaining--;
		}
	}
	return result;
}

/** Get working day count between two dates (inclusive) */
export function workingDaysBetween(start: Date, end: Date): number {
	return getWorkingDays(start, end).length;
}

/** Get the Monday of the week containing the given date */
export function getMonday(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return d;
}

/** Get all weeks (as Monday dates) between start and end */
export function getWeeks(start: Date, end: Date): Date[] {
	const weeks: Date[] = [];
	let current = getMonday(start);
	while (current <= end) {
		weeks.push(new Date(current));
		current = addDays(current, 7);
	}
	return weeks;
}

export function formatShortDate(date: Date): string {
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	return `${date.getDate()} ${months[date.getMonth()]}`;
}

export function formatMonthYear(date: Date): string {
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDayName(date: Date): string {
	return DAY_NAMES[date.getDay()];
}

/** Get today's date as YYYY-MM-DD */
export function today(): string {
	return formatDate(new Date());
}
