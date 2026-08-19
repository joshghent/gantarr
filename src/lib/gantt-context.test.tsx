import { act, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GanttProvider, useGantt } from "./gantt-context";
import type { GanttProject } from "../types";

function makeProject(): GanttProject {
	return {
		id: "proj-1",
		name: "Test Project",
		workstreams: [
			{
				id: "ws-1",
				label: "Workstream 1",
				items: [
					{
						id: "item-1",
						title: "Task 1",
						startDate: "2026-01-01",
						endDate: "2026-01-05",
					},
				],
			},
		],
		dependencies: [],
		legend: [],
	} as unknown as GanttProject;
}

function wrapper({ children }: { children: React.ReactNode }) {
	return (
		<GanttProvider initialProject={makeProject()}>{children}</GanttProvider>
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("useGantt", () => {
	it("throws when used outside of GanttProvider", () => {
		// Suppress React's error boundary console noise for this expected throw.
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

describe("GanttProvider - view mode & UI state", () => {
	it("updates view mode", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.setViewMode("weeks"));
		expect(result.current.viewMode).toBe("weeks");
	});

	it("updates selectedItemId, connectingFrom, editingItemId, modalItemId", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });

		act(() => result.current.setSelectedItemId("item-1"));
		expect(result.current.selectedItemId).toBe("item-1");

		act(() => result.current.setConnectingFrom("item-1"));
		expect(result.current.connectingFrom).toBe("item-1");

		act(() => result.current.setEditingItemId("item-1"));
		expect(result.current.editingItemId).toBe("item-1");

		act(() => result.current.setModalItemId("item-1"));
		expect(result.current.modalItemId).toBe("item-1");

		act(() => result.current.setSelectedItemId(null));
		expect(result.current.selectedItemId).toBeNull();
	});

	it("exposes a stable viewportDateRef object across renders", () => {
		const { result, rerender } = renderHook(() => useGantt(), { wrapper });
		const ref = result.current.viewportDateRef;
		expect(ref.current).toBeNull();
		act(() => {
			ref.current = "2026-01-10";
		});
		rerender();
		expect(result.current.viewportDateRef.current).toBe("2026-01-10");
		expect(result.current.viewportDateRef).toBe(ref);
	});
});

describe("GanttProvider - dirty tracking", () => {
	it("starts clean and does not mark dirty until a mutation occurs", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		expect(result.current.isDirty).toBe(false);
	});

	it("marks dirty after addWorkstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("New Workstream"));
		expect(result.current.isDirty).toBe(true);
	});

	it("marks dirty after setProject", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.setProject(makeProject()));
		expect(result.current.isDirty).toBe(true);
	});

	it("markClean resets isDirty to false", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("New Workstream"));
		expect(result.current.isDirty).toBe(true);
		act(() => result.current.markClean());
		expect(result.current.isDirty).toBe(false);
	});
});

describe("GanttProvider - workstream operations", () => {
	it("addWorkstream adds a new workstream with the given label", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("Design"));
		const labels = result.current.project.workstreams.map((w) => w.label);
		expect(labels).toContain("Design");
	});

	it("updateWorkstream updates the label of an existing workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.updateWorkstream("ws-1", { label: "Renamed" }));
		const ws = result.current.project.workstreams.find((w) => w.id === "ws-1");
		expect(ws?.label).toBe("Renamed");
	});

	it("deleteWorkstream removes the workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.deleteWorkstream("ws-1"));
		expect(
			result.current.project.workstreams.find((w) => w.id === "ws-1"),
		).toBeUndefined();
	});
});

