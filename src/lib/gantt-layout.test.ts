import { describe, it, expect } from "vitest";
import {
	buildLayout,
	getTaskRowIndex,
	getWorkstreamAtRow,
	getItemColor,
	type GanttProject,
	type WorkItem,
	type Workstream,
} from "./gantt-layout";

describe("buildLayout", () => {
	it("should handle empty project with no workstreams", () => {
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

	it("should create placeholder row for empty workstream", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.size).toBe(0);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws1", startRow: 0, span: 1 },
		]);
		expect(layout.totalRows).toBe(1);
	});

	it("should place single task in first row", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.size).toBe(1);
		expect(layout.taskPositions.get("task1")).toEqual({
			workItemId: "task1",
			workstreamId: "ws1",
			rowIndex: 0,
		});
		expect(layout.bands).toEqual([
			{ workstreamId: "ws1", startRow: 0, span: 1 },
		]);
		expect(layout.totalRows).toBe(1);
	});

	it("should place non-overlapping tasks in same lane", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-06",
					endDate: "2024-01-10",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.size).toBe(2);
		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("should place overlapping tasks in different lanes", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-03",
					endDate: "2024-01-08",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.size).toBe(2);
		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(1);
		expect(layout.totalRows).toBe(2);
	});

	it("should respect explicit lane assignments", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 1,
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-03",
					endDate: "2024-01-08",
					lane: 0,
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(0);
		expect(layout.totalRows).toBe(2);
	});

	it("should pack implicit tasks around explicit lanes", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
					lane: 1,
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-06",
					endDate: "2024-01-10",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(0);
	});

	it("should handle multiple workstreams with correct row offsets", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
				{ id: "ws2", name: "Workstream 2", order: 1, color: "#111111" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "task2",
					workstreamId: "ws2",
					name: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(1);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws1", startRow: 0, span: 1 },
			{ workstreamId: "ws2", startRow: 1, span: 1 },
		]);
		expect(layout.totalRows).toBe(2);
	});

	it("should sort workstreams by order property", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws2", name: "Workstream 2", order: 1, color: "#111111" },
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "task2",
					workstreamId: "ws2",
					name: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.bands[0].workstreamId).toBe("ws1");
		expect(layout.bands[1].workstreamId).toBe("ws2");
	});

	it("should sort explicit-lane tasks by lane then startDate", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-05",
					endDate: "2024-01-10",
					lane: 0,
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-04",
					lane: 0,
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		const task1Pos = layout.taskPositions.get("task1");
		const task2Pos = layout.taskPositions.get("task2");
		expect(task1Pos?.rowIndex).toBe(0);
		expect(task2Pos?.rowIndex).toBe(0);
	});

	it("should sort implicit tasks by startDate then endDate", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-03",
					endDate: "2024-01-08",
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(1);
	});

	it("should handle adjacent tasks (touching dates)", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-05",
					endDate: "2024-01-10",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(0);
	});

	it("should handle complex multi-lane scenario", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-05",
					endDate: "2024-01-15",
				},
				{
					id: "task3",
					workstreamId: "ws1",
					name: "Task 3",
					startDate: "2024-01-08",
					endDate: "2024-01-12",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("task3")?.rowIndex).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("should handle tasks with same start and end dates", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "task1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-01",
				},
				{
					id: "task2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-01",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("task1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("task2")?.rowIndex).toBe(0);
	});

	it("should filter tasks by workstream correctly", () => {
		const project: GanttProject = {
			name: "Test",
			workstreams: [
				{ id: "ws1", name: "Workstream 1", order: 0, color: "#000000" },
				{ id: "ws2", name: "Workstream 2