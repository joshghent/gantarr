Looking at the source file, I need to understand the types and store module to write proper tests. Let me check what's available by examining the types used (`GanttProject`, `Workstream`, `WorkItem`, `LegendEntry`, `ViewMode`) and the `gantt-store` module functions being wrapped.

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GanttProvider, useGantt } from "./gantt-context";
import type { GanttProject } from "../types";

function makeProject(): GanttProject {
	return {
		id: "proj-1",
		name: "Test Project",
		workstreams: [
			{
				id: "ws-1",
				label: "Workstream One",
				order: 0,
			},
		],
		workItems: [
			{
				id: "wi-1",
				workstreamId: "ws-1",
				title: "Task One",
				startDate: "2026-01-01",
				endDate: "2026-01-05",
				lane: 0,
			},
		],
		dependencies: [],
		legend: [],
	} as unknown as GanttProject;
}

function renderGanttHook(initialProject = makeProject()) {
	return renderHook(() => useGantt(), {
		wrapper: ({ children }) => (
			<GanttProvider initialProject={initialProject}>
				{children}
			</GanttProvider>
		),
	});
}

describe("useGantt", () => {
	it("throws when used outside of a GanttProvider", () => {
		expect(() => renderHook(() => useGantt())).toThrow(
			"useGantt must be used within GanttProvider",
		);
	});

	it("exposes the initial project and default UI state", () => {
		const project = makeProject();
		const { result } = renderGanttHook(project);

		expect(result.current.project).toEqual(project);
		expect(result.current.viewMode).toBe("days");
		expect(result.current.isDirty).toBe(false);
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.connectingFrom).toBeNull();
		expect(result.current.editingItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
		expect(result.current.viewportDateRef.current).toBeNull();
	});
});

describe("GanttProvider dirty tracking", () => {
	it("stays clean until a mutator is called", () => {
		const { result } = renderGanttHook();
		expect(result.current.isDirty).toBe(false);
	});

	it("marks dirty after addWorkstream", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.addWorkstream("New Workstream");
		});
		expect(result.current.isDirty).toBe(true);
		expect(
			result.current.project.workstreams.some(
				(ws) => ws.label === "New Workstream",
			),
		).toBe(true);
	});

	it("marks dirty after setProject (whole-project replacement)", () => {
		const { result } = renderGanttHook();
		const replacement = makeProject();
		replacement.name = "Renamed";
		act(() => {
			result.current.setProject(replacement);
		});
		expect(result.current.isDirty).toBe(true);
		expect(result.current.project.name).toBe("Renamed");
	});

	it("markClean resets isDirty to false", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.addWorkstream("Another one");
		});
		expect(result.current.isDirty).toBe(true);

		act(() => {
			result.current.markClean();
		});
		expect(result.current.isDirty).toBe(false);
	});
});

describe("GanttProvider viewMode", () => {
	it("updates the view mode", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.setViewMode("weeks");
		});
		expect(result.current.viewMode).toBe("weeks");
	});
});

describe("GanttProvider workstream operations", () => {
	it("addWorkstream adds a new workstream to the project", () => {
		const { result } = renderGanttHook();
		const before = result.current.project.workstreams.length;
		act(() => {
			result.current.addWorkstream("Design");
		});
		expect(result.current.project.workstreams.length).toBe(before + 1);
	});

	it("updateWorkstream changes fields on an existing workstream", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.updateWorkstream("ws-1", { label: "Renamed WS" });
		});
		const ws = result.current.project.workstreams.find(
			(w) => w.id === "ws-1",
		);
		expect(ws?.label).toBe("Renamed WS");
		expect(result.current.isDirty).toBe(true);
	});

	it("deleteWorkstream removes the workstream from the project", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.deleteWorkstream("ws-1");
		});
		expect(
			result.current.project.workstreams.find((w) => w.id === "ws-1"),
		).toBeUndefined();
	});
});

