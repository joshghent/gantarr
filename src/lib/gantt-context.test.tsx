import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
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
			order: 0,
		},
	],
	workItems: [
		{
			id: "item1",
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

describe("useGantt", () => {
	it("should throw error when used outside GanttProvider", () => {
		expect(() => {
			renderHook(() => useGantt());
		}).toThrow("useGantt must be used within GanttProvider");
	});

	it("should provide context value when used inside GanttProvider", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
		);
		const { result } = renderHook(() => useGantt(), { wrapper });

		expect(result.current).toBeDefined();
		expect(result.current.project).toEqual(mockProject);
	});
});

describe("GanttProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should initialize with provided project", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
		);
		const { result } = renderHook(() => useGantt(), { wrapper });

		expect(result.current.project).toEqual(mockProject);
	});

	it("should initialize view mode to days", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
		);
		const { result } = renderHook(() => useGantt(), { wrapper });

		expect(result.current.viewMode).toBe("days");
	});

	it("should initialize isDirty to false", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
		);
		const { result } = renderHook(() => useGantt(), { wrapper });

		expect(result.current.isDirty).toBe(false);
	});

	it("should initialize UI state to null", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
		);
		const { result } = renderHook(() => useGantt(), { wrapper });

		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.connectingFrom).toBeNull();
		expect(result.current.editingItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
	});

	describe("setViewMode", () => {
		it("should update view mode", () => {
			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.setViewMode("weeks");
			});

			expect(result.current.viewMode).toBe("weeks");
		});
	});

	describe("setProject", () => {
		it("should update project and mark dirty", () => {
			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			const newProject = { ...mockProject, name: "Updated Project" };
			act(() => {
				result.current.setProject(newProject);
			});

			expect(result.current.project).toEqual(newProject);
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("markClean", () => {
		it("should set isDirty to false", () => {
			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.setProject({ ...mockProject });
				result.current.markClean();
			});

			expect(result.current.isDirty).toBe(false);
		});
	});

	describe("addWorkstream", () => {
		it("should call store.addWorkstream and mark dirty", () => {
			const updatedProject = {
				...mockProject,
				workstreams: [...mockProject.workstreams, { id: "ws2", label: "New Stream", order: 1 }],
			};
			vi.mocked(store.addWorkstream).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.addWorkstream("New Stream");
			});

			expect(store.addWorkstream).toHaveBeenCalledWith(mockProject, "New Stream");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("updateWorkstream", () => {
		it("should call store.updateWorkstream and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.updateWorkstream).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.updateWorkstream("ws1", { label: "Updated Label" });
			});

			expect(store.updateWorkstream).toHaveBeenCalledWith(mockProject, "ws1", { label: "Updated Label" });
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("deleteWorkstream", () => {
		it("should call store.deleteWorkstream and mark dirty", () => {
			const updatedProject = { ...mockProject, workstreams: [] };
			vi.mocked(store.deleteWorkstream).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.deleteWorkstream("ws1");
			});

			expect(store.deleteWorkstream).toHaveBeenCalledWith(mockProject, "ws1");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("addWorkItem", () => {
		it("should call store.addWorkItem and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.addWorkItem).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.addWorkItem("ws1", "New Task", "2024-01-01", "2024-01-05", "legend1", 0);
			});

			expect(store.addWorkItem).toHaveBeenCalledWith(
				mockProject,
				"ws1",
				"New Task",
				"2024-01-01",
				"2024-01-05",
				"legend1",
				0,
			);
			expect(result.current.isDirty).toBe(true);
		});

		it("should handle optional parameters", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.addWorkItem).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

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
		});
	});

	describe("updateWorkItem", () => {
		it("should call store.updateWorkItem and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.updateWorkItem).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.updateWorkItem("item1", { title: "Updated Title" });
			});

			expect(store.updateWorkItem).toHaveBeenCalledWith(mockProject, "item1", { title: "Updated Title" });
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("moveWorkItemToWorkstream", () => {
		it("should call store.moveWorkItemToWorkstream and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.moveWorkItemToWorkstream).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.moveWorkItemToWorkstream("item1", "ws2", 1);
			});

			expect(store.moveWorkItemToWorkstream).toHaveBeenCalledWith(mockProject, "item1", "ws2", 1);
			expect(result.current.isDirty).toBe(true);
		});

		it("should handle optional lane parameter", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.moveWorkItemToWorkstream).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.moveWorkItemToWorkstream("item1", "ws2");
			});

			expect(store.moveWorkItemToWorkstream).toHaveBeenCalledWith(mockProject, "item1", "ws2", undefined);
		});
	});

	describe("deleteWorkItem", () => {
		it("should call store.deleteWorkItem and mark dirty", () => {
			const updatedProject = { ...mockProject, workItems: [] };
			vi.mocked(store.deleteWorkItem).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.setSelectedItemId("item1");
				result.current.setModalItemId("item1");
			});

			act(() => {
				result.current.deleteWorkItem("item1");
			});

			expect(store.deleteWorkItem).toHaveBeenCalledWith(mockProject, "item1");
			expect(result.current.isDirty).toBe(true);
			expect(result.current.selectedItemId).toBeNull();
			expect(result.current.modalItemId).toBeNull();
		});
	});

	describe("addDependency", () => {
		it("should call store.addDependency and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.addDependency).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.addDependency("item1", "item2");
			});

			expect(store.addDependency).toHaveBeenCalledWith(mockProject, "item1", "item2");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("deleteDependency", () => {
		it("should call store.deleteDependency and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.deleteDependency).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.deleteDependency("dep1");
			});

			expect(store.deleteDependency).toHaveBeenCalledWith(mockProject, "dep1");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("addLegendEntry", () => {
		it("should call store.addLegendEntry and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.addLegendEntry).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</GanttProvider>
			);
			const { result } = renderHook(() => useGantt(), { wrapper });

			act(() => {
				result.current.addLegendEntry("New Category", "#ff0000");
			});

			expect(store.addLegendEntry).toHaveBeenCalledWith(mockProject, "New Category", "#ff0000");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("updateLegendEntry", () => {
		it("should call store.updateLegendEntry and mark dirty", () => {
			const updatedProject = { ...mockProject };
			vi.mocked(store.updateLegendEntry).mockReturnValue(updatedProject);

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<GanttProvider initialProject={mockProject}>{children}</Gan