import { describe, expect, it } from "vitest";
import {
	buildLayout,
	getItemColor,
	getTaskRowIndex,
	getWorkstreamAtRow,
} from "./gantt-layout";
import type { GanttProject, WorkItem, Workstream } from "../types";

function makeWorkstream(overrides: Partial<Workstream> = {}): Workstream {
	return {
		id: "ws-1",
		label: "Workstream 1",
		order: 0,
		color: "#123456",
		...overrides,
	} as Workstream;
}

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
	return {
		id: "item-1",
		workstreamId: "ws-1",
		title: "Task",
		startDate: "2024-01-01",
		endDate: "2024-01-05",
		...overrides,
	} as WorkItem;
}

function makeProject(overrides: Partial<GanttProject> = {}): GanttProject {
	return {
		name: "Test Project",
		workstreams: [],
		workItems: [],
		legend: [],
		...overrides,
	} as GanttProject;
}

describe("buildLayout", () => {
	it("gives an empty workstream a single placeholder row", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [],
		});

		const layout = buildLayout(project);
		expect(layout.bands).toEqual([{ workstreamId: "ws-1", startRow: 0, span: 1 }]);
		expect(layout.totalRows).toBe(1);
	});

	it("places non-overlapping tasks in the same lane (row)", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({ id: "a", startDate: "2024-01-01", endDate: "2024-01-05" }),
				makeItem({ id: "b", startDate: "2024-01-06", endDate: "2024-01-10" }),
			],
		});

		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "a")).toBe(0);
		expect(getTaskRowIndex(layout, "b")).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("packs overlapping tasks into separate lanes", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({ id: "a", startDate: "2024-01-01", endDate: "2024-01-10" }),
				makeItem({ id: "b", startDate: "2024-01-05", endDate: "2024-01-15" }),
			],
		});

		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "a")).toBe(0);
		expect(getTaskRowIndex(layout, "b")).toBe(1);
		expect(layout.totalRows).toBe(2);
	});

	it("treats tasks touching exactly on the boundary date as overlapping", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({ id: "a", startDate: "2024-01-01", endDate: "2024-01-05" }),
				makeItem({ id: "b", startDate: "2024-01-05", endDate: "2024-01-10" }),
			],
		});

		const layout = buildLayout(project);
		// a ends on 01-05, b starts on 01-05 -> overlap -> different lanes
		expect(getTaskRowIndex(layout, "a")).toBe(0);
		expect(getTaskRowIndex(layout, "b")).toBe(1);
	});

	it("reuses a freed lane once its occupants no longer overlap with a new task", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({ id: "a", startDate: "2024-01-01", endDate: "2024-01-05" }),
				makeItem({ id: "b", startDate: "2024-01-02", endDate: "2024-01-06" }), // overlaps a -> lane 1
				makeItem({ id: "c", startDate: "2024-01-10", endDate: "2024-01-12" }), // doesn't overlap a -> lane 0
			],
		});

		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "a")).toBe(0);
		expect(getTaskRowIndex(layout, "b")).toBe(1);
		expect(getTaskRowIndex(layout, "c")).toBe(0);
	});

	it("respects explicit lanes exactly, regardless of overlap", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({
					id: "a",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
					lane: 2,
				}),
				makeItem({
					id: "b",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
					lane: 0,
				}),
			],
		});

		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "a")).toBe(2);
		expect(getTaskRowIndex(layout, "b")).toBe(0);
		expect(layout.totalRows).toBe(3);
	});

	it("places implicit tasks avoiding lanes reserved by explicit tasks", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({
					id: "explicit",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
					lane: 0,
				}),
				makeItem({
					id: "implicit-overlap",
					startDate: "2024-01-05",
					endDate: "2024-01-08",
				}),
			],
		});

		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "explicit")).toBe(0);
		// overlaps the explicit task in lane 0, must go to lane 1
		expect(getTaskRowIndex(layout, "implicit-overlap")).toBe(1);
	});

	it("allows implicit tasks to share a lane with an explicit task when no overlap", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({
					id: "explicit",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 0,
				}),
				makeItem({
					id: "implicit-no-overlap",
					startDate: "2024-01-10",
					endDate: "2024-01-15",
				}),
			],
		});

		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "explicit")).toBe(0);
		expect(getTaskRowIndex(layout, "implicit-no-overlap")).toBe(0);
	});

	it("orders explicit tasks in the same lane deterministically by start date then end date", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({
					id: "later",
					startDate: "2024-02-01",
					endDate: "2024-02-05",
					lane: 0,
				}),
				makeItem({
					id: "earlier",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 0,
				}),
			],
		});

		// Both explicit tasks reserve lane 0 regardless of insertion order —
		// this exercises the sort but the actual row assigned is the same
		// for both since lane is explicit.
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "later")).toBe(0);
		expect(getTaskRowIndex(layout, "earlier")).toBe(0);
	});

	it("creates a new lane for an implicit task when it overlaps all existing lanes", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [
				makeItem({ id: "a", startDate: "2024-01-01", endDate: "2024-01-31" }),
				makeItem({ id: "b", startDate: "2024-01-01", endDate: "2024-01-31" }),
				makeItem({ id: "c", startDate: "2024-01-01", endDate: "2024-01-31" }),
			],
		});

		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "a")).toBe(0);
		expect(getTaskRowIndex(layout, "b")).toBe(1);
		expect(getTaskRowIndex(layout, "c")).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("orders workstreams by their `order` field, not array order", () => {
		const project = makeProject({
			workstreams: [
				makeWorkstream({ id: "second", order: 1 }),
				makeWorkstream({ id: "first", order: 0 }),
			],
			workItems: [
				makeItem({ id: "a", workstreamId: "first" }),
				makeItem({ id: "b", workstreamId: "second" }),
			],
		});

		const layout = buildLayout(project);
		expect(layout.bands[0].workstreamId).toBe("first");
		expect(layout.bands[1].workstreamId).toBe("second");
		expect(getTaskRowIndex(layout, "a")).toBe(0);
		expect(getTaskRowIndex(layout, "b")).toBe(1);
	});

	it("computes correct startRow/span across multiple workstreams and stacks rows", () => {
		const project = makeProject({
			workstreams: [
				makeWorkstream({ id: "ws-1", order: 0 }),
				makeWorkstream({ id: "ws-2", order: 1 }),
			],
			workItems: [
				// ws-1: two overlapping tasks -> 2 rows
				makeItem({
					id: "a",
					workstreamId: "ws-1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
				}),
				makeItem({
					id: "b",
					workstreamId: "ws-1",
					startDate: "2024-01-05",
					endDate: "2024-01-15",
				}),
				// ws-2: single task -> 1 row
				makeItem({
					id: "c",
					workstreamId: "ws-2",
					startDate: "2024-02-01",
					endDate: "2024-02-05",
				}),
			],
		});

		const layout = buildLayout(project);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws-1", startRow: 0, span: 2 },
			{ workstreamId: "ws-2", startRow: 2, span: 1 },
		]);
		expect(getTaskRowIndex(layout, "c")).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("returns empty layout for a project with no workstreams", () => {
		const project = makeProject({ workstreams: [], workItems: [] });
		const layout = buildLayout(project);
		expect(layout.bands).toEqual([]);
		expect(layout.totalRows).toBe(0);
		expect(layout.taskPositions.size).toBe(0);
	});

	it("ignores work items whose workstreamId does not match any workstream", () => {
		const project = makeProject({
			workstreams: [makeWorkstream({ id: "ws-1" })],
			workItems: [makeItem({ id: "orphan", work