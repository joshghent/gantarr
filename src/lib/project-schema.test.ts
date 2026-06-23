import { describe, expect, it } from "vitest";
import type { GanttProject } from "../types";
import { createProject } from "./gantt-store";
import { buildProject, type ChartInput, parseProject } from "./project-schema";

// A minimal, valid AI-facing input used as a base across tests.
function baseInput(): ChartInput {
	return {
		name: "Launch Plan",
		workstreams: [
			{
				label: "Build",
				tasks: [
					{ title: "API", start: "2026-01-05", end: "2026-01-09" },
					{ title: "Frontend", start: "2026-01-12", end: "2026-01-16" },
				],
			},
			{
				label: "Go to market",
				tasks: [
					{ title: "Landing page", start: "2026-01-19", end: "2026-01-23" },
				],
			},
		],
	};
}

describe("buildProject", () => {
	it("produces a project that passes full validation", () => {
		const project = buildProject(baseInput());
		expect(() => parseProject(project)).not.toThrow();
	});

	it("assigns unique ids to project, workstreams, and items", () => {
		const project = buildProject(baseInput());
		expect(project.id).toBeTruthy();
		const wsIds = project.workstreams.map((w) => w.id);
		const itemIds = project.workItems.map((i) => i.id);
		expect(new Set(wsIds).size).toBe(wsIds.length);
		expect(new Set(itemIds).size).toBe(itemIds.length);
		// every work item points at a real workstream
		for (const item of project.workItems) {
			expect(wsIds).toContain(item.workstreamId);
		}
	});

	it("keeps the given name and flattens tasks into work items", () => {
		const project = buildProject(baseInput());
		expect(project.name).toBe("Launch Plan");
		expect(project.workstreams).toHaveLength(2);
		expect(project.workItems).toHaveLength(3);
		expect(project.workItems.map((i) => i.title)).toEqual([
			"API",
			"Frontend",
			"Landing page",
		]);
	});

	it("orders workstreams by their input position", () => {
		const project = buildProject(baseInput());
		expect(project.workstreams.map((w) => w.order)).toEqual([0, 1]);
	});

	it("orders work items sequentially within each workstream", () => {
		const project = buildProject(baseInput());
		const build = project.workstreams[0];
		const buildItems = project.workItems
			.filter((i) => i.workstreamId === build.id)
			.map((i) => i.order);
		expect(buildItems).toEqual([0, 1]);
	});

	it("uses a supplied workstream color, else falls back to the palette", () => {
		const input = baseInput();
		input.workstreams[0].color = "#123456";
		const project = buildProject(input);
		expect(project.workstreams[0].color).toBe("#123456");
		// second workstream had no color → must be a valid hex from the palette
		expect(project.workstreams[1].color).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it("resolves a task's legend type to a legend entry id (case-insensitive)", () => {
		const input = baseInput();
		input.legend = [{ label: "Development", color: "#3b82f6" }];
		input.workstreams[0].tasks[0].type = "development";
		const project = buildProject(input);
		const dev = project.legend.find((l) => l.label === "Development");
		expect(dev).toBeTruthy();
		const api = project.workItems.find((i) => i.title === "API");
		expect(api?.legendEntryId).toBe(dev?.id);
	});

	it("auto-creates a legend entry for a referenced type not in the legend", () => {
		const input = baseInput();
		input.workstreams[0].tasks[0].type = "Research";
		const project = buildProject(input);
		const research = project.legend.find((l) => l.label === "Research");
		expect(research).toBeTruthy();
		const api = project.workItems.find((i) => i.title === "API");
		expect(api?.legendEntryId).toBe(research?.id);
	});

	it("leaves legendEntryId null when a task has no type", () => {
		const project = buildProject(baseInput());
		expect(project.workItems.every((i) => i.legendEntryId === null)).toBe(true);
	});

	it("passes through an explicit lane and omits it otherwise", () => {
		const input = baseInput();
		input.workstreams[0].tasks[0].lane = 2;
		const project = buildProject(input);
		const api = project.workItems.find((i) => i.title === "API");
		const frontend = project.workItems.find((i) => i.title === "Frontend");
		expect(api?.lane).toBe(2);
		expect(frontend?.lane).toBeUndefined();
	});

	it("resolves dependencies by task title into work item ids", () => {
		const input = baseInput();
		input.dependencies = [{ from: "API", to: "Frontend" }];
		const project = buildProject(input);
		const api = project.workItems.find((i) => i.title === "API");
		const frontend = project.workItems.find((i) => i.title === "Frontend");
		expect(project.dependencies).toHaveLength(1);
		expect(project.dependencies[0].fromItemId).toBe(api?.id);
		expect(project.dependencies[0].toItemId).toBe(frontend?.id);
	});

	it("throws a clear error when a dependency references an unknown task", () => {
		const input = baseInput();
		input.dependencies = [{ from: "API", to: "Nonexistent" }];
		expect(() => buildProject(input)).toThrow(/Nonexistent/);
	});

	it("throws when a task ends before it starts", () => {
		const input = baseInput();
		input.workstreams[0].tasks[0] = {
			title: "Bad",
			start: "2026-02-10",
			end: "2026-02-01",
		};
		expect(() => buildProject(input)).toThrow();
	});

	it("rejects malformed dates via schema validation", () => {
		const input = baseInput();
		input.workstreams[0].tasks[0].start = "10/05/2026";
		expect(() => buildProject(input)).toThrow();
	});

	it("requires at least one workstream", () => {
		const input = baseInput();
		input.workstreams = [];
		expect(() => buildProject(input)).toThrow();
	});

	it("stamps createdAt and updatedAt as ISO timestamps", () => {
		const project = buildProject(baseInput());
		expect(new Date(project.createdAt).toISOString()).toBe(project.createdAt);
		expect(new Date(project.updatedAt).toISOString()).toBe(project.updatedAt);
	});
});

describe("parseProject", () => {
	it("accepts a project created by the app's own factory", () => {
		const project = createProject("My Project");
		expect(() => parseProject(project)).not.toThrow();
	});

	it("round-trips through JSON unchanged", () => {
		const project = buildProject(baseInput());
		const reparsed = parseProject(JSON.parse(JSON.stringify(project)));
		expect(reparsed).toEqual(project);
	});

	it("rejects a non-object", () => {
		expect(() => parseProject("nope")).toThrow();
		expect(() => parseProject(null)).toThrow();
	});

	it("rejects a project missing required collections", () => {
		const bad = { id: "x", name: "X" };
		expect(() => parseProject(bad)).toThrow();
	});

	it("rejects a work item with a bad date format", () => {
		const project = buildProject(baseInput()) as GanttProject;
		const broken = JSON.parse(JSON.stringify(project));
		broken.workItems[0].startDate = "not-a-date";
		expect(() => parseProject(broken)).toThrow();
	});

	it("preserves an optional lane on a work item", () => {
		const input = baseInput();
		input.workstreams[0].tasks[0].lane = 1;
		const project = buildProject(input);
		const reparsed = parseProject(JSON.parse(JSON.stringify(project)));
		const api = reparsed.workItems.find((i) => i.title === "API");
		expect(api?.lane).toBe(1);
	});
});
