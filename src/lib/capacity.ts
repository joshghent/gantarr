import type { GanttProject } from "../types";
import { addDays, formatDate, getWorkingDays, parseDate } from "./dates";

/**
 * Capacity tracking. Each task can say how many engineers it occupies
 * (`people`); the project says how many it has (`teamSize`). Tasks
 * without a headcount — design, stakeholder work, anything not drawing on
 * the team — don't count. Load is measured per working day, so weekends
 * never read as over capacity.
 */

export type CapacityLevel = "under" | "at" | "over";

/** Engineers busy on each working day, keyed YYYY-MM-DD. Idle days are absent. */
export function dailyLoad(project: GanttProject): Map<string, number> {
	const load = new Map<string, number>();
	for (const item of project.workItems) {
		const people = item.people ?? 0;
		if (people <= 0) continue;
		for (const day of getWorkingDays(
			parseDate(item.startDate),
			parseDate(item.endDate),
		)) {
			const key = formatDate(day);
			load.set(key, (load.get(key) ?? 0) + people);
		}
	}
	return load;
}

/** Busiest day's load in each column of `days` calendar days. */
export function columnPeaks(
	load: Map<string, number>,
	columns: Date[],
	days: number,
): number[] {
	return columns.map((col) => {
		let peak = 0;
		for (let i = 0; i < days; i++) {
			peak = Math.max(peak, load.get(formatDate(addDays(col, i))) ?? 0);
		}
		return peak;
	});
}

export function capacityLevel(load: number, teamSize: number): CapacityLevel {
	if (load > teamSize) return "over";
	if (load === teamSize) return "at";
	return "under";
}

export interface OverCapacityPeriod {
	startDate: string;
	endDate: string;
	/** Most engineers needed on any day in the period. */
	peak: number;
}

/**
 * Runs of working days that need more engineers than the team has, in
 * date order. A weekend inside a run doesn't split it.
 */
export function overCapacityPeriods(
	project: GanttProject,
): OverCapacityPeriod[] {
	const teamSize = project.teamSize;
	if (!teamSize) return [];
	const over = [...dailyLoad(project)]
		.filter(([, load]) => load > teamSize)
		.sort(([a], [b]) => (a < b ? -1 : 1));

	const periods: OverCapacityPeriod[] = [];
	for (const [day, load] of over) {
		const last = periods[periods.length - 1];
		// Contiguous if no working day separates it from the last run.
		const next =
			last &&
			getWorkingDays(addDays(parseDate(last.endDate), 1), parseDate(day))
				.length === 1;
		if (last && next) {
			last.endDate = day;
			last.peak = Math.max(last.peak, load);
		} else {
			periods.push({ startDate: day, endDate: day, peak: load });
		}
	}
	return periods;
}
