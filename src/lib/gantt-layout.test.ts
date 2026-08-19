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
		color: "#ff0000",
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
		id: "proj-1",
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

	it("gives empty workstreams a single placeholder row", () => {
		const ws = makeWorkstream();
		const project = makeProject({ workstreams: [ws], workItems: [] });
		const layout = buildLayout(project);
		expect(layout.totalRows).toBe(1);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws-1", startRow: 0, span: 1 },
		]);
	});

	it("sorts workstreams by order before laying out rows", () => {
		const wsA = makeWorkstream({ id: "ws-a", order: 1 });
		const wsB = makeWorkstream({ id: "ws-b", order: 0 });
		const project = makeProject({ workstreams: [wsA, wsB], workItems: [] });
		const layout = buildLayout(project);
		expect(layout.bands[0].workstreamId).toBe("ws-b");
		expect(layout.bands[1].workstreamId).toBe("ws-a");
	});

	it("places a single task at row 0 of its workstream", () => {
		const ws = makeWorkstream();
		const item = makeItem();
		const project = makeProject({ workstreams: [ws], workItems: [item] });
		const layout = buildLayout(project);
		expect(layout.taskPositions.get("item-1")).toEqual({
			workItemId: "item-1",
			workstreamId: "ws-1",
			rowIndex: 0,
		});
		expect(layout.totalRows).toBe(1);
	});

	it("packs non-overlapping tasks into the same lane", () => {
		const ws = makeWorkstream();
		const item1 = makeItem({
			id: "item-1",
			startDate: "2024-01-01",
			endDate: "2024-01-05",
		});
		const item2 = makeItem({
			id: "item-2",
			startDate: "2024-01-06",
			endDate: "2024-01-10",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [item1, item2],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "item-1")).toBe(0);
		expect(getTaskRowIndex(layout, "item-2")).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("places overlapping tasks into separate lanes", () => {
		const ws = makeWorkstream();
		const item1 = makeItem({
			id: "item-1",
			startDate: "2024-01-01",
			endDate: "2024-01-10",
		});
		const item2 = makeItem({
			id: "item-2",
			startDate: "2024-01-05",
			endDate: "2024-01-15",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [item1, item2],
		});
		const layout = buildLayout(project);
		const row1 = getTaskRowIndex(layout, "item-1");
		const row2 = getTaskRowIndex(layout, "item-2");
		expect(row1).not.toBe(row2);
		expect(layout.totalRows).toBe(2);
	});

	it("treats adjacent tasks (end === start of next) as overlapping", () => {
		const ws = makeWorkstream();
		const item1 = makeItem({
			id: "item-1",
			startDate: "2024-01-01",
			endDate: "2024-01-05",
		});
		const item2 = makeItem({
			id: "item-2",
			startDate: "2024-01-05",
			endDate: "2024-01-10",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [item1, item2],
		});
		const layout = buildLayout(project);
		const row1 = getTaskRowIndex(layout, "item-1");
		const row2 = getTaskRowIndex(layout, "item-2");
		expect(row1).not.toBe(row2);
	});

	it("sorts implicit tasks by startDate, then endDate, when packing", () => {
		const ws = makeWorkstream();
		// Same start date, different end dates: shorter one should be
		// considered first (sorted ascending by endDate as tiebreak).
		const shortTask = makeItem({
			id: "short",
			startDate: "2024-01-01",
			endDate: "2024-01-02",
		});
		const longTask = makeItem({
			id: "long",
			startDate: "2024-01-01",
			endDate: "2024-01-10",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [longTask, shortTask],
		});
		const layout = buildLayout(project);
		// Both overlap in time so must land in different lanes.
		expect(getTaskRowIndex(layout, "short")).not.toBe(
			getTaskRowIndex(layout, "long"),
		);
	});

	it("respects explicit lane assignments deterministically", () => {
		const ws = makeWorkstream();
		const item1 = makeItem({
			id: "item-1",
			lane: 2,
			startDate: "2024-01-01",
			endDate: "2024-01-05",
		});
		const project = makeProject({ workstreams: [ws], workItems: [item1] });
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "item-1")).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("places implicit tasks around explicit lane reservations, avoiding overlap", () => {
		const ws = makeWorkstream();
		const explicitTask = makeItem({
			id: "explicit",
			lane: 0,
			startDate: "2024-01-01",
			endDate: "2024-01-10",
		});
		// Overlaps with the explicit task in time, so it must not land in lane 0.
		const implicitTask = makeItem({
			id: "implicit",
			startDate: "2024-01-05",
			endDate: "2024-01-15",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [explicitTask, implicitTask],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "explicit")).toBe(0);
		expect(getTaskRowIndex(layout, "implicit")).not.toBe(0);
	});

	it("allows an implicit task to reuse a non-overlapping explicit lane", () => {
		const ws = makeWorkstream();
		const explicitTask = makeItem({
			id: "explicit",
			lane: 0,
			startDate: "2024-01-01",
			endDate: "2024-01-05",
		});
		// Does not overlap with the explicit task, so should be packed into lane 0.
		const implicitTask = makeItem({
			id: "implicit",
			startDate: "2024-01-06",
			endDate: "2024-01-10",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [explicitTask, implicitTask],
		});
		const layout = buildLayout(project);
		expect(getTaskRowIndex(layout, "explicit")).toBe(0);
		expect(getTaskRowIndex(layout, "implicit")).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("expands lanes array when an explicit lane index skips ahead", () => {
		const ws = makeWorkstream();
		const item = makeItem({
			id: "item-1",
			lane: 3,
			startDate: "2024-01-01",
			endDate: "2024-01-05",
		});
		const project = makeProject({ workstreams: [ws], workItems: [item] });
		const layout = buildLayout(project);
		// Lanes 0..3 reserved -> 4 rows for this workstream
		expect(layout.bands[0].span).toBe(4);
		expect(getTaskRowIndex(layout, "item-1")).toBe(3);
	});

	it("computes correct absolute row indices across multiple workstreams", () => {
		const ws1 = makeWorkstream({ id: "ws-1", order: 0 });
		const ws2 = makeWorkstream({ id: "ws-2", order: 1 });

		const overlappingA = makeItem({
			id: "a1",
			workstreamId: "ws-1",
			startDate: "2024-01-01",
			endDate: "2024-01-10",
		});
		const overlappingB = makeItem({
			id: "a2",
			workstreamId: "ws-1",
			startDate: "2024-01-05",
			endDate: "2024-01-15",
		});
		const single = makeItem({
			id: "b1",
			workstreamId: "ws-2",
			startDate: "2024-02-01",
			endDate: "2024-02-05",
		});

		const project = makeProject({
			workstreams: [ws1, ws2],
			workItems: [overlappingA, overlappingB, single],
		});
		const layout = buildLayout(project);

		// ws-1 takes 2 rows (0 and 1), ws-2 starts at row 2
		expect(layout.bands[0]).toEqual({
			workstreamId: "ws-1",
			startRow: 0,
			span: 2,
		});
		expect(layout.bands[1]).toEqual({
			workstreamId: "ws-2",
			startRow: 2,
			span: 1,
		});
		expect(getTaskRowIndex(layout, "b1")).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("handles workItems referencing an unknown workstreamId by excluding them from any band", () => {
		const ws = makeWorkstream();
		const orphan = makeItem({ id: "orphan", workstreamId: "does-not-exist" });
		const project = makeProject({ workstreams: [ws], workItems: [orphan] });
		const layout = buildLayout(project);
		// orphan never gets placed since it doesn't belong to any workstream
		expect(layout.taskPositions.has("orphan")).toBe(false);
		// the real workstream still gets its placeholder row
		expect(layout.totalRows).toBe(1);
	});
});

describe("getTaskRowIndex", () => {
	it("returns the row index for a known task", () => {
		const ws = makeWorkstream();
		const item = makeItem();
		const project = makeProject({ workstreams: [ws], workItems: [item] });
		const layout = buildLayout(project);
		expect(getTaskR