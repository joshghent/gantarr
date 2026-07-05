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
		name: "Engineering",
		order: 0,
		color: "#123456",
		...overrides,
	} as Workstream;
}

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
	return {
		id: "task-1",
		workstreamId: "ws-1",
		title: "Task",
		startDate: "2026-01-01",
		endDate: "2026-01-05",
		...overrides,
	} as WorkItem;
}

function makeProject(overrides: Partial<GanttProject> = {}): GanttProject {
	return {
		id: "proj-1",
		name: "Test Project",
		workstreams: [],
		workItems: [],
		legend: [],
		...overrides,
	} as unknown as GanttProject;
}

describe("buildLayout", () => {
	it("gives an empty workstream a single placeholder row", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [],
		});
		const layout = buildLayout(project);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws-1", startRow: 0, span: 1 },
		]);
		expect(layout.totalRows).toBe(1);
	});

	it("places non-overlapping tasks on the same lane", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({ id: "a", startDate: "2026-01-01", endDate: "2026-01-05" }),
				makeItem({ id: "b", startDate: "2026-01-06", endDate: "2026-01-10" }),
			],
		});
		const layout = buildLayout(project);
		expect(layout.taskPositions.get("a")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("b")?.rowIndex).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("adds a 1-day buffer so adjacent tasks (touching dates) get separate lanes", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({ id: "a", startDate: "2026-01-01", endDate: "2026-01-05" }),
				// b starts exactly when a ends -> considered overlapping
				makeItem({ id: "b", startDate: "2026-01-05", endDate: "2026-01-10" }),
			],
		});
		const layout = buildLayout(project);
		const rowA = layout.taskPositions.get("a")?.rowIndex;
		const rowB = layout.taskPositions.get("b")?.rowIndex;
		expect(rowA).not.toBe(rowB);
		expect(layout.totalRows).toBe(2);
	});

	it("packs overlapping tasks into separate lanes greedily by start date", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({ id: "a", startDate: "2026-01-01", endDate: "2026-01-10" }),
				makeItem({ id: "b", startDate: "2026-01-02", endDate: "2026-01-05" }),
				makeItem({ id: "c", startDate: "2026-01-03", endDate: "2026-01-04" }),
			],
		});
		const layout = buildLayout(project);
		const rowA = layout.taskPositions.get("a")?.rowIndex;
		const rowB = layout.taskPositions.get("b")?.rowIndex;
		const rowC = layout.taskPositions.get("c")?.rowIndex;
		// all three overlap with 'a', so each needs its own lane
		expect(new Set([rowA, rowB, rowC]).size).toBe(3);
		expect(layout.totalRows).toBe(3);
	});

	it("reuses a lane once the previous task in it has ended", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({ id: "a", startDate: "2026-01-01", endDate: "2026-01-05" }),
				makeItem({ id: "b", startDate: "2026-01-10", endDate: "2026-01-15" }),
			],
		});
		const layout = buildLayout(project);
		expect(layout.taskPositions.get("a")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("b")?.rowIndex).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("places tasks with explicit lanes at exactly that lane", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({
					id: "a",
					lane: 2,
					startDate: "2026-01-01",
					endDate: "2026-01-05",
				}),
			],
		});
		const layout = buildLayout(project);
		expect(layout.taskPositions.get("a")?.rowIndex).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("places explicit-lane tasks first, reserving their lane against implicit tasks", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({
					id: "explicit",
					lane: 0,
					startDate: "2026-01-01",
					endDate: "2026-01-10",
				}),
				// overlaps explicit task in time, must not land in lane 0
				makeItem({
					id: "implicit",
					startDate: "2026-01-02",
					endDate: "2026-01-05",
				}),
			],
		});
		const layout = buildLayout(project);
		expect(layout.taskPositions.get("explicit")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("implicit")?.rowIndex).toBe(1);
	});

	it("allows an implicit task to share an explicit task's lane if it doesn't overlap", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({
					id: "explicit",
					lane: 0,
					startDate: "2026-01-01",
					endDate: "2026-01-05",
				}),
				makeItem({
					id: "implicit",
					startDate: "2026-01-10",
					endDate: "2026-01-15",
				}),
			],
		});
		const layout = buildLayout(project);
		expect(layout.taskPositions.get("explicit")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("implicit")?.rowIndex).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("creates gap lanes when an explicit lane is higher than the number of tasks", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({
					id: "a",
					lane: 3,
					startDate: "2026-01-01",
					endDate: "2026-01-05",
				}),
			],
		});
		const layout = buildLayout(project);
		expect(layout.taskPositions.get("a")?.rowIndex).toBe(3);
		expect(layout.totalRows).toBe(4);
	});

	it("orders explicit tasks within the same lane by start date then end date", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [
				makeItem({
					id: "later",
					lane: 0,
					startDate: "2026-02-01",
					endDate: "2026-02-05",
				}),
				makeItem({
					id: "earlier",
					lane: 0,
					startDate: "2026-01-01",
					endDate: "2026-01-05",
				}),
			],
		});
		// Both explicit tasks share lane 0 regardless of sort - reservation
		// simply places both in that lane's array; both end up at rowIndex 0.
		const layout = buildLayout(project);
		expect(layout.taskPositions.get("later")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("earlier")?.rowIndex).toBe(0);
	});

	it("stacks multiple workstreams sequentially with correct bands", () => {
		const project = makeProject({
			workstreams: [
				makeWorkstream({ id: "ws-1", order: 0 }),
				makeWorkstream({ id: "ws-2", order: 1 }),
			],
			workItems: [
				makeItem({
					id: "a",
					workstreamId: "ws-1",
					startDate: "2026-01-01",
					endDate: "2026-01-05",
				}),
				makeItem({
					id: "b",
					workstreamId: "ws-2",
					startDate: "2026-01-01",
					endDate: "2026-01-05",
				}),
				makeItem({
					id: "c",
					workstreamId: "ws-2",
					startDate: "2026-01-01",
					endDate: "2026-01-05",
				}),
			],
		});
		const layout = buildLayout(project);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws-1", startRow: 0, span: 1 },
			{ workstreamId: "ws-2", startRow: 1, span: 1 },
		]);
		expect(layout.taskPositions.get("a")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("b")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("c")?.rowIndex).toBe(1);
		expect(layout.totalRows).toBe(2);
	});

	it("respects workstream order rather than array order", () => {
		const project = makeProject({
			workstreams: [
				makeWorkstream({ id: "second", order: 1 }),
				makeWorkstream({ id: "first", order: 0 }),
			],
			workItems: [],
		});
		const layout = buildLayout(project);
		expect(layout.bands.map((b) => b.workstreamId)).toEqual([
			"first",
			"second",
		]);
	});

	it("handles a project with no workstreams", () => {
		const project = makeProject({ workstreams: [], workItems: [] });
		const layout = buildLayout(project);
		expect(layout.bands).toEqual([]);
		expect(layout.totalRows).toBe(0);
		expect(layout.taskPositions.size).toBe(0);
	});
});

describe("getTaskRowIndex", () => {
	it("returns the row index for a known task", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [makeItem({ id: "a" })],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "a")).toBe(0);
	});

	it("returns -1 for an unknown task id", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [makeItem({ id: "a" })],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "does-not-exist")).toBe(-1);
	});
});

describe("getWorkstreamAtRow", () => {
	it("returns the workstream id containing the given row", () => {
		const project = makeProject({
			workstreams: [
				makeWorkstream({ id: "ws-1", order: 0 }),
				makeWorkstream({ id: "ws-2", order: