import { describe, expect, it } from "vitest";
import { arrowHitPath, arrowPath } from "./DependencyArrows";

describe("arrowPath", () => {
	// Pull the straight segments out of the path: everything before the
	// curve is the lead out, everything after it is the lead in.
	const parts = (d: string) => {
		const [lead, rest] = d.split(" C ");
		const lastL = rest.lastIndexOf(" L ");
		const curve = rest.slice(0, lastL);
		const leadIn = rest.slice(lastL + 3);
		const curveEnd = curve.split(", ").pop() ?? "";
		return { lead, curve, curveEnd, leadIn };
	};

	// Regression: adjacent tasks (one ends exactly where the next begins)
	// used to route through an orthogonal elbow that produced sharp
	// "spikes". The middle must stay a single smooth cubic — no Q segments
	// and only the two straight leads as L segments.
	it("draws a clean cubic when tasks are adjacent (dx = 0)", () => {
		const d = arrowPath(100, 20, 100, 64);
		expect(d.startsWith("M 100 20")).toBe(true);
		expect(d.match(/C/g)?.length).toBe(1);
		expect(d.match(/L/g)?.length).toBe(2);
		expect(d).not.toContain("Q");
	});

	it("draws a clean cubic for backward dependencies (dx < 0)", () => {
		const d = arrowPath(200, 20, 120, 64);
		expect(d.match(/C/g)?.length).toBe(1);
		expect(d.match(/L/g)?.length).toBe(2);
		expect(d).not.toContain("Q");
	});

	it("ends at the successor's left edge so the arrowhead points into it", () => {
		const d = arrowPath(50, 20, 300, 60);
		expect(d.trim().endsWith("300 60")).toBe(true);
	});

	// Regression: on a tall, near-vertical arrow between adjacent tasks the
	// curve was still bending in its last few pixels, so the straight
	// arrowhead stuck out sideways, detached from the line.
	it("finishes with a straight horizontal run longer than the arrowhead", () => {
		const { curveEnd, leadIn } = parts(arrowPath(100, 20, 100, 220));
		const [cx, cy] = curveEnd.split(" ").map(Number);
		const [tx, ty] = leadIn.split(" ").map(Number);
		expect(cy).toBe(ty);
		expect(tx - cx).toBeGreaterThan(10);
	});

	it("leaves the source with a short straight run", () => {
		const { lead } = parts(arrowPath(100, 20, 100, 220));
		expect(lead).toMatch(/^M 100 20 L 1\d\d 20$/);
	});

	it("draws a straight line between close tasks on the same row", () => {
		expect(arrowPath(100, 20, 104, 20)).toBe("M 100 20 L 104 20");
	});

	it("stretches the control reach with the forward gap but caps it", () => {
		// Curve runs from x=8 to the end minus the 14px lead in.
		const near = arrowPath(0, 0, 122, 10); // curve dx 100 -> reach 40
		expect(near).toContain("C 48 0");
		const far = arrowPath(0, 0, 1000, 10); // reach capped at 80
		expect(far).toContain("C 88 0");
	});
});

describe("arrowHitPath", () => {
	const points = (d: string) =>
		d
			.split(/[ML]\s*/)
			.filter(Boolean)
			.map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number]);

	// Regression: the click-to-delete hit region used to run the full length
	// of the arrow, so it covered the source task's connector port and the
	// target task's left edge — you could draw one arrow out of a task and
	// then never another.
	it("starts clear of the source and stops clear of the target", () => {
		const d = arrowHitPath(100, 20, 500, 20);
		const pts = points(d);
		expect(pts.length).toBeGreaterThan(1);
		const [first] = pts;
		const last = pts[pts.length - 1];
		expect(first[0] - 100).toBeGreaterThan(8);
		expect(500 - last[0]).toBeGreaterThan(6);
	});

	it("keeps most of the arrow clickable", () => {
		const d = arrowHitPath(0, 0, 600, 0);
		const pts = points(d);
		const span = pts[pts.length - 1][0] - pts[0][0];
		expect(span).toBeGreaterThan(600 * 0.8);
	});

	it("is a polyline that follows the drawn curve", () => {
		const d = arrowHitPath(0, 0, 400, 44);
		expect(d.startsWith("M ")).toBe(true);
		expect(d).toContain("L ");
		expect(d).not.toContain("C");
		// Every sample sits inside the curve's bounding box.
		for (const [x, y] of points(d)) {
			expect(x).toBeGreaterThanOrEqual(-1);
			expect(x).toBeLessThanOrEqual(401);
			expect(y).toBeGreaterThanOrEqual(-1);
			expect(y).toBeLessThanOrEqual(45);
		}
	});

	it("returns nothing when the arrow is shorter than the trims", () => {
		expect(arrowHitPath(0, 0, 2, 0)).toBe("");
	});
});
