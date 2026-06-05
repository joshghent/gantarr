import { describe, it, expect } from "vitest";
import {
	buildLayout,
	getTaskRowIndex,
	getWorkstreamAtRow,
	getItemColor,
	type GanttLayout,
	type TaskPosition,
	type WorkstreamBand,
} from "./gantt-layout";
import type { GanttProject, WorkItem, Workstream } from "../types";

describe("buildLayout", () => {
	it("should create layout for empty project", () => {
		const project: GanttProject = {
			name: "Empty",
			workstreams: [],
			workItems: [],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.size).toBe(0);
		expect(layout.bands).toEqual([]);
		expect(layout.totalRows).toBe(0);
	});

	it("should create single placeholder row for empty workstream", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.bands).toEqual([
			{
				workstreamId: "ws1",
				startRow: 0,
				span: 1,
			},
		]);
		expect(layout.totalRows).toBe(1);
	});

	it("should place single task in first row", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")).toEqual({
			workItemId: "t1",
			workstreamId: "ws1",
			rowIndex: 0,
		});
		expect(layout.bands[0].span).toBe(1);
		expect(layout.totalRows).toBe(1);
	});

	it("should place non-overlapping tasks in same row", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-10",
					endDate: "2024-01-15",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		const t1Row = layout.taskPositions.get("t1")?.rowIndex;
		const t2Row = layout.taskPositions.get("t2")?.rowIndex;

		expect(t1Row).toBe(0);
		expect(t2Row).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("should place overlapping tasks in different rows", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-05",
					endDate: "2024-01-15",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		const t1Row = layout.taskPositions.get("t1")?.rowIndex;
		const t2Row = layout.taskPositions.get("t2")?.rowIndex;

		expect(t1Row).toBe(0);
		expect(t2Row).toBe(1);
		expect(layout.totalRows).toBe(2);
	});

	it("should respect explicit lane assignments", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 1,
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 0,
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(0);
		expect(layout.totalRows).toBe(2);
	});

	it("should pack implicit tasks around explicit lanes", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
					lane: 1,
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-15",
					endDate: "2024-01-20",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(0);
	});

	it("should sort workstreams by order", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws2", name: "Stream 2", order: 1, color: "#bbb" },
				{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "t2",
					workstreamId: "ws2",
					title: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.bands[0].workstreamId).toBe("ws1");
		expect(layout.bands[1].workstreamId).toBe("ws2");
		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(1);
	});

	it("should handle multiple workstreams with different task counts", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" },
				{ id: "ws2", name: "Stream 2", order: 1, color: "#bbb" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "t3",
					workstreamId: "ws2",
					title: "Task 3",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.bands[0].span).toBe(2);
		expect(layout.bands[1].span).toBe(1);
		expect(layout.bands[1].startRow).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("should sort explicit lane tasks by lane then startDate", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-10",
					endDate: "2024-01-15",
					lane: 0,
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 0,
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(0);
	});

	it("should sort implicit tasks by startDate then endDate", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		const t1Row = layout.taskPositions.get("t1")?.rowIndex;
		const t2Row = layout.taskPositions.get("t2")?.rowIndex;

		expect(t1Row).toBeDefined();
		expect(t2Row).toBeDefined();
	});

	it("should handle tasks with adjacent dates as overlapping", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-05",
					endDate: "2024-01-10",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		const t1Row = layout.taskPositions.get("t1")?.rowIndex;
		const t2Row = layout.taskPositions.get("t2")?.rowIndex;

		expect(t1Row).toBe(0);
		expect(t2Row).toBe(1);
	});

	it("should handle tasks spanning explicit lanes", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 2,
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("should pack implicit tasks when explicit tasks create gaps", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [{ id: "ws1", name: "Stream 1", order: 0, color: "#aaa" }],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					title: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 2,
				},
				{
					id: "t2",
					workstreamId: "ws1",
					title: "Task 2",
					startDate: "2024-01-10",
					endDate: "2024-01-15",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(0);
	});
});

describe("getTaskRowIndex", () => {
	it("should return row index for existing task", () => {
		const layout: GanttLayout = {
			taskPositions: new Map([
				["t1", { workItemId: "t1", workstreamId: "ws1", rowIndex: 5 }],
			]),
			bands: [],
			totalRows: 10,
		};

		expect(getTaskRowIndex(layout, "t1")).toBe(5);
	});

	it("should return -1 for non-existent task", () => {
		const layout: GanttLayout = {
			taskPositions: new Map(),
			bands: [],
			totalRows: 0,
		};

		expect(getTaskRowIndex(layout, "t1")).toBe(-1);
	});

	it("should return 0 for task in first row", () => {
		const layout: GanttLayout = {
			taskPositions: new Map([
				["t1", { workItemId: "t1", workstreamId: "ws1", rowIndex: 0 }],
			]),
			bands: [],
			totalRows: 10,
		};