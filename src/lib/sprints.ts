import type { GanttProject, SprintSettings } from "../types";
import {
	addDays,
	daysBetween,
	formatDate,
	getMonday,
	parseDate,
} from "./dates";

export const DEFAULT_SPRINT_WEEKS = 2;

/**
 * The project's sprint settings, or sensible defaults when it has none:
 * two-week sprints with sprint 1 starting the Monday of the earliest task
 * (or this week, for an empty project).
 */
export function resolveSprints(project: GanttProject): SprintSettings {
	if (project.sprints) return project.sprints;
	let earliest: string | null = null;
	for (const item of project.workItems) {
		if (earliest === null || item.startDate < earliest)
			earliest = item.startDate;
	}
	const anchor = getMonday(earliest ? parseDate(earliest) : new Date());
	return { lengthWeeks: DEFAULT_SPRINT_WEEKS, startDate: formatDate(anchor) };
}

/** Sprint start dates covering `start`..`end`, aligned to the sprint anchor. */
export function getSprints(
	start: Date,
	end: Date,
	sprints: SprintSettings,
): Date[] {
	const anchor = parseDate(sprints.startDate);
	const len = sprints.lengthWeeks * 7;
	const first = Math.floor(daysBetween(anchor, start) / len);
	const cols: Date[] = [];
	for (let k = first; ; k++) {
		const col = addDays(anchor, k * len);
		if (col > end) break;
		cols.push(col);
	}
	return cols;
}

/** Number of the roadmap's first sprint. */
export function firstSprintNumber(sprints: SprintSettings): number {
	return sprints.firstNumber ?? 1;
}

/**
 * Number of the sprint starting on (or containing) `date`, counting up
 * from the first sprint's number. Sprints before the first one come out
 * below it.
 */
export function sprintNumber(date: Date, sprints: SprintSettings): number {
	const len = sprints.lengthWeeks * 7;
	return (
		Math.floor(daysBetween(parseDate(sprints.startDate), date) / len) +
		firstSprintNumber(sprints)
	);
}
