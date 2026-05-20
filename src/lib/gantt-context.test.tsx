import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, waitFor } from "@testing-library/react";
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
			color: "#ff0000",
		},
	],
	workItems: [
		{
			id: "item1",
			workstreamId: "ws1",
			title: "Test Item",
			startDate: "2024-01-01",
			endDate: "2024-01-05",
			lane: 0,
		},
	],
	dependencies: [
		{
			id: "dep1",
			fromItemId: "item1",
			toItemId: "item2",
		},
	],
	legend: [
		{
			id: "legend1",
			label: "Type A",
			color: "#0000ff",
		},
	],
};

describe("useGantt", () => {
	it("should throw error when used outside GanttProvider", () => {
		expect(() => {
			renderHook(() => useGantt());
		}).toThrow("useGantt must be used within GanttProvider");
	});
});

describe("GanttProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render children", () => {
		const { getByText } = render(
			<GanttProvider initialProject={mockProject}>
				<div>Test Child</div>
			</GanttProvider>
		);
		expect(getByText("Test Child")).toBeDefined();
	});

	it("should provide initial project", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		expect(result.current.project).toEqual(mockProject);
	});

	it("should initialize with default viewMode as days", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		expect(result.current.viewMode).toBe("days");
	});

	it("should initialize with isDirty as false", () => {
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			),
		});

		expect(result.current.isDirty).toBe(false);
	});

	it("should initialize with null UI state", () => {
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

	describe("setViewMode", () => {
		it("should update viewMode", () => {
			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.setViewMode("weeks");
			expect(result.current.viewMode).toBe("weeks");
		});
	});

	describe("setProject", () => {
		it("should update project", () => {
			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			const newProject: GanttProject = {
				...mockProject,
				name: "New Project Name",
			};

			result.current.setProject(newProject);
			expect(result.current.project.name).toBe("New Project Name");
		});

		it("should mark project as dirty", () => {
			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			const newProject: GanttProject = {
				...mockProject,
				name: "New Project Name",
			};

			result.current.setProject(newProject);
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("markClean", () => {
		it("should reset isDirty to false", () => {
			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.setProject(mockProject);
			expect(result.current.isDirty).toBe(true);

			result.current.markClean();
			expect(result.current.isDirty).toBe(false);
		});
	});

	describe("addWorkstream", () => {
		it("should call store.addWorkstream and mark dirty", () => {
			const updatedProject = { ...mockProject, workstreams: [...mockProject.workstreams] };
			vi.mocked(store.addWorkstream).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.addWorkstream("New Workstream");

			expect(store.addWorkstream).toHaveBeenCalledWith(mockProject, "New Workstream");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("updateWorkstream", () => {
		it("should call store.updateWorkstream and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.updateWorkstream).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.updateWorkstream("ws1", { label: "Updated Label" });

			expect(store.updateWorkstream).toHaveBeenCalledWith(mockProject, "ws1", { label: "Updated Label" });
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("deleteWorkstream", () => {
		it("should call store.deleteWorkstream and mark dirty", () => {
			const updatedProject = { ...mockProject, workstreams: [] };
			vi.mocked(store.deleteWorkstream).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.deleteWorkstream("ws1");

			expect(store.deleteWorkstream).toHaveBeenCalledWith(mockProject, "ws1");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("addWorkItem", () => {
		it("should call store.addWorkItem with all parameters", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.addWorkItem).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.addWorkItem("ws1", "New Item", "2024-01-01", "2024-01-05", "legend1", 1);

			expect(store.addWorkItem).toHaveBeenCalledWith(
				mockProject,
				"ws1",
				"New Item",
				"2024-01-01",
				"2024-01-05",
				"legend1",
				1
			);
			expect(result.current.isDirty).toBe(true);
		});

		it("should call store.addWorkItem with optional parameters as undefined", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.addWorkItem).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.addWorkItem("ws1", "New Item");

			expect(store.addWorkItem).toHaveBeenCalledWith(
				mockProject,
				"ws1",
				"New Item",
				undefined,
				undefined,
				undefined,
				undefined
			);
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("updateWorkItem", () => {
		it("should call store.updateWorkItem and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.updateWorkItem).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.updateWorkItem("item1", { title: "Updated Title" });

			expect(store.updateWorkItem).toHaveBeenCalledWith(mockProject, "item1", { title: "Updated Title" });
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("moveWorkItemToWorkstream", () => {
		it("should call store.moveWorkItemToWorkstream with lane", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.moveWorkItemToWorkstream).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.moveWorkItemToWorkstream("item1", "ws2", 2);

			expect(store.moveWorkItemToWorkstream).toHaveBeenCalledWith(mockProject, "item1", "ws2", 2);
			expect(result.current.isDirty).toBe(true);
		});

		it("should call store.moveWorkItemToWorkstream without lane", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.moveWorkItemToWorkstream).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.moveWorkItemToWorkstream("item1", "ws2");

			expect(store.moveWorkItemToWorkstream).toHaveBeenCalledWith(mockProject, "item1", "ws2", undefined);
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("deleteWorkItem", () => {
		it("should call store.deleteWorkItem and mark dirty", () => {
			const updatedProject = { ...mockProject, workItems: [] };
			vi.mocked(store.deleteWorkItem).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.deleteWorkItem("item1");

			expect(store.deleteWorkItem).toHaveBeenCalledWith(mockProject, "item1");
			expect(result.current.isDirty).toBe(true);
		});

		it("should reset selectedItemId", () => {
			const updatedProject = { ...mockProject, workItems: [] };
			vi.mocked(store.deleteWorkItem).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.setSelectedItemId("item1");
			expect(result.current.selectedItemId).toBe("item1");

			result.current.deleteWorkItem("item1");
			expect(result.current.selectedItemId).toBeNull();
		});

		it("should reset modalItemId", () => {
			const updatedProject = { ...mockProject, workItems: [] };
			vi.mocked(store.deleteWorkItem).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.setModalItemId("item1");
			expect(result.current.modalItemId).toBe("item1");

			result.current.deleteWorkItem("item1");
			expect(result.current.modalItemId).toBeNull();
		});
	});

	describe("addDependency", () => {
		it("should call store.addDependency and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.addDependency).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.addDependency("item1", "item2");

			expect(store.addDependency).toHaveBeenCalledWith(mockProject, "item1", "item2");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("deleteDependency", () => {
		it("should call store.deleteDependency and mark dirty", () => {
			const updatedProject = { ...mockProject, dependencies: [] };
			vi.mocked(store.deleteDependency).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.deleteDependency("dep1");

			expect(store.deleteDependency).toHaveBeenCalledWith(mockProject, "dep1");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("addLegendEntry", () => {
		it("should call store.addLegendEntry and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.addLegendEntry).mockReturnValue(updatedProject);

			const { result } = renderHook(() => useGantt(), {
				wrapper: ({ children }) => (
					<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
				),
			});

			result.current.addLegendEntry("Type B", "#00ff00");

			expect(store.addLegendEntry).toH