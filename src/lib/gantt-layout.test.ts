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
		id: "ws1",
		name: "Workstream 1",
		order: 0,
		color: "#123456",
		...overrides,
	} as Workstream;
}

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
	return {
		id: "t1",
		workstreamId: "ws1",
		title: "Task 1",
		startDate: "2024-01-01",
		endDate: "2024-01-02",
		...overrides,
	} as WorkItem;
}

function makeProject(overrides: Partial<GanttProject> = {}): GanttProject {
	return {
		id: "proj1",
		name: "Project",
		workstreams: [],
		workItems: [],
		legend: [],
		...overrides,
	} as GanttProject;
}

describe("buildLayout", () => {
	it("returns empty layout for a project with no workstreams", () => {
		const project = makeProject();
		const layout = buildLayout(project);
		expect(layout.totalRows).toBe(0);
		expect(layout.bands).toEqual([]);
		expect(layout.taskPositions.size).toBe(0);
	});

	it("gives an empty workstream a single placeholder row", () => {
		const ws = makeWorkstream();
		const project = makeProject({ workstreams: [ws], workItems: [] });
		const layout = buildLayout(project);
		expect(layout.totalRows).toBe(1);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws1", startRow: 0, span: 1 },
		]);
	});

	it("sorts workstreams by their order field", () => {
		const wsA = makeWorkstream({ id: "wsA", order: 1 });
		const wsB = makeWorkstream({ id: "wsB", order: 0 });
		const project = makeProject({ workstreams: [wsA, wsB], workItems: [] });
		const layout = buildLayout(project);
		expect(layout.bands.map((b) => b.workstreamId)).toEqual(["wsB", "wsA"]);
	});

	it("places non-overlapping tasks in the same lane (row)", () => {
		const ws = makeWorkstream();
		const t1 = makeItem({
			id: "t1",
			startDate: "2024-01-01",
			endDate: "2024-01-02",
		});
		const t2 = makeItem({
			id: "t2",
			startDate: "2024-01-05",
			endDate: "2024-01-06",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [t1, t2],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "t1")).toBe(0);
		expect(getTaskRowIndex(layout, "t2")).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("places overlapping tasks in separate lanes", () => {
		const ws = makeWorkstream();
		const t1 = makeItem({
			id: "t1",
			startDate: "2024-01-01",
			endDate: "2024-01-05",
		});
		const t2 = makeItem({
			id: "t2",
			startDate: "2024-01-03",
			endDate: "2024-01-06",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [t1, t2],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "t1")).toBe(0);
		expect(getTaskRowIndex(layout, "t2")).toBe(1);
		expect(layout.totalRows).toBe(2);
	});

	it("treats tasks touching at the boundary date as overlapping", () => {
		const ws = makeWorkstream();
		const t1 = makeItem({
			id: "t1",
			startDate: "2024-01-01",
			endDate: "2024-01-05",
		});
		const t2 = makeItem({
			id: "t2",
			startDate: "2024-01-05",
			endDate: "2024-01-10",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [t1, t2],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "t1")).toBe(0);
		expect(getTaskRowIndex(layout, "t2")).toBe(1);
	});

	it("reuses freed lanes for later non-overlapping tasks (greedy packing)", () => {
		const ws = makeWorkstream();
		const t1 = makeItem({
			id: "t1",
			startDate: "2024-01-01",
			endDate: "2024-01-02",
		});
		const t2 = makeItem({
			id: "t2",
			startDate: "2024-01-01",
			endDate: "2024-01-03",
		});
		const t3 = makeItem({
			id: "t3",
			startDate: "2024-01-05",
			endDate: "2024-01-06",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [t1, t2, t3],
		});
		const layout = buildLayout(project);
		// t1 and t2 overlap -> 2 lanes; t3 starts after both end so it
		// should reuse lane 0 (the first available, non-overlapping lane).
		expect(getTaskRowIndex(layout, "t1")).toBe(0);
		expect(getTaskRowIndex(layout, "t2")).toBe(1);
		expect(getTaskRowIndex(layout, "t3")).toBe(0);
		expect(layout.totalRows).toBe(2);
	});

	it("respects explicit lane assignments", () => {
		const ws = makeWorkstream();
		const t1 = makeItem({
			id: "t1",
			startDate: "2024-01-01",
			endDate: "2024-01-02",
			lane: 2,
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [t1],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "t1")).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("packs implicit-lane tasks around explicit reservations without overlap", () => {
		const ws = makeWorkstream();
		const explicitTask = makeItem({
			id: "explicit",
			startDate: "2024-01-01",
			endDate: "2024-01-10",
			lane: 0,
		});
		const overlappingImplicit = makeItem({
			id: "implicit-overlap",
			startDate: "2024-01-05",
			endDate: "2024-01-06",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [explicitTask, overlappingImplicit],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "explicit")).toBe(0);
		// overlaps with lane 0, so must be placed in a new lane
		expect(getTaskRowIndex(layout, "implicit-overlap")).toBe(1);
	});

	it("allows implicit tasks to fill explicit lanes when there's no overlap", () => {
		const ws = makeWorkstream();
		const explicitTask = makeItem({
			id: "explicit",
			startDate: "2024-01-01",
			endDate: "2024-01-02",
			lane: 0,
		});
		const nonOverlappingImplicit = makeItem({
			id: "implicit-free",
			startDate: "2024-02-01",
			endDate: "2024-02-02",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [explicitTask, nonOverlappingImplicit],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "explicit")).toBe(0);
		expect(getTaskRowIndex(layout, "implicit-free")).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("handles multiple workstreams with correct row offsets", () => {
		const ws1 = makeWorkstream({ id: "ws1", order: 0 });
		const ws2 = makeWorkstream({ id: "ws2", order: 1 });
		const t1 = makeItem({
			id: "t1",
			workstreamId: "ws1",
			startDate: "2024-01-01",
			endDate: "2024-01-05",
		});
		const t2 = makeItem({
			id: "t2",
			workstreamId: "ws1",
			startDate: "2024-01-03",
			endDate: "2024-01-06",
		});
		const t3 = makeItem({
			id: "t3",
			workstreamId: "ws2",
			startDate: "2024-01-01",
			endDate: "2024-01-02",
		});
		const project = makeProject({
			workstreams: [ws1, ws2],
			workItems: [t1, t2, t3],
		});
		const layout = buildLayout(project);
		// ws1 has 2 overlapping tasks -> takes rows 0,1
		expect(getTaskRowIndex(layout, "t1")).toBe(0);
		expect(getTaskRowIndex(layout, "t2")).toBe(1);
		// ws2 starts at row 2
		expect(getTaskRowIndex(layout, "t3")).toBe(2);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws1", startRow: 0, span: 2 },
			{ workstreamId: "ws2", startRow: 2, span: 1 },
		]);
		expect(layout.totalRows).toBe(3);
	});

	it("ignores work items belonging to other workstreams", () => {
		const ws1 = makeWorkstream({ id: "ws1", order: 0 });
		const ws2 = makeWorkstream({ id: "ws2", order: 1 });
		const t1 = makeItem({ id: "t1", workstreamId: "ws2" });
		const project = makeProject({
			workstreams: [ws1, ws2],
			workItems: [t1],
		});
		const layout = buildLayout(project);
		expect(layout.bands[0]).toEqual({
			workstreamId: "ws1",
			startRow: 0,
			span: 1,
		});
		expect(getTaskRowIndex(layout, "t1")).toBe(1);
	});

	it("orders explicit-lane tasks within a lane deterministically by start/end date", () => {
		const ws = makeWorkstream();
		const later = makeItem({
			id: "later",
			startDate: "2024-01-10",
			endDate: "2024-01-11",
			lane: 0,
		});
		const earlier = makeItem({
			id: "earlier",
			startDate: "2024-01-01",
			endDate: "2024-01-02",
			lane: 0,
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [later, earlier],
		});
		const layout = buildLayout(project);
		// Both share lane 0 regardless of insertion order.
		expect(getTaskRowIndex(layout, "later")).toBe(0);
		expect(getTaskRowIndex(layout, "earlier")).toBe(0);
	});
});

describe("getTaskRowIndex", () => {
	it("returns -1 for an unknown item id", () => {
		const project = makeProject({
			workstreams: [makeWorkstream()],
			workItems: [makeItem()],
		});
		const layout = buildLayout(project);
		expect(getTaskRowInd