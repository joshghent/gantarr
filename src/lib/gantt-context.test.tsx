Looking at the source file, I need to understand the types it depends on. Let me check the store module usage patterns and types to create appropriate test fixtures.

```tsx
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { GanttProvider, useGantt } from "./gantt-context";
import type { GanttProject } from "../types";

function makeProject(): GanttProject {
	return {
		id: "proj-1",
		name: "Test Project",
		startDate: "2026-01-01",
		endDate: "2026-03-01",
		workstreams: [
			{
				id: "ws-1",
				label: "Engineering",
				order: 0,
				items: [
					{
						id: "item-1",
						title: "Design",
						startDate: "2026-01-05",
						endDate: "2026-01-10",
						lane: 0,
					},
					{
						id: "item-2",
						title: "Build",
						startDate: "2026-01-11",
						endDate: "2026-01-20",
						lane: 0,
					},
				],
			},
		],
		dependencies: [],
		legend: [{ id: "legend-1", label: "Critical", color: "#ff0000" }],
	} as unknown as GanttProject;
}

function wrapper({ children }: { children: ReactNode }) {
	return (
		<GanttProvider initialProject={makeProject()}>{children}</GanttProvider>
	);
}

describe("useGantt", () => {
	it("throws when used outside a GanttProvider", () => {
		expect(() => renderHook(() => useGantt())).toThrow(
			"useGantt must be used within GanttProvider",
		);
	});
});

describe("GanttProvider", () => {
	it("provides the initial project and default view mode", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		expect(result.current.project.name).toBe("Test Project");
		expect(result.current.viewMode).toBe("days");
		expect(result.current.isDirty).toBe(false);
	});

	it("starts with clean dirty state and no selections", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		expect(result.current.isDirty).toBe(false);
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.connectingFrom).toBeNull();
		expect(result.current.editingItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
		expect(result.current.viewportDateRef.current).toBeNull();
	});

	it("changes the view mode", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.setViewMode("weeks");
		});
		expect(result.current.viewMode).toBe("weeks");
		// view mode change doesn't dirty the project
		expect(result.current.isDirty).toBe(false);
	});

	describe("setProject", () => {
		it("replaces the whole project and marks dirty", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			const newProject = { ...makeProject(), name: "Replaced" };
			act(() => {
				result.current.setProject(newProject);
			});
			expect(result.current.project.name).toBe("Replaced");
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("markClean", () => {
		it("resets dirty flag without touching the project", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.addWorkstream("New Stream");
			});
			expect(result.current.isDirty).toBe(true);
			const projectBefore = result.current.project;
			act(() => {
				result.current.markClean();
			});
			expect(result.current.isDirty).toBe(false);
			expect(result.current.project).toBe(projectBefore);
		});
	});

	describe("workstream operations", () => {
		it("addWorkstream adds a new workstream and marks dirty", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			const before = result.current.project.workstreams.length;
			act(() => {
				result.current.addWorkstream("QA");
			});
			expect(result.current.project.workstreams.length).toBe(before + 1);
			expect(
				result.current.project.workstreams.some((w) => w.label === "QA"),
			).toBe(true);
			expect(result.current.isDirty).toBe(true);
		});

		it("updateWorkstream updates fields on an existing workstream", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.updateWorkstream("ws-1", { label: "Renamed" });
			});
			const ws = result.current.project.workstreams.find(
				(w) => w.id === "ws-1",
			);
			expect(ws?.label).toBe("Renamed");
			expect(result.current.isDirty).toBe(true);
		});

		it("deleteWorkstream removes the workstream", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.deleteWorkstream("ws-1");
			});
			expect(
				result.current.project.workstreams.find((w) => w.id === "ws-1"),
			).toBeUndefined();
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("work item operations", () => {
		it("addWorkItem adds an item to the given workstream", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.addWorkItem(
					"ws-1",
					"New Task",
					"2026-02-01",
					"2026-02-05",
				);
			});
			const ws = result.current.project.workstreams.find(
				(w) => w.id === "ws-1",
			);
			expect(ws?.items.some((i) => i.title === "New Task")).toBe(true);
			expect(result.current.isDirty).toBe(true);
		});

		it("addWorkItem works with optional args omitted", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			expect(() => {
				act(() => {
					result.current.addWorkItem("ws-1", "Minimal Task");
				});
			}).not.toThrow();
			const ws = result.current.project.workstreams.find(
				(w) => w.id === "ws-1",
			);
			expect(ws?.items.some((i) => i.title === "Minimal Task")).toBe(true);
		});

		it("updateWorkItem updates an existing item's fields", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.updateWorkItem("item-1", { title: "Renamed Item" });
			});
			const ws = result.current.project.workstreams.find(
				(w) => w.id === "ws-1",
			);
			const item = ws?.items.find((i) => i.id === "item-1");
			expect(item?.title).toBe("Renamed Item");
			expect(result.current.isDirty).toBe(true);
		});

		it("moveWorkItemToWorkstream moves an item into a different workstream", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.addWorkstream("Target");
			});
			const targetWs = result.current.project.workstreams.find(
				(w) => w.label === "Target",
			);
			expect(targetWs).toBeDefined();

			act(() => {
				result.current.moveWorkItemToWorkstream(
					"item-1",
					targetWs?.id ?? "",
					0,
				);
			});

			const originWs = result.current.project.workstreams.find(
				(w) => w.id === "ws-1",
			);
			const newTargetWs = result.current.project.workstreams.find(
				(w) => w.id === targetWs?.id,
			);
			expect(originWs?.items.some((i) => i.id === "item-1")).toBe(false);
			expect(newTargetWs?.items.some((i) => i.id === "item-1")).toBe(true);
		});

		it("deleteWorkItem removes the item and clears selected/modal ids", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.setSelectedItemId("item-1");
				result.current.setModalItemId("item-1");
			});
			expect(result.current.selectedItemId).toBe("item-1");
			expect(result.current.modalItemId).toBe("item-1");

			act(() => {
				result.current.deleteWorkItem("item-1");
			});

			const ws = result.current.project.workstreams.find(
				(w) => w.id === "ws-1",
			);
			expect(ws?.items.some((i) => i.id === "item-1")).toBe(false);
			expect(result.current.selectedItemId).toBeNull();
			expect(result.current.modalItemId).toBeNull();
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("dependency operations", () => {
		it("addDependency creates a dependency between two items", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.addDependency("item-1", "item-2");
			});
			expect(result.current.project.dependencies.length).toBe(1);
			expect(result.current.project.dependencies[0]).toMatchObject({
				fromItemId: "item-1",
				toItemId: "item-2",
			});
			expect(result.current.isDirty).toBe(true);
		});

		it("deleteDependency removes a dependency by id", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.addDependency("item-1", "item-2");
			});
			const depId = result.current.project.dependencies[0].id;

			act(() => {
				result.current.deleteDependency(depId);
			});

			expect(result.current.project.dependencies.length).toBe(0);
		});
	});

	describe("legend operations", () => {
		it("addLegendEntry adds a new legend entry", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.addLegendEntry("Blocked", "#000000");
			});
			expect(
				result.current.project.legend.some((l) => l.label === "Blocked"),
			).toBe(true);
			expect(result.current.isDirty).toBe(true);
		});

		it("updateLegendEntry updates an existing entry", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.updateLegendEntry("legend-1", { label: "Updated" });
			});
			const entry = result.current.project.legend.find(
				(l) => l.id === "legend-1",
			);
			expect(entry?.label).toBe("Updated");
			expect(result.current.isDirty).toBe(true);
		});

		it("deleteLegendEntry removes an entry", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.deleteLegendEntry("legend-1");
			});
			expect(
				result.current.project.legend.some((l) => l.id === "legend-1"),
			).toBe(false);
			expect(result.current.isDirty).toBe(true);
		});
	});

	describe("UI state setters", () => {
		it("setSelectedItemId updates the selected item", () => {
			const { result } = renderHook(() => useGantt(), { wrapper });
			act(() => {
				result.current.setSelectedItemId("item-1");
			});
			expect(result.current.selectedItemId).toBe("item-1");

			act(()