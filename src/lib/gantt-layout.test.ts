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
			id: "p1",
			name: "Empty Project",
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
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "Empty WS", order: 0, color: "#000000" },
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
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
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
		expect(layout.taskPositions.get("t1")).toEqual({
			workItemId: "t1",
			workstreamId: "ws1",
			rowIndex: 0,
		});
		expect(layout.bands).toEqual([
			{ workstreamId: "ws1", startRow: 0, span: 1 },
		]);
		expect(layout.totalRows).toBe(1);
	});

	it("should place non-overlapping tasks in same row", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-10",
					endDate: "2024-01-15",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.size).toBe(2);
		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(0);
		expect(layout.totalRows).toBe(1);
	});

	it("should place overlapping tasks in different rows", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-05",
					endDate: "2024-01-15",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.size).toBe(2);
		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(1);
		expect(layout.totalRows).toBe(2);
	});

	it("should place tasks with explicit lane in that lane", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
					lane: 2,
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-05",
					endDate: "2024-01-15",
					lane: 0,
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(2);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(0);
		expect(layout.totalRows).toBe(3);
	});

	it("should place implicit tasks after explicit lanes", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
					lane: 0,
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-15",
					endDate: "2024-01-20",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(0);
	});

	it("should handle multiple workstreams in order", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws2", name: "WS2", order: 1, color: "#000000" },
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "t2",
					workstreamId: "ws2",
					name: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(1);
		expect(layout.bands).toEqual([
			{ workstreamId: "ws1", startRow: 0, span: 1 },
			{ workstreamId: "ws2", startRow: 1, span: 1 },
		]);
		expect(layout.totalRows).toBe(2);
	});

	it("should sort explicit lane tasks by lane then start date", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-10",
					endDate: "2024-01-15",
					lane: 0,
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
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

	it("should sort implicit tasks by start date then end date", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-05",
					endDate: "2024-01-10",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-15",
				},
				{
					id: "t3",
					workstreamId: "ws1",
					name: "Task 3",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t3")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
	});

	it("should handle adjacent tasks as overlapping", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-05",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-05",
					endDate: "2024-01-10",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(1);
	});

	it("should create new lane when all existing lanes overlap", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
				},
				{
					id: "t3",
					workstreamId: "ws1",
					name: "Task 3",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("t3")?.rowIndex).toBe(2);
		expect(layout.totalRows).toBe(3);
	});

	it("should handle mixed explicit and implicit lanes with overlaps", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",
					endDate: "2024-01-10",
					lane: 0,
				},
				{
					id: "t2",
					workstreamId: "ws1",
					name: "Task 2",
					startDate: "2024-01-05",
					endDate: "2024-01-15",
				},
				{
					id: "t3",
					workstreamId: "ws1",
					name: "Task 3",
					startDate: "2024-01-05",
					endDate: "2024-01-15",
				},
			],
			legend: [],
		};

		const layout = buildLayout(project);

		expect(layout.taskPositions.get("t1")?.rowIndex).toBe(0);
		expect(layout.taskPositions.get("t2")?.rowIndex).toBe(1);
		expect(layout.taskPositions.get("t3")?.rowIndex).toBe(2);
	});

	it("should handle workstream with only explicit lane tasks", () => {
		const project: GanttProject = {
			id: "p1",
			name: "Project",
			workstreams: [
				{ id: "ws1", name: "WS1", order: 0, color: "#000000" },
			],
			workItems: [
				{
					id: "t1",
					workstreamId: "ws1",
					name: "Task 1",
					startDate: "2024-01-01",