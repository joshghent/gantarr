Looking at the source file, I need to understand the types involved. Let me check the shape of `GanttProject`, `Workstream`, `WorkItem`, and `LegendEntry` types, but since I don't have direct access to the types file, I'll construct minimal valid test fixtures based on usage patterns in the context file (workstreams, work items, legend entries, dependencies).

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GanttProvider, useGantt } from "./gantt-context";
import type { GanttProject } from "../types";

function makeProject(): GanttProject {
	return {
		name: "Test Project",
		workstreams: [],
		legend: [],
	} as unknown as GanttProject;
}

function renderGantt(initialProject: GanttProject = makeProject()) {
	return renderHook(() => useGantt(), {
		wrapper: ({ children }) => (
			<GanttProvider initialProject={initialProject}>{children}</GanttProvider>
		),
	});
}

describe("useGantt", () => {
	it("throws when used outside a GanttProvider", () => {
		expect(() => renderHook(() => useGantt())).toThrow(
			"useGantt must be used within GanttProvider",
		);
	});

	it("exposes the initial project unchanged and clean", () => {
		const initial = makeProject();
		const { result } = renderGantt(initial);
		expect(result.current.project).toBe(initial);
		expect(result.current.isDirty).toBe(false);
	});

	it("defaults to days view mode", () => {
		const { result } = renderGantt();
		expect(result.current.viewMode).toBe("days");
	});

	it("changes view mode without marking the project dirty", () => {
		const { result } = renderGantt();
		act(() => {
			result.current.setViewMode("weeks");
		});
		expect(result.current.viewMode).toBe("weeks");
		expect(result.current.isDirty).toBe(false);
	});
});

describe("dirty tracking", () => {
	it("marks dirty after addWorkstream", () => {
		const { result } = renderGantt();
		expect(result.current.isDirty).toBe(false);
		act(() => {
			result.current.addWorkstream("Engineering");
		});
		expect(result.current.isDirty).toBe(true);
		expect(result.current.project.workstreams).toHaveLength(1);
		expect(result.current.project.workstreams[0].label).toBe("Engineering");
	});

	it("markClean resets isDirty to false", () => {
		const { result } = renderGantt();
		act(() => {
			result.current.addWorkstream("Engineering");
		});
		expect(result.current.isDirty).toBe(true);
		act(() => {
			result.current.markClean();
		});
		expect(result.current.isDirty).toBe(false);
	});

	it("setProject replaces the whole project and marks dirty", () => {
		const { result } = renderGantt();
		const replacement = makeProject();
		replacement.name = "Replaced";
		act(() => {
			result.current.setProject(replacement);
		});
		expect(result.current.project).toBe(replacement);
		expect(result.current.project.name).toBe("Replaced");
		expect(result.current.isDirty).toBe(true);
	});

	it("stays dirty across further mutations until markClean is called", () => {
		const { result } = renderGantt();
		act(() => {
			result.current.addWorkstream("A");
		});
		act(() => {
			result.current.addWorkstream("B");
		});
		expect(result.current.isDirty).toBe(true);
		act(() => {
			result.current.markClean();
		});
		expect(result.current.isDirty).toBe(false);
		act(() => {
			result.current.addWorkstream("C");
		});
		expect(result.current.isDirty).toBe(true);
	});
});

describe("workstream operations", () => {
	it("addWorkstream appends a workstream with the given label", () => {
		const { result } = renderGantt();
		act(() => {
			result.current.addWorkstream("Design");
		});
		expect(result.current.project.workstreams).toHaveLength(1);
		expect(result.current.project.workstreams[0].label).toBe("Design");
	});

	it("updateWorkstream applies partial updates by id", () => {
		const { result } = renderGantt();
		act(() => {
			result.current.addWorkstream("Design");
		});
		const id = result.current.project.workstreams[0].id;
		act(() => {
			result.current.updateWorkstream(id, { label: "Design Team" });
		});
		expect(result.current.project.workstreams[0].label).toBe("Design Team");
	});

	it("deleteWorkstream removes the workstream by id", () => {
		const { result } = renderGantt();
		act(() => {
			result.current.addWorkstream("Design");
		});
		const id = result.current.project.workstreams[0].id;
		act(() => {
			result.current.deleteWorkstream(id);
		});
		expect(result.current.project.workstreams).toHaveLength(0);
	});
});

