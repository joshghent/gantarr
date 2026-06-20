import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { GanttProvider, useGantt } from "./gantt-context";
import type { GanttProject } from "../types";
import * as store from "./gantt-store";

vi.mock("./gantt-store");

const mockProject: GanttProject = {
	name: "Test Project",
	workstreams: [
		{
			id: "ws1",
			label: "Workstream 1",
		},
	],
	tasks: [
		{
			id: "task1",
			workstreamId: "ws1",
			title: "Task 1",
			startDate: "2024-01-01",
			endDate: "2024-01-05",
			lane: 0,
		},
	],
	dependencies: [],
	legend: [],
};

describe("GanttProvider", () => {
	it("should render children", () => {
		render(
			<GanttProvider initialProject={mockProject}>
				<div>Test Content</div>
			</GanttProvider>,
		);

		expect(screen.getByText("Test Content")).toBeDefined();
	});

	it("should provide initial project", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		expect(result.current.project).toEqual(mockProject);
	});

	it("should provide initial viewMode as days", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		expect(result.current.viewMode).toBe("days");
	});

	it("should start with isDirty as false", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		expect(result.current.isDirty).toBe(false);
	});

	it("should start with null UI state", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.connectingFrom).toBeNull();
		expect(result.current.editingItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
	});
});

describe("useGantt", () => {
	it("should throw error when used outside provider", () => {
		expect(() => {
			renderHook(() => useGantt());
		}).toThrow("useGantt must be used within GanttProvider");
	});
});

describe("GanttContext - viewMode", () => {
	it("should update viewMode", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.setViewMode("weeks");
		});

		expect(result.current.viewMode).toBe("weeks");
	});

	it("should not mark dirty when changing viewMode", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.setViewMode("weeks");
		});

		expect(result.current.isDirty).toBe(false);
	});
});

describe("GanttContext - setProject", () => {
	it("should update project", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		const newProject: GanttProject = {
			...mockProject,
			name: "Updated Project",
		};

		act(() => {
			result.current.setProject(newProject);
		});

		expect(result.current.project.name).toBe("Updated Project");
	});

	it("should mark dirty when setting project", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		const newProject: GanttProject = {
			...mockProject,
			name: "Updated Project",
		};

		act(() => {
			result.current.setProject(newProject);
		});

		expect(result.current.isDirty).toBe(true);
	});
});

describe("GanttContext - markClean", () => {
	it("should reset isDirty flag", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		const newProject: GanttProject = {
			...mockProject,
			name: "Updated",
		};

		act(() => {
			result.current.setProject(newProject);
		});

		expect(result.current.isDirty).toBe(true);

		act(() => {
			result.current.markClean();
		});

		expect(result.current.isDirty).toBe(false);
	});
});

describe("GanttContext - workstream operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should add workstream and mark dirty", () => {
		const updatedProject = {
			...mockProject,
			workstreams: [...mockProject.workstreams, { id: "ws2", label: "New Workstream" }],
		};
		vi.mocked(store.addWorkstream).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.addWorkstream("New Workstream");
		});

		expect(store.addWorkstream).toHaveBeenCalledWith(mockProject, "New Workstream");
		expect(result.current.isDirty).toBe(true);
	});

	it("should update workstream and mark dirty", () => {
		const updatedProject = {
			...mockProject,
			workstreams: [{ id: "ws1", label: "Updated Label" }],
		};
		vi.mocked(store.updateWorkstream).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.updateWorkstream("ws1", { label: "Updated Label" });
		});

		expect(store.updateWorkstream).toHaveBeenCalledWith(mockProject, "ws1", {
			label: "Updated Label",
		});
		expect(result.current.isDirty).toBe(true);
	});

	it("should delete workstream and mark dirty", () => {
		const updatedProject = {
			...mockProject,
			workstreams: [],
		};
		vi.mocked(store.deleteWorkstream).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.deleteWorkstream("ws1");
		});

		expect(store.deleteWorkstream).toHaveBeenCalledWith(mockProject, "ws1");
		expect(result.current.isDirty).toBe(true);
	});
});

