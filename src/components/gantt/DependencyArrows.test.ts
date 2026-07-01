import { describe, expect, it } from "vitest";
import { arrowPath } from "./DependencyArrows";

describe("arrowPath", () => {
	// Regression: adjacent tasks (one ends exactly where the next begins)
	// used to route through an orthogonal elbow that produced sharp
	// "spikes". The path must now be a single smooth cubic — one M, one C,
	// no L/Q segments that backtrack.
	it("draws a clean cubic when tasks are adjacent (dx = 0)", () => {
		const d = arrowPath(100, 20, 100, 64);
		expect(d).toContain("M 100 20");
		expect(d.match(/C/g)?.length).toBe(1);
		expect(d).not.toContain("L");
		expect(d).not.toContain("Q");
	});

	it("draws a clean cubic for backward dependencies (dx < 0)", () => {
		const d = arrowPath(200, 20, 120, 64);
		expect(d.match(/C/g)?.length).toBe(1);
		expect(d).not.toContain("L");
		expect(d).not.toContain("Q");
	});

	it("ends at the successor's left edge so the arrowhead points into it", () => {
		const d = arrowPath(50, 20, 300, 60);
		expect(d.trim().endsWith("300 60")).toBe(true);
	});

	it("stretches the control reach with the forward gap but caps it", () => {
		const near = arrowPath(0, 0, 100, 0); // dx 100 -> reach 40
		expect(near).toContain("C 40 0");
		const far = arrowPath(0, 0, 1000, 0); // dx 1000 -> reach capped at 80
		expect(far).toContain("C 80 0");
	});
});