describe("work item operations", () => {
	function withWorkstream() {
		const { result } = renderGantt();
		act(() => {
			result.current.addWorkstream("Engineering");
		});
		const workstreamId = result.current.project.workstreams[0].id;
		return { result, workstreamId };
	}

	it("addWorkItem adds an item to the given workstream", () => {
		const { result, workstreamId } = withWorkstream();
		act(() => {
			result.current.addWorkItem(workstreamId, "Build feature");
		});
		const ws = result.current.project.workstreams.find(
			(w) => w.id === workstreamId,
		);
		expect(ws?.items).toHaveLength(1);
		expect(ws?.items[0].title).toBe("Build feature");
	});

	it("addWorkItem forwards optional start/end/legend/lane args", () => {
		const { result, workstreamId } = withWorkstream();
		act(() => {
			result.current.addWorkItem(
				workstreamId,
				"Ship it",
				"2024-01-01",
				"2024-01-05",
				"legend-1",
				2,
			);
		});
		const item = result.current.project.workstreams.find(
			(w) => w.id === workstreamId,
		)?.items[0];
		expect(item?.startDate).toBe("2024-01-01");
		expect(item?.endDate).toBe("2024-01-05");
		expect(item?.legendEntryId).toBe("legend-1");
		expect(item?.lane).toBe(2);
	});

	it("updateWorkItem applies partial updates by id", () => {
		const { result, workstreamId } = withWorkstream();
		act(() => {
			result.current.addWorkItem(workstreamId, "Build feature");
		});
		const itemId = result.current.project.workstreams[0].items[0].id;
		act(() => {
			result.current.updateWorkItem(itemId, { title: "Build feature v2" });
		});
		expect(result.current.project.workstreams[0].items[0].title).toBe(
			"Build feature v2",
		);
	});

	it("moveWorkItemToWorkstream moves an item between workstreams", () => {
		const { result, workstreamId } = withWorkstream();
		act(() => {
			result.current.addWorkstream("QA");
		});
		const targetId = result.current.project.workstreams[1].id;
		act(() => {
			result.current.addWorkItem(workstreamId, "Test task");
		});
		const itemId = result.current.project.workstreams[0].items[0].id;
		act(() => {
			result.current.moveWorkItemToWorkstream(itemId, targetId, 1);
		});
		const source = result.current.project.workstreams.find(
			(w) => w.id === workstreamId,
		);
		const target = result.current.project.workstreams.find(
			(w) => w.id === targetId,
		);
		expect(source?.items).toHaveLength(0);
		expect(target?.items).toHaveLength(1);
		expect(target?.items[0].id).toBe(itemId);
	});

	it("deleteWorkItem removes the item and clears selection/modal state", () => {
		const { result, workstreamId } = withWorkstream();
		act(() => {
			result.current.addWorkItem(workstreamId, "Doomed task");
		});
		const itemId = result.current.project.workstreams[0].items[0].id;
		act(() => {
			result.current.setSelectedItemId(itemId);
			result.current.setModalItemId(itemId);
		});
		expect(result.current.selectedItemId).toBe(itemId);
		expect(result.current.modalItemId).toBe(itemId);

		act(() => {
			result.current.deleteWorkItem(itemId);
		});
		expect(result.current.project.workstreams[0].items).toHaveLength(0);
		expect(result.current.selectedItemId).toBeNull();
		expect(result.current.modalItemId).toBeNull();
	});

	it("deleteWorkItem clears selection even if the deleted item wasn't selected", () => {
		const { result, workstreamId } = withWorkstream();
		act(() => {
			result.current.addWorkItem(workstreamId, "Task A");
			result.current.addWorkItem(workstreamId, "Task B");
		});
		const items = result.current.project.workstreams[0].items;
		act(() => {
			result.current.setSelectedItemId(items[0].id);
		});
		act(() => {
			result.current.deleteWorkItem(items[1].id);
		});
		// Current implementation unconditionally clears selection on delete.
		expect(result.current.selectedItemId).toBeNull();
	});
});

describe("dependency operations", () => {
	function withTwoItems() {
		const { result } = renderGantt();
		act(() => {
			result.current.addWorkstream("Engineering");
		});
		const workstreamId = result.current.project.workstreams[0].id;
		act(() => {
			result.current.addWorkItem(workstreamId, "Task A");
			result.current.addWorkItem(workstreamId, "Task B");
		});
		const items = result.current.project.workstreams[0].items;
		return { result, fromId: items[0].id, toId: items[1].id };
	}

	it("addDependency creates a dependency between two items", () => {
		const { result, fromId, toId } = withTwoItems();
		act(() => {
			result.current.addDependency(fromId, toId);
		});
		expect(result.current.project.dependencies).toHaveLength(1);
		expect(result.current.project.dependencies[0]).toMatchObject({
			fromItemId: fromId,
			toItemId: toId,
		});
	});

	it("deleteDependency removes a dependency by id", () => {
		const { result, fromId, toId } = withTwoItems();
		act(() => {
			result.current.addDependency(fromId, toId);
		});
		const depId = result.current.project.dependencies[0].id;
		act(() => {
			result.current.deleteDependency(depId);
		});
		expect(result.current.project.dependencies).toHaveLength(0);
	});
});

describe("legend operations", () => {
	it("addLegendEntry appends an entry with label and color", () => {
		const { result } = renderGantt();
		act(() => {
			result.current.addLegendEntry("Milestone", "#ff0000");
		});
		expect(result.current.project.legend).toHaveLength(1);
		expect(result.current.project.legend[0]).toMatchObject({
			label: "Milestone",
			color: "#ff0000",
		});
	});

	it("updateLegendEntry applies partial updates by id", () => {
		const { result } = renderGantt();
		act(() => {
			result.current.addLegendEntry("Milestone", "#ff0000");
		});
		const id = result.current.project.leg