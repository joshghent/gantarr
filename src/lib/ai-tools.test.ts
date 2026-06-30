import { describe, expect, it } from "vitest";
import {
	buildLlmsTxt,
	createGanttChart,
	GANTARR_SCHEMA_DOC,
	renderGanttChart,
} from "./ai-tools";
import { decodeProject } from "./project-link";
import { buildProject, type ChartInput } from "./project-schema";

const ORIGIN = "https://gantarr.app";

function input(): ChartInput {
	return {
		name: "Q1 Plan",
		workstreams: [
			{
				label: "Engineering",
				tasks: [{ title: "Build API", start: "2026-01-05", end: "2026-01-16" }],
			},
		],
	};
}

describe("createGanttChart", () => {
	it("returns an import url that decodes back to the built project", async () => {
		const { url, project } = await createGanttChart(input(), ORIGIN);
		expect(url.startsWith("https://gantarr.app/?import=")).toBe(true);
		const decoded = await decodeProject(url.split("import=")[1]);
		expect(decoded).toEqual(project);
		expect(project.name).toBe("Q1 Plan");
	});

	it("throws on invalid input so the model gets actionable feedback", async () => {
		await expect(
			createGanttChart({ name: "X", workstreams: [] }, ORIGIN),
		).rejects.toThrow();
	});
});

describe("renderGanttChart", () => {
	it("accepts a full GanttProject JSON and returns an import url", async () => {
		const project = buildProject(input());
		const { url } = await renderGanttChart(project, ORIGIN);
		const decoded = await decodeProject(url.split("import=")[1]);
		expect(decoded).toEqual(project);
	});

	it("rejects malformed project JSON", async () => {
		await expect(
			renderGanttChart({ not: "a project" }, ORIGIN),
		).rejects.toThrow();
	});
});

describe("GANTARR_SCHEMA_DOC", () => {
	it("documents the core structure and integration points", () => {
		expect(GANTARR_SCHEMA_DOC).toContain("workstreams");
		expect(GANTARR_SCHEMA_DOC).toContain("startDate");
		expect(GANTARR_SCHEMA_DOC).toContain("?import=");
		expect(GANTARR_SCHEMA_DOC).toContain("/mcp");
	});
});

describe("buildLlmsTxt", () => {
	it("embeds the schema doc and the concrete MCP endpoint for the host", () => {
		const txt = buildLlmsTxt(ORIGIN);
		expect(txt).toContain("Gantarr");
		expect(txt).toContain(`${ORIGIN}/mcp`);
		expect(txt).toContain("?import=");
		// the schema/authoring guide is included verbatim
		expect(txt).toContain("create_gantt_chart");
		expect(txt).toContain("workstreams");
	});

	it("includes a ready-to-paste prompt for chat clients", () => {
		const txt = buildLlmsTxt(ORIGIN);
		expect(txt.toLowerCase()).toContain("prompt");
	});
});