describe("GanttProvider work item operations", () => {
	it("addWorkItem adds a new item to the given workstream", () => {
		const { result } = renderGanttHook();
		const before = result.current.project.workItems.length;
		act(() => {
			result.current.addWorkItem(
				"ws-1",
				"New Task",
				"2026-02-01",
				"2026-02-05",
			);
		});
		expect(result.current.project.workItems.length).toBe(before + 1);
		const added = result.current.project.workItems.find(
			(i) => i.title === "New Task",
		);
		expect(added?.workstreamId).toBe("ws-1");
	});

	it("updateWorkItem changes fields on an existing item", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.updateWorkItem("wi-1", { title: "Updated Title" });
		});
		const item = result.current.project.workItems.find((i) => i.id === "wi-1");
		expect(item?.title).toBe("Updated Title");
	});

	it("moveWorkItemToWorkstream reassigns the item's workstreamId", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.addWorkstream("Second WS");
		});
		const secondWs = result.current.project.workstreams.find(
			(w) => w.label === "Second WS",
		);
		expect(secondWs).toBeDefined();

		act(() => {
			result.current.moveWorkItemToWorkstream("wi-1", secondWs!.id, 1);
		});
		const item = result.current.project.workItems.find((i) => i.id === "wi-1");
		expect(item?.workstreamId).toBe(secondWs!.id);
	});

	it("deleteWorkItem removes the item and clears selection/modal state", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.setSelectedItemId("wi-1");
			result.current.setModalItemId("wi-1");
		});
		expect(result.current.selectedItemId).toBe("wi-1");
		expect(result.current.modalItemId).toBe("wi-1");

		act(() => {
			result.current.deleteWorkItem("wi-1");
		});

		expect(
			result.current.project.workItems.find((i) => i.id === "wi-1"),
		).toBeUndefined();
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
	});
});

describe("GanttProvider dependency operations", () => {
	it("addDependency creates a dependency between two items", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.addWorkItem("ws-1", "Task Two", "2026-01-06", "2026-01-10");
		});
		const second = result.current.project.workItems.find(
			(i) => i.title === "Task Two",
		);
		expect(second).toBeDefined();

		act(() => {
			result.current.addDependency("wi-1", second!.id);
		});

		expect(
			result.current.project.dependencies.some(
				(d) => d.fromItemId === "wi-1" && d.toItemId === second!.id,
			),
		).toBe(true);
	});

	it("deleteDependency removes a dependency by id", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.addWorkItem("ws-1", "Task Two", "2026-01-06", "2026-01-10");
		});
		const second = result.current.project.workItems.find(
			(i) => i.title === "Task Two",
		);
		act(() => {
			result.current.addDependency("wi-1", second!.id);
		});
		const dep = result.current.project.dependencies.find(
			(d) => d.fromItemId === "wi-1" && d.toItemId === second!.id,
		);
		expect(dep).toBeDefined();

		act(() => {
			result.current.deleteDependency(dep!.id);
		});

		expect(
			result.current.project.dependencies.find((d) => d.id === dep!.id),
		).toBeUndefined();
	});
});

describe("GanttProvider legend operations", () => {
	it("addLegendEntry adds a new legend entry", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.addLegendEntry("Blocked", "#ff0000");
		});
		expect(
			result.current.project.legend.some((l) => l.label === "Blocked"),
		).toBe(true);
	});

	it("updateLegendEntry updates an existing legend entry", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.addLegendEntry("Blocked", "#ff0000");
		});
		const entry = result.current.project.legend.find(
			(l) => l.label === "Blocked",
		);
		expect(entry).toBeDefined();

		act(() => {
			result.current.updateLegendEntry(entry!.id, { label: "At Risk" });
		});

		const updated = result.current.project.legend.find(
			(l) => l.id === entry!.id,
		);
		expect(updated?.label).toBe("At Risk");
	});

	it("deleteLegendEntry removes a legend entry by id", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.addLegendEntry("Blocked", "#ff0000");
		});
		const entry = result.current.project.legend.find(
			(l) => l.label === "Blocked",
		);
		expect(entry).toBeDefined();

		act(() => {
			result.current.deleteLegendEntry(entry!.id);
		});

		expect(
			result.current.project.legend.find((l) => l.id === entry!.id),
		).toBeUndefined();
	});
});

describe("GanttProvider UI state setters", () => {
	it("updates selectedItemId", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.setSelectedItemId("wi-1");
		});
		expect(result.current.selectedItemId).toBe("wi-1");

		act(() => {
			result.current.setSelectedItemId(null);
		});
		expect(result.current.selectedItemId).toBeNull();
	});

	it("updates connectingFrom", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.setConnectingFrom("wi-1");
		});
		expect(result.current.connectingFrom).toBe("wi-1");
	});

	it("updates editingItemId", () => {
		const { result } = renderGanttHook();
		act(() => {
			result.current.setEditingItemId("wi-1");
		});
		expect(result.current.editingItemId).toBe("wi-