describe("GanttProvider - work item operations", () => {
	it("addWorkItem adds a new item to the given workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() =>
			result.current.addWorkItem(
				"ws-1",
				"New Task",
				"2026-02-01",
				"2026-02-10",
			),
		);
		const ws = result.current.project.workstreams.find((w) => w.id === "ws-1");
		expect(ws?.items.some((i) => i.title === "New Task")).toBe(true);
	});

	it("updateWorkItem updates fields on an existing item", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() =>
			result.current.updateWorkItem("item-1", { title: "Updated title" }),
		);
		const ws = result.current.project.workstreams[0];
		const item = ws.items.find((i) => i.id === "item-1");
		expect(item?.title).toBe("Updated title");
	});

	it("moveWorkItemToWorkstream moves an item into a new workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("Target"));
		const targetWs = result.current.project.workstreams.find(
			(w) => w.label === "Target",
		);
		expect(targetWs).toBeDefined();

		act(() =>
			result.current.moveWorkItemToWorkstream("item-1", targetWs!.id),
		);

		const updatedTarget = result.current.project.workstreams.find(
			(w) => w.id === targetWs!.id,
		);
		const originalWs = result.current.project.workstreams.find(
			(w) => w.id === "ws-1",
		);
		expect(updatedTarget?.items.some((i) => i.id === "item-1")).toBe(true);
		expect(originalWs?.items.some((i) => i.id === "item-1")).toBe(false);
	});

	it("deleteWorkItem removes the item and clears selection/modal state", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.setSelectedItemId("item-1"));
		act(() => result.current.setModalItemId("item-1"));

		act(() => result.current.deleteWorkItem("item-1"));

		const ws = result.current.project.workstreams[0];
		expect(ws.items.some((i) => i.id === "item-1")).toBe(false);
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
	});
});

describe("GanttProvider - dependency operations", () => {
	it("addDependency creates a dependency between two items", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() =>
			result.current.addWorkItem(
				"ws-1",
				"Task 2",
				"2026-01-06",
				"2026-01-10",
			),
		);
		const ws = result.current.project.workstreams[0];
		const secondItem = ws.items.find((i) => i.title === "Task 2");
		expect(secondItem).toBeDefined();

		act(() => result.current.addDependency("item-1", secondItem!.id));

		expect(
			result.current.project.dependencies.some(
				(d) => d.fromItemId === "item-1" && d.toItemId === secondItem!.id,
			),
		).toBe(true);
	});

	it("deleteDependency removes a dependency by id", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() =>
			result.current.addWorkItem(
				"ws-1",
				"Task 2",
				"2026-01-06",
				"2026-01-10",
			),
		);
		const ws = result.current.project.workstreams[0];
		const secondItem = ws.items.find((i) => i.title === "Task 2");
		act(() => result.current.addDependency("item-1", secondItem!.id));

		const dep = result.current.project.dependencies[0];
		expect(dep).toBeDefined();

		act(() => result.current.deleteDependency(dep.id));
		expect(
			result.current.project.dependencies.find((d) => d.id === dep.id),
		).toBeUndefined();
	});
});

describe("GanttProvider - legend operations", () => {
	it("addLegendEntry adds a new legend entry", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addLegendEntry("Priority", "#ff0000"));
		expect(
			result.current.project.legend.some((l) => l.label === "Priority"),
		).toBe(true);
	});

	it("updateLegendEntry updates an existing legend entry", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addLegendEntry("Priority", "#ff0000"));
		const entry = result.current.project.legend.find(
			(l) => l.label === "Priority",
		);
		expect(entry).toBeDefined();

		act(() =>
			result.current.updateLegendEntry(entry!.id, { label: "Urgency" }),
		);
		const updated = result.current.project.legend.find(
			(l) => l.id === entry!.id,
		);
		expect(updated?.label).toBe("Urgency");
	});

	it("deleteLegendEntry removes a legend entry", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addLegendEntry("Priority", "#ff0000"));
		const entry = result.current.project.legend.find(
			(l) => l.label === "Priority",
		);
		expect(entry).toBeDefined();

		act(() => result.current.deleteLegendEntry(entry!.id));
		expect(
			result.current.project.legend.find((l) => l.id === entry!.id),
		).toBeUndefined();
	});
});

describe("GanttProvider - beforeunload guard", () => {
	it("registers a beforeunload handler once the project becomes