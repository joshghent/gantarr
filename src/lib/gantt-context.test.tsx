Looking at the source file, I need to check the types file and gantt-store to understand the structures used.

```tsx
import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GanttProvider, useGantt } from "./gantt-context";
import type { GanttProject } from "../types";

function makeProject(): GanttProject {
	return {
		id: "proj-1",
		name: "Test Project",
		startDate: "2026-01-01",
		workstreams: [
			{
				id: "ws-1",
				label: "Engineering",
				order: 0,
				items: [
					{
						id: "item-1",
						workstreamId: "ws-1",
						title: "Build API",
						startDate: "2026-01-05",
						endDate: "2026-01-10",
						lane: 0,
					},
				],
			},
		],
		dependencies: [],
		legend: [],
	};
}

function wrapper({ children }: { children: React.ReactNode }) {
	return (
		<GanttProvider initialProject={makeProject()}>{children}</GanttProvider>
	);
}

describe("useGantt", () => {
	it("throws when used outside a GanttProvider", () => {
		// suppress React's console.error for the expected throw
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => renderHook(() => useGantt())).toThrow(
			"useGantt must be used within GanttProvider",
		);
		spy.mockRestore();
	});

	it("provides the initial project and default view mode", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		expect(result.current.project.name).toBe("Test Project");
		expect(result.current.viewMode).toBe("days");
		expect(result.current.isDirty).toBe(false);
	});
});

describe("GanttProvider - dirty tracking", () => {
	it("starts clean", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		expect(result.current.isDirty).toBe(false);
	});

	it("marks dirty after addWorkstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addWorkstream("QA");
		});
		expect(result.current.isDirty).toBe(true);
		expect(
			result.current.project.workstreams.some((w) => w.label === "QA"),
		).toBe(true);
	});

	it("marks dirty after setProject", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		const newProject = { ...result.current.project, name: "Renamed" };
		act(() => {
			result.current.setProject(newProject);
		});
		expect(result.current.isDirty).toBe(true);
		expect(result.current.project.name).toBe("Renamed");
	});

	it("markClean resets isDirty to false", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addWorkstream("QA");
		});
		expect(result.current.isDirty).toBe(true);
		act(() => {
			result.current.markClean();
		});
		expect(result.current.isDirty).toBe(false);
	});

	it("does not mark dirty just from mounting with the initial project", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		expect(result.current.isDirty).toBe(false);
	});
});

describe("GanttProvider - viewMode", () => {
	it("setViewMode updates viewMode without touching isDirty", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.setViewMode("weeks");
		});
		expect(result.current.viewMode).toBe("weeks");
		expect(result.current.isDirty).toBe(false);
	});
});

describe("GanttProvider - workstream operations", () => {
	it("addWorkstream adds a new workstream with the given label", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addWorkstream("Design");
		});
		const ws = result.current.project.workstreams.find(
			(w) => w.label === "Design",
		);
		expect(ws).toBeDefined();
	});

	it("updateWorkstream updates fields on an existing workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.updateWorkstream("ws-1", { label: "Backend" });
		});
		const ws = result.current.project.workstreams.find((w) => w.id === "ws-1");
		expect(ws?.label).toBe("Backend");
	});

	it("deleteWorkstream removes the workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.deleteWorkstream("ws-1");
		});
		expect(
			result.current.project.workstreams.find((w) => w.id === "ws-1"),
		).toBeUndefined();
	});
});

describe("GanttProvider - work item operations", () => {
	it("addWorkItem adds an item to the specified workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addWorkItem(
				"ws-1",
				"New Task",
				"2026-02-01",
				"2026-02-05",
			);
		});
		const ws = result.current.project.workstreams.find((w) => w.id === "ws-1");
		expect(ws?.items.some((i) => i.title === "New Task")).toBe(true);
	});

	it("updateWorkItem updates fields on an existing item", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.updateWorkItem("item-1", { title: "Renamed Task" });
		});
		const ws = result.current.project.workstreams.find((w) => w.id === "ws-1");
		const item = ws?.items.find((i) => i.id === "item-1");
		expect(item?.title).toBe("Renamed Task");
	});

	it("moveWorkItemToWorkstream moves an item to a new workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addWorkstream("QA");
		});
		const target = result.current.project.workstreams.find(
			(w) => w.label === "QA",
		);
		expect(target).toBeDefined();
		act(() => {
			result.current.moveWorkItemToWorkstream("item-1", target!.id);
		});
		const originalWs = result.current.project.workstreams.find(
			(w) => w.id === "ws-1",
		);
		const newWs = result.current.project.workstreams.find(
			(w) => w.id === target!.id,
		);
		expect(originalWs?.items.some((i) => i.id === "item-1")).toBe(false);
		expect(newWs?.items.some((i) => i.id === "item-1")).toBe(true);
	});

	it("deleteWorkItem removes the item and clears selection/modal state", () => {
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

		const ws = result.current.project.workstreams.find((w) => w.id === "ws-1");
		expect(ws?.items.some((i) => i.id === "item-1")).toBe(false);
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
	});
});

describe("GanttProvider - dependency operations", () => {
	it("addDependency adds a dependency between two items", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addWorkItem(
				"ws-1",
				"Second Task",
				"2026-02-01",
				"2026-02-05",
			);
		});
		const ws = result.current.project.workstreams.find((w) => w.id === "ws-1");
		const secondItem = ws?.items.find((i) => i.title === "Second Task");
		expect(secondItem).toBeDefined();

		act(() => {
			result.current.addDependency("item-1", secondItem!.id);
		});
		expect(result.current.project.dependencies.length).toBe(1);
		expect(result.current.project.dependencies[0]).toMatchObject({
			fromItemId: "item-1",
			toItemId: secondItem!.id,
		});
	});

	it("deleteDependency removes the dependency", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addWorkItem(
				"ws-1",
				"Second Task",
				"2026-02-01",
				"2026-02-05",
			);
		});
		const ws = result.current.project.workstreams.find((w) => w.id === "ws-1");
		const secondItem = ws?.items.find((i) => i.title === "Second Task");
		act(() => {
			result.current.addDependency("item-1", secondItem!.id);
		});
		const depId = result.current.project.dependencies[0].id;

		act(() => {
			result.current.deleteDependency(depId);
		});
		expect(result.current.project.dependencies.length).toBe(0);
	});
});

describe("GanttProvider - legend operations", () => {
	it("addLegendEntry adds a legend entry", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addLegendEntry("Critical", "#ff0000");
		});
		expect(
			result.current.project.legend.some((l) => l.label === "Critical"),
		).toBe(true);
	});

	it("updateLegendEntry updates an existing entry", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addLegendEntry("Critical", "#ff0000");
		});
		const entry = result.current.project.legend.find(
			(l) => l.label === "Critical",
		);
		expect(entry).toBeDefined();

		act(() => {
			result.current.updateLegendEntry(entry!.id, { color: "#00ff00" });
		});
		const updated = result.current.project.legend.find(
			(l) => l.id === entry!.id,
		);
		expect(updated?.color).toBe("#00ff00");
	});

	it("deleteLegendEntry removes the entry", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addLegendEntry("Critical", "#ff0000");
		});
		const entry = result.current.project.legend.find(
			(l) => l.label === "Critical",
		);
		act(() => {
			result.current.deleteLegendEntry(entry!.id);
		});
		expect(
			result.current.project.legend.some((l) => l.id === entry!.id),
		).toBe(false);
	});
});

describe("GanttProvider - UI state", () => {
	it("manages selectedItemId", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.setSelectedItemId("item-1");
		});
		expect(result.current.selectedItemId).toBe("item-1");
		act(() => {
			result.current.setSelectedItemId(null);
		});
		expect(result.current.selectedItemId).toBeNull();
	});

	it("manages connectingFrom",