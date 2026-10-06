Looking at the source file, I need to test the `GanttProvider` component and `useGantt` hook. Let me examine the types used to build a minimal valid `GanttProject`.

```tsx
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GanttProject } from "../types";
import { GanttProvider, useGantt } from "./gantt-context";

function makeProject(): GanttProject {
	return {
		workstreams: [],
		workItems: [],
		dependencies: [],
		legendEntries: [],
	} as unknown as GanttProject;
}

function wrapper({ children }: { children: ReactNode }) {
	return (
		<GanttProvider initialProject={makeProject()}>{children}</GanttProvider>
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("useGantt", () => {
	it("throws when used outside of a GanttProvider", () => {
		// Suppress the expected React error logging to keep test output clean.
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => renderHook(() => useGantt())).toThrow(
			"useGantt must be used within GanttProvider",
		);
		spy.mockRestore();
	});

	it("provides the initial project and default UI state", () => {
		const project = makeProject();
		const { result } = renderHook(() => useGantt(), {
			wrapper: ({ children }) => (
				<GanttProvider initialProject={project}>{children}</GanttProvider>
			),
		});

		expect(result.current.project).toBe(project);
		expect(result.current.viewMode).toBe("days");
		expect(result.current.isDirty).toBe(false);
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.connectingFrom).toBeNull();
		expect(result.current.editingItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
		expect(result.current.viewportDateRef.current).toBeNull();
	});
});

describe("GanttProvider - view mode and UI state", () => {
	it("updates viewMode", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.setViewMode("weeks"));
		expect(result.current.viewMode).toBe("weeks");
	});

	it("updates selectedItemId without marking dirty", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.setSelectedItemId("item-1"));
		expect(result.current.selectedItemId).toBe("item-1");
		expect(result.current.isDirty).toBe(false);
	});

	it("updates connectingFrom, editingItemId and modalItemId independently", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.setConnectingFrom("a");
			result.current.setEditingItemId("b");
			result.current.setModalItemId("c");
		});
		expect(result.current.connectingFrom).toBe("a");
		expect(result.current.editingItemId).toBe("b");
		expect(result.current.modalItemId).toBe("c");
	});

	it("allows clearing selection-related ids back to null", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.setSelectedItemId("x"));
		act(() => result.current.setSelectedItemId(null));
		expect(result.current.selectedItemId).toBeNull();
	});
});

describe("GanttProvider - dirty tracking", () => {
	it("starts clean on initial load", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		expect(result.current.isDirty).toBe(false);
	});

	it("marks dirty after addWorkstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("Engineering"));
		expect(result.current.isDirty).toBe(true);
		expect(result.current.project.workstreams.length).toBe(1);
		expect(result.current.project.workstreams[0].label).toBe("Engineering");
	});

	it("marks dirty after setProject (whole-project replacement)", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		const replacement = makeProject();
		act(() => result.current.setProject(replacement));
		expect(result.current.isDirty).toBe(true);
		expect(result.current.project).toBe(replacement);
	});

	it("resets dirty state via markClean", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("Design"));
		expect(result.current.isDirty).toBe(true);
		act(() => result.current.markClean());
		expect(result.current.isDirty).toBe(false);
	});

	it("does not resurrect dirty state after markClean until a new mutation happens", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.markClean());
		expect(result.current.isDirty).toBe(false);
	});
});

describe("GanttProvider - workstream operations", () => {
	it("adds, updates and deletes a workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });

		act(() => result.current.addWorkstream("Backend"));
		const ws = result.current.project.workstreams[0];
		expect(ws).toBeDefined();

		act(() => result.current.updateWorkstream(ws.id, { label: "Platform" }));
		expect(result.current.project.workstreams[0].label).toBe("Platform");

		act(() => result.current.deleteWorkstream(ws.id));
		expect(result.current.project.workstreams.length).toBe(0);
	});
});

describe("GanttProvider - work item operations", () => {
	it("adds a work item to a workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("Backend"));
		const wsId = result.current.project.workstreams[0].id;

		act(() =>
			result.current.addWorkItem(wsId, "Build API", "2024-01-01", "2024-01-05"),
		);

		expect(result.current.project.workItems.length).toBe(1);
		const item = result.current.project.workItems[0];
		expect(item.title).toBe("Build API");
		expect(item.workstreamId).toBe(wsId);
	});

	it("updates a work item", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("Backend"));
		const wsId = result.current.project.workstreams[0].id;
		act(() => result.current.addWorkItem(wsId, "Build API"));
		const itemId = result.current.project.workItems[0].id;

		act(() => result.current.updateWorkItem(itemId, { title: "Ship API" }));
		expect(result.current.project.workItems[0].title).toBe("Ship API");
	});

	it("moves a work item to a different workstream", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => {
			result.current.addWorkstream("A");
			result.current.addWorkstream("B");
		});
		const [wsA, wsB] = result.current.project.workstreams;
		act(() => result.current.addWorkItem(wsA.id, "Task"));
		const itemId = result.current.project.workItems[0].id;

		act(() => result.current.moveWorkItemToWorkstream(itemId, wsB.id));
		expect(result.current.project.workItems[0].workstreamId).toBe(wsB.id);
	});

	it("deletes a work item and clears selection/modal state", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("A"));
		const wsId = result.current.project.workstreams[0].id;
		act(() => result.current.addWorkItem(wsId, "Task"));
		const itemId = result.current.project.workItems[0].id;

		act(() => {
			result.current.setSelectedItemId(itemId);
			result.current.setModalItemId(itemId);
		});
		expect(result.current.selectedItemId).toBe(itemId);
		expect(result.current.modalItemId).toBe(itemId);

		act(() => result.current.deleteWorkItem(itemId));

		expect(result.current.project.workItems.length).toBe(0);
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
	});
});

describe("GanttProvider - dependency operations", () => {
	it("adds and deletes a dependency between two work items", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });
		act(() => result.current.addWorkstream("A"));
		const wsId = result.current.project.workstreams[0].id;
		act(() => {
			result.current.addWorkItem(wsId, "First");
			result.current.addWorkItem(wsId, "Second");
		});
		const [first, second] = result.current.project.workItems;

		act(() => result.current.addDependency(first.id, second.id));
		expect(result.current.project.dependencies.length).toBe(1);
		const dep = result.current.project.dependencies[0];
		expect(dep.fromItemId).toBe(first.id);
		expect(dep.toItemId).toBe(second.id);

		act(() => result.current.deleteDependency(dep.id));
		expect(result.current.project.dependencies.length).toBe(0);
	});
});

describe("GanttProvider - legend operations", () => {
	it("adds, updates and deletes a legend entry", () => {
		const { result } = renderHook(() => useGantt(), { wrapper });

		act(() => result.current.addLegendEntry("Milestone", "#ff0000"));
		expect(result.current.project.legendEntries.length).toBe(1);
		const entry = result.current.project.legendEntries[0];
		expect(entry.label).toBe("Milestone");
		expect(entry.color).toBe("#ff0000");

		act(() => result.current.updateLegendEntry(entry.id, { label: "Release" }));
		expect(result.current.project.legendEntries[0].label).toBe("Release");

		act(() => result.current.deleteLegendEntry(entry.id));
		expect(result.current.project.legendEntries.length).toBe(0);
	});
});

describe("GanttProvider - beforeunload guard", () => {
	it("attaches a beforeunload handler only while dirty", () => {
		const addSpy = vi.spyOn(window, "addEventListener");
		const removeSpy = vi.spyOn(window, "removeEventListener");

		const { result, unmount } = renderHook(() => useGantt(), { wrapper });

		// Clean on mount: no handler registered yet.
		expect(
			addSpy.mock.calls.some(([type]) => type === "beforeunload"),
		).toBe(false);

		act(() => result.current.addWorkstream("Dirty me"));

		expect(
			addSpy.mock.calls.some(([type]) => type === "beforeunload"),
		).toBe(true);

		unmount();

		expect(
			removeSpy.mock.calls.some(([type]) => type === "beforeunload"),
		).toBe(true);
	});

	it("removes the handler once the project is marked clean again", () => {
		const addSpy = vi.spyOn(window, "addEventListener");
		const removeSpy = vi.spyOn(window, "removeEventListener");

		const { result } = renderHook(() => use