describe("GanttContext - work item operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should add work item with all parameters", () => {
		const updatedProject = {
			...mockProject,
			tasks: [
				...mockProject.tasks,
				{
					id: "task2",
					workstreamId: "ws1",
					title: "New Task",
					startDate: "2024-01-10",
					endDate: "2024-01-15",
					legendEntryId: "legend1",
					lane: 1,
				},
			],
		};
		vi.mocked(store.addWorkItem).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.addWorkItem(
				"ws1",
				"New Task",
				"2024-01-10",
				"2024-01-15",
				"legend1",
				1,
			);
		});

		expect(store.addWorkItem).toHaveBeenCalledWith(
			mockProject,
			"ws1",
			"New Task",
			"2024-01-10",
			"2024-01-15",
			"legend1",
			1,
		);
		expect(result.current.isDirty).toBe(true);
	});

	it("should add work item with minimal parameters", () => {
		const updatedProject = {
			...mockProject,
			tasks: [
				...mockProject.tasks,
				{
					id: "task2",
					workstreamId: "ws1",
					title: "New Task",
					startDate: undefined,
					endDate: undefined,
					lane: 0,
				},
			],
		};
		vi.mocked(store.addWorkItem).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.addWorkItem("ws1", "New Task");
		});

		expect(store.addWorkItem).toHaveBeenCalledWith(
			mockProject,
			"ws1",
			"New Task",
			undefined,
			undefined,
			undefined,
			undefined,
		);
		expect(result.current.isDirty).toBe(true);
	});

	it("should update work item and mark dirty", () => {
		const updatedProject = {
			...mockProject,
			tasks: [
				{
					...mockProject.tasks[0],
					title: "Updated Task",
				},
			],
		};
		vi.mocked(store.updateWorkItem).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.updateWorkItem("task1", { title: "Updated Task" });
		});

		expect(store.updateWorkItem).toHaveBeenCalledWith(mockProject, "task1", {
			title: "Updated Task",
		});
		expect(result.current.isDirty).toBe(true);
	});

	it("should move work item to workstream", () => {
		const updatedProject = {
			...mockProject,
			tasks: [
				{
					...mockProject.tasks[0],
					workstreamId: "ws2",
					lane: 2,
				},
			],
		};
		vi.mocked(store.moveWorkItemToWorkstream).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.moveWorkItemToWorkstream("task1", "ws2", 2);
		});

		expect(store.moveWorkItemToWorkstream).toHaveBeenCalledWith(
			mockProject,
			"task1",
			"ws2",
			2,
		);
		expect(result.current.isDirty).toBe(true);
	});

	it("should delete work item and clear UI state", () => {
		const updatedProject = {
			...mockProject,
			tasks: [],
		};
		vi.mocked(store.deleteWorkItem).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.setSelectedItemId("task1");
			result.current.setModalItemId("task1");
		});

		expect(result.current.selectedItemId).toBe("task1");
		expect(result.current.modalItemId).toBe("task1");

		act(() => {
			result.current.deleteWorkItem("task1");
		});

		expect(store.deleteWorkItem).toHaveBeenCalledWith(mockProject, "task1");
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
		expect(result.current.isDirty).toBe(true);
	});
});

describe("GanttContext - dependency operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should add dependency and mark dirty", () => {
		const updatedProject = {
			...mockProject,
			dependencies: [
				{
					id: "dep1",
					fromItemId: "task1",
					toItemId: "task2",
				},
			],
		};
		vi.mocked(store.addDependency).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.addDependency("task1", "task2");
		});

		expect(store.addDependency).toHaveBeenCalledWith(mockProject, "task1", "task2");
		expect(result.current.isDirty).toBe(true);
	});

	it("should delete dependency and mark dirty", () => {
		const updatedProject = {
			...mockProject,
			dependencies: [],
		};
		vi.mocked(store.deleteDependency).mockReturnValue(updatedProject);

		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		act(() => {
			result.current.deleteDependency("dep1");
		});

		expect(store.deleteDependency).toHaveBeenCalledWith(mockProject, "dep1");
		expect(result.current.isDirty).toBe(true);
	});
});

describe("GanttContext - legend operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should add legend entry and