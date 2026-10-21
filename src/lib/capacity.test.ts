import { describe, expect, it } from "vitest";
import type { GanttProject, WorkItem } from "../types";
import {
	capacityLevel,
	columnPeaks,
	dailyLoad,
	overCapacityPeriods,
} from "./capacity";
import { parseDate } from "./dates";

function task(startDate: string, endDate: string, people?: number): WorkItem {
	return {
		id: `${startDate}-${endDate}-${people}`,
		workstreamId: "ws",
		title: "t",
		startDate,
		endDate,
		legendEntryId: null,
		order: 0,
		people,
	};
}

function project(workItems: WorkItem[], teamSize?: number): GanttProject {
	return {
		id: "p",
		name: "P",
		workstreams: [{ id: "ws", label: "W", order: 0, color: "#000" }],
		workItems,
		dependencies: [],
		legend: [],
		teamSize,
		createdAt: "",
		updatedAt: "",
	};
}

describe("dailyLoad", () => {
	it("sums headcount per working day and skips weekends", () => {
		// Fri 6 Nov – Mon 9 Nov 2026
		const load = dailyLoad(
			project([
				task("2026-11-06", "2026-11-09", 2),
				task("2026-11-09", "2026-11-09", 1),
			]),
		);
		expect(Object.fromEntries(load)).toEqual({
			"2026-11-06": 2,
			"2026-11-09": 3,
		});
	});

	it("ignores tasks without a headcount", () => {
		expect(dailyLoad(project([task("2026-11-02", "2026-11-06")])).size).toBe(0);
	});
});

describe("columnPeaks", () => {
	it("takes the busiest day in each column", () => {
		const load = dailyLoad(
			project([
				task("2026-11-02", "2026-11-03", 1),
				task("2026-11-03", "2026-11-03", 3),
			]),
		);
		const cols = [parseDate("2026-11-02"), parseDate("2026-11-09")];
		expect(columnPeaks(load, cols, 7)).toEqual([4, 0]);
	});
});

describe("capacityLevel", () => {
	it("classifies load against the team", () => {
		expect(capacityLevel(4, 5)).toBe("under");
		expect(capacityLevel(5, 5)).toBe("at");
		expect(capacityLevel(6, 5)).toBe("over");
	});
});

describe("overCapacityPeriods", () => {
	it("is empty when the team size is unset", () => {
		expect(
			overCapacityPeriods(project([task("2026-11-02", "2026-11-06", 9)])),
		).toEqual([]);
	});

	it("finds runs over capacity, bridging weekends", () => {
		const p = project(
			[
				// 5 engineers all fortnight: at capacity, not over.
				task("2026-11-02", "2026-11-13", 5),
				// One more Thu 5 – Mon 9: over, across a weekend.
				task("2026-11-05", "2026-11-09", 1),
				// Two more on Thu 12: a separate run.
				task("2026-11-12", "2026-11-12", 2),
			],
			5,
		);
		expect(overCapacityPeriods(p)).toEqual([
			{ startDate: "2026-11-05", endDate: "2026-11-09", peak: 6 },
			{ startDate: "2026-11-12", endDate: "2026-11-12", peak: 7 },
		]);
	});
});
