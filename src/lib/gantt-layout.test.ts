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
		name: "Workstream 1",
		order: 0,
		color: "#123456",
		...overrides,
	} as Workstream;
}

function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
	return {
		id: "wi-1",
		workstreamId: "ws-1",
		title: "Task 1",
		startDate: "2026-01-01",
		endDate: "2026-01-05",
		...overrides,
	} as WorkItem;
}

function makeProject(overrides: Partial<GanttProject> = {}): GanttProject {
	return {
		id: "project-1",
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
		expect(layout.bands).toEqual([]);
		expect(layout.totalRows).toBe(0);
		expect(layout.taskPositions.size).toBe(0);
	});

	it("gives an empty workstream a single placeholder row", () => {
		const ws = makeWorkstream();
		const project = makeProject({ workstreams: [ws], workItems: [] });
		const layout = buildLayout(project);

		expect(layout.bands).toEqual([{ workstreamId: "ws-1", startRow: 0, span: 1 }]);
		expect(layout.totalRows).toBe(1);
	});

	it("orders workstreams by their `order` field, not array order", () => {
		const wsA = makeWorkstream({ id: "ws-a", order: 1 });
		const wsB = makeWorkstream({ id: "ws-b", order: 0 });
		const project = makeProject({ workstreams: [wsA, wsB], workItems: [] });
		const layout = buildLayout(project);

		expect(layout.bands.map((b) => b.workstreamId)).toEqual(["ws-b", "ws-a"]);
	});

	it("places a single task on lane 0 of its workstream", () => {
		const ws = makeWorkstream();
		const task = makeWorkItem();
		const project = makeProject({ workstreams: [ws], workItems: [task] });
		const layout = buildLayout(project);

		expect(layout.taskPositions.get(task.id)).toEqual({
			workItemId: task.id,
			workstreamId: ws.id,
			rowIndex: 0,
		});
		expect(layout.bands).toEqual([{ workstreamId: ws.id, startRow: 0, span: 1 }]);
		expect(layout.totalRows).toBe(1);
	});

	it("packs non-overlapping tasks into the same lane", () => {
		const ws = makeWorkstream();
		const task1 = makeWorkItem({
			id: "wi-1",
			startDate: "2026-01-01",
			endDate: "2026-01-05",
		});
		const task2 = makeWorkItem({
			id: "wi-2",
			startDate: "2026-01-06",
			endDate: "2026-01-10",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [task1, task2],
		});
		const layout = buildLayout(project);

		expect(getTaskRowIndex(layout, "wi-1")).toBe(0);
		expect(getTaskRowIndex(layout, "wi-2")).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("packs overlapping tasks into separate lanes", () => {
		const ws = makeWorkstream();
		const task1 = makeWorkItem({
			id: "wi-1",
			startDate: "2026-01-01",
			endDate: "2026-01-10",
		});
		const task2 = makeWorkItem({
			id: "wi-2",
			startDate: "2026-01-05",
			endDate: "2026-01-15",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [task1, task2],
		});
		const layout = buildLayout(project);

		expect(getTaskRowIndex(layout, "wi-1")).toBe(0);
		expect(getTaskRowIndex(layout, "wi-2")).toBe(1);
		expect(layout.totalRows).toBe(2);
	});

	it("treats tasks whose ranges only touch (share boundary date) as overlapping", () => {
		const ws = makeWorkstream();
		const task1 = makeWorkItem({
			id: "wi-1",
			startDate: "2026-01-01",
			endDate: "2026-01-05",
		});
		const task2 = makeWorkItem({
			id: "wi-2",
			startDate: "2026-01-05",
			endDate: "2026-01-10",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [task1, task2],
		});
		const layout = buildLayout(project);

		expect(getTaskRowIndex(layout, "wi-1")).toBe(0);
		expect(getTaskRowIndex(layout, "wi-2")).toBe(1);
	});

	it("reuses an earlier lane once it's freed up by a non-overlapping task", () => {
		const ws = makeWorkstream();
		// wi-1 and wi-2 overlap -> two lanes
		const task1 = makeWorkItem({
			id: "wi-1",
			startDate: "2026-01-01",
			endDate: "2026-01-10",
		});
		const task2 = makeWorkItem({
			id: "wi-2",
			startDate: "2026-01-05",
			endDate: "2026-01-15",
		});
		// wi-3 starts after wi-1 ends, so it can reuse lane 0
		const task3 = makeWorkItem({
			id: "wi-3",
			startDate: "2026-01-11",
			endDate: "2026-01-20",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [task1, task2, task3],
		});
		const layout = buildLayout(project);

		expect(getTaskRowIndex(layout, "wi-1")).toBe(0);
		expect(getTaskRowIndex(layout, "wi-2")).toBe(1);
		expect(getTaskRowIndex(layout, "wi-3")).toBe(0);
		expect(layout.totalRows).toBe(2);
	});

	it("places tasks with an explicit lane at exactly that lane", () => {
		const ws = makeWorkstream();
		const task = makeWorkItem({ id: "wi-1", lane: 2 });
		const project = makeProject({ workstreams: [ws], workItems: [task] });
		const layout = buildLayout(project);

		expect(getTaskRowIndex(layout, "wi-1")).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("lets implicit-lane tasks avoid explicit reservations even if they overlap", () => {
		const ws = makeWorkstream();
		const explicitTask = makeWorkItem({
			id: "wi-explicit",
			lane: 0,
			startDate: "2026-01-01",
			endDate: "2026-01-10",
		});
		const implicitTask = makeWorkItem({
			id: "wi-implicit",
			startDate: "2026-01-05",
			endDate: "2026-01-15",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [explicitTask, implicitTask],
		});
		const layout = buildLayout(project);

		expect(getTaskRowIndex(layout, "wi-explicit")).toBe(0);
		expect(getTaskRowIndex(layout, "wi-implicit")).toBe(1);
	});

	it("does not place implicit tasks into an explicit lane that overlaps them, even if reserved lane appears empty of implicit collisions", () => {
		const ws = makeWorkstream();
		// explicit reserves lane 1 without any implicit-overlap check
		const explicitTask = makeWorkItem({
			id: "wi-explicit",
			lane: 1,
			startDate: "2026-01-01",
			endDate: "2026-01-31",
		});
		const implicitTask = makeWorkItem({
			id: "wi-implicit",
			startDate: "2026-01-10",
			endDate: "2026-01-15",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [explicitTask, implicitTask],
		});
		const layout = buildLayout(project);

		// lane 0 is free (created because lanes.length <= 1), lane1 occupied
		expect(getTaskRowIndex(layout, "wi-explicit")).toBe(1);
		expect(getTaskRowIndex(layout, "wi-implicit")).toBe(0);
	});

	it("computes band spans as the max lane count used in a workstream", () => {
		const ws = makeWorkstream();
		const task1 = makeWorkItem({
			id: "wi-1",
			startDate: "2026-01-01",
			endDate: "2026-01-10",
		});
		const task2 = makeWorkItem({
			id: "wi-2",
			startDate: "2026-01-05",
			endDate: "2026-01-15",
		});
		const task3 = makeWorkItem({
			id: "wi-3",
			startDate: "2026-01-07",
			endDate: "2026-01-20",
		});
		const project = makeProject({
			workstreams: [ws],
			workItems: [task1, task2, task3],
		});
		const layout = buildLayout(project);

		expect(layout.bands[0].span).toBe(3);
		expect(layout.totalRows).toBe(3);
	});

	it("offsets rows correctly across multiple workstreams", () => {
		const ws1 = makeWorkstream({ id: "ws-1", order: 0 });
		const ws2 = makeWorkstream({ id: "ws-2", order: 1 });

		const task1 = makeWorkItem({ id: "wi-1", workstreamId: "ws-1" });
		const task2a = makeWorkItem({
			id: "wi-2a",
			workstreamId: "ws-2",
			startDate: "2026-02-01",
			endDate: "2026-02-05",
		});
		const task2b = makeWorkItem({
			id: "wi-2b",
			workstreamId: "ws-2",
			startDate: "2026-02-03",
			endDate: "2026-02-10",
		});

		const project = makeProject({
			workstreams: [ws1, ws2],
			workItems: [task1, task2a, task2b],
		});
		const layout = buildLayout(project);

		expect(layout.bands).toEqual([
			{ workstreamId: "ws-1", startRow: 0, span: 1 },
			{ workstreamId: "ws-2", startRow: 1, span: 2 },
		]);
		expect(getTaskRowIndex(layout, "wi-1")).toBe(0);
		expect(getTaskRowIndex(layout, "wi-2a")).toBe(1);
		expect(getTaskRowIndex(layout, "wi-2b")).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("sorts explicit-lane tasks by startDate within the same lane deterministically", () => {
		const ws = makeWorkstream();
		const taskLater = makeWorkItem({
			id: "wi-later",
			lane: