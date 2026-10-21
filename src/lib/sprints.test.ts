import { describe, expect, it } from "vitest";
import type { GanttProject } from "../types";
import { formatDate, parseDate } from "./dates";
import { createProject } from "./gantt-store";
import { getSprints, resolveSprints, sprintNumber } from "./sprints";

function projectWith(start: string): GanttProject {
	const p = createProject("Test");
	p.workItems = [{ ...p.workItems[0], startDate: start, endDate: start }];
	return p;
}

describe("resolveSprints", () => {
	it("keeps explicit settings", () => {
		const p = projectWith("2026-11-04");
		p.sprints = { lengthWeeks: 3, startDate: "2026-10-01" };
		expect(resolveSprints(p)).toEqual({
			lengthWeeks: 3,
			startDate: "2026-10-01",
		});
	});

	it("defaults to two weeks from the Monday of the earliest task", () => {
		// 2026-11-04 is a Wednesday.
		expect(resolveSprints(projectWith("2026-11-04"))).toEqual({
			lengthWeeks: 2,
			startDate: "2026-11-02",
		});
	});
});

describe("getSprints", () => {
	const settings = { lengthWeeks: 2, startDate: "2026-11-02" };

	it("aligns columns to the sprint anchor", () => {
		const cols = getSprints(
			parseDate("2026-11-10"),
			parseDate("2026-12-10"),
			settings,
		).map(formatDate);
		expect(cols).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
	});

	it("extends before sprint 1 when the range starts earlier", () => {
		const cols = getSprints(
			parseDate("2026-10-26"),
			parseDate("2026-11-03"),
			settings,
		).map(formatDate);
		expect(cols).toEqual(["2026-10-19", "2026-11-02"]);
	});
});

describe("sprintNumber", () => {
	const settings = { lengthWeeks: 2, startDate: "2026-11-02" };

	it("counts from 1 at the anchor", () => {
		expect(sprintNumber(parseDate("2026-11-02"), settings)).toBe(1);
		expect(sprintNumber(parseDate("2026-11-15"), settings)).toBe(1);
		expect(sprintNumber(parseDate("2026-11-16"), settings)).toBe(2);
	});

	it("goes to zero and below before sprint 1", () => {
		expect(sprintNumber(parseDate("2026-10-19"), settings)).toBe(0);
	});
});
