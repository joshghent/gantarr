import { describe, expect, it } from "vitest";
import {
	buildImportUrl,
	decodeProject,
	encodeProject,
	extractImportToken,
} from "./project-link";
import { buildProject, type ChartInput } from "./project-schema";

function sample(): ReturnType<typeof buildProject> {
	const input: ChartInput = {
		name: "Roadmap",
		workstreams: [
			{
				label: "Build",
				tasks: [
					{ title: "Spec", start: "2026-03-02", end: "2026-03-06" },
					{ title: "Ship", start: "2026-03-09", end: "2026-03-13" },
				],
			},
		],
		dependencies: [{ from: "Spec", to: "Ship" }],
	};
	return buildProject(input);
}

describe("encodeProject / decodeProject", () => {
	it("round-trips a project unchanged", async () => {
		const project = sample();
		const token = await encodeProject(project);
		const back = await decodeProject(token);
		expect(back).toEqual(project);
	});

	it("produces a URL-safe token (no +, /, = or whitespace)", async () => {
		const token = await encodeProject(sample());
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it("compresses large repetitive projects below their raw JSON size", async () => {
		const big: ChartInput = {
			name: "Big",
			workstreams: Array.from({ length: 8 }, (_, w) => ({
				label: `Workstream ${w}`,
				tasks: Array.from({ length: 20 }, (_, t) => ({
					title: `Task ${w}-${t}`,
					start: "2026-01-05",
					end: "2026-01-09",
				})),
			})),
		};
		const project = buildProject(big);
		const token = await encodeProject(project);
		const rawJsonLength = JSON.stringify(project).length;
		expect(token.length).toBeLessThan(rawJsonLength);
	});

	it("rejects a garbage token", async () => {
		await expect(decodeProject("!!!not-valid!!!")).rejects.toThrow();
	});

	it("rejects a token whose payload is not a valid project", async () => {
		// valid base64url of gzipped non-project content should fail validation
		const bogus = await encodeProject({
			// deliberately not a GanttProject
			hello: "world",
		} as unknown as ReturnType<typeof buildProject>);
		await expect(decodeProject(bogus)).rejects.toThrow();
	});
});

describe("buildImportUrl", () => {
	it("builds an /?import= url from an origin", async () => {
		const url = await buildImportUrl("https://gantarr.app", sample());
		expect(url.startsWith("https://gantarr.app/?import=")).toBe(true);
		const token = url.split("import=")[1];
		const back = await decodeProject(token);
		expect(back.name).toBe("Roadmap");
	});

	it("does not duplicate a trailing slash on the origin", async () => {
		const url = await buildImportUrl("https://gantarr.app/", sample());
		expect(url).not.toContain("//?import=");
		expect(url).toContain("https://gantarr.app/?import=");
	});
});

describe("extractImportToken", () => {
	it("pulls the token from a bare query string", () => {
		expect(extractImportToken("?import=abc123")).toBe("abc123");
	});

	it("pulls the token from a full url", () => {
		expect(extractImportToken("https://gantarr.app/?import=abc123&x=1")).toBe(
			"abc123",
		);
	});

	it("returns null when there is no import param", () => {
		expect(extractImportToken("?foo=bar")).toBeNull();
		expect(extractImportToken("")).toBeNull();
	});
});
