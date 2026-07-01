import { describe, expect, it } from "vitest";
import {
	hasUnseenRelease,
	LATEST_RELEASE_VERSION,
	RELEASE_NOTES,
} from "./release-notes";

describe("RELEASE_NOTES", () => {
	it("has at least one entry, newest first", () => {
		expect(RELEASE_NOTES.length).toBeGreaterThan(0);
		const dates = RELEASE_NOTES.map((r) => r.date);
		const sorted = [...dates].sort().reverse();
		expect(dates).toEqual(sorted);
	});

	it("every entry is well-formed", () => {
		for (const note of RELEASE_NOTES) {
			expect(note.version).toBeTruthy();
			expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(note.title).toBeTruthy();
			expect(note.items.length).toBeGreaterThan(0);
		}
	});

	it("LATEST_RELEASE_VERSION points at the newest entry", () => {
		expect(LATEST_RELEASE_VERSION).toBe(RELEASE_NOTES[0].version);
	});

	it("still announces the AI integration somewhere in the list", () => {
		const blob = JSON.stringify(RELEASE_NOTES).toLowerCase();
		expect(blob.includes("ai") || blob.includes("mcp")).toBe(true);
	});
});

describe("hasUnseenRelease", () => {
	it("is true for a first-time visitor (nothing stored)", () => {
		expect(hasUnseenRelease(null)).toBe(true);
	});

	it("is false once the latest version has been seen", () => {
		expect(hasUnseenRelease(LATEST_RELEASE_VERSION)).toBe(false);
	});

	it("is true when an older version was last seen", () => {
		expect(hasUnseenRelease("0.0.0-ancient")).toBe(true);
	});
});
