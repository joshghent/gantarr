import { describe, expect, it } from "vitest";
import {
	addWorkstream,
	createProject,
	deleteWorkstream,
	pickWorkstreamColor,
	WORKSTREAM_PALETTE,
} from "./gantt-store";

describe("pickWorkstreamColor", () => {
	it("starts at the top of the palette when nothing is used", () => {
		expect(pickWorkstreamColor([])).toBe(WORKSTREAM_PALETTE[0]);
	});

	it("skips colors already in use", () => {
		expect(pickWorkstreamColor([WORKSTREAM_PALETTE[0]])).toBe(
			WORKSTREAM_PALETTE[1],
		);
	});

	it("reuses the gap left by a deleted workstream", () => {
		const used = [WORKSTREAM_PALETTE[0], WORKSTREAM_PALETTE[2]];
		expect(pickWorkstreamColor(used)).toBe(WORKSTREAM_PALETTE[1]);
	});

	it("ignores case when comparing", () => {
		expect(pickWorkstreamColor([WORKSTREAM_PALETTE[0].toUpperCase()])).toBe(
			WORKSTREAM_PALETTE[1],
		);
	});

	it("generates a fresh color once the palette is exhausted", () => {
		const color = pickWorkstreamColor([...WORKSTREAM_PALETTE]);
		expect(color).toMatch(/^#[0-9a-f]{6}$/);
		expect(WORKSTREAM_PALETTE).not.toContain(color);
	});

	it("keeps generating distinct colors well past the palette", () => {
		const used = [...WORKSTREAM_PALETTE];
		for (let i = 0; i < 40; i++) {
			const next = pickWorkstreamColor(used);
			expect(used).not.toContain(next);
			used.push(next);
		}
		expect(new Set(used).size).toBe(used.length);
	});
});

describe("addWorkstream colors", () => {
	it("gives every workstream a different color", () => {
		let project = createProject("Test");
		for (let i = 0; i < 20; i++) {
			project = addWorkstream(project, `WS ${i}`);
		}
		const colors = project.workstreams.map((ws) => ws.color);
		expect(new Set(colors).size).toBe(colors.length);
	});

	it("does not repeat a color after a delete in the middle", () => {
		let project = createProject("Test");
		project = addWorkstream(project, "Second");
		project = addWorkstream(project, "Third");
		// Drop the middle one, then add — the old count-based assignment
		// handed the new workstream the third one's color.
		project = deleteWorkstream(project, project.workstreams[1].id);
		project = addWorkstream(project, "Fourth");
		const colors = project.workstreams.map((ws) => ws.color);
		expect(new Set(colors).size).toBe(colors.length);
	});
});
