import { describe, expect, it } from "vitest";
import { getContrastText, hexToRgb, hslToHex, normalizeColor } from "./colors";

describe("hexToRgb", () => {
	it("parses a hex color with a leading hash", () => {
		expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
	});

	it("parses a hex color without a leading hash", () => {
		expect(hexToRgb("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
	});

	it("is case-insensitive", () => {
		expect(hexToRgb("#ABCDEF")).toEqual({ r: 171, g: 205, b: 239 });
		expect(hexToRgb("#abcdef")).toEqual({ r: 171, g: 205, b: 239 });
	});

	it("trims whitespace before parsing", () => {
		expect(hexToRgb("  #0000ff  ")).toEqual({ r: 0, g: 0, b: 255 });
	});

	it("returns null for invalid input", () => {
		expect(hexToRgb("not-a-color")).toBeNull();
		expect(hexToRgb("#fff")).toBeNull(); // shorthand not supported
		expect(hexToRgb("#ggg123")).toBeNull();
		expect(hexToRgb("")).toBeNull();
		expect(hexToRgb("#1234567")).toBeNull();
	});
});

describe("getContrastText", () => {
	it("returns dark text for light backgrounds", () => {
		expect(getContrastText("#ffffff")).toBe("#1a1a1a");
		expect(getContrastText("#ffff00")).toBe("#1a1a1a");
	});

	it("returns light text for dark backgrounds", () => {
		expect(getContrastText("#000000")).toBe("#ffffff");
		expect(getContrastText("#0000ff")).toBe("#ffffff");
	});

	it("falls back to white text when the hex is invalid", () => {
		expect(getContrastText("not-a-color")).toBe("#ffffff");
	});

	it("sits right at the luminance threshold boundary", () => {
		// Gray at exactly mid-level should be classified using the 0.55 cutoff.
		const belowThreshold = getContrastText("#808080"); // luminance ~0.502
		expect(belowThreshold).toBe("#ffffff");

		const aboveThreshold = getContrastText("#a0a0a0"); // luminance ~0.627
		expect(aboveThreshold).toBe("#1a1a1a");
	});
});

describe("hslToHex", () => {
	it("converts pure red", () => {
		expect(hslToHex(0, 1, 0.5)).toBe("#ff0000");
	});

	it("converts pure green", () => {
		expect(hslToHex(120, 1, 0.5)).toBe("#00ff00");
	});

	it("converts pure blue", () => {
		expect(hslToHex(240, 1, 0.5)).toBe("#0000ff");
	});

	it("converts black and white", () => {
		expect(hslToHex(0, 0, 0)).toBe("#000000");
		expect(hslToHex(0, 0, 1)).toBe("#ffffff");
	});

	it("converts gray when saturation is zero", () => {
		expect(hslToHex(200, 0, 0.5)).toBe("#808080");
	});

	it("wraps hues outside the 0-360 range", () => {
		expect(hslToHex(360, 1, 0.5)).toBe(hslToHex(0, 1, 0.5));
		expect(hslToHex(480, 1, 0.5)).toBe(hslToHex(120, 1, 0.5));
	});

	it("handles negative hues by wrapping into range", () => {
		expect(hslToHex(-120, 1, 0.5)).toBe(hslToHex(240, 1, 0.5));
		expect(hslToHex(-360, 1, 0.5)).toBe(hslToHex(0, 1, 0.5));
	});

	it("produces distinct colors across the hue wheel segments", () => {
		const hues = [30, 90, 150, 210, 270, 330];
		const colors = hues.map((h) => hslToHex(h, 1, 0.5));
		const unique = new Set(colors);
		expect(unique.size).toBe(hues.length);
		for (const c of colors) {
			expect(c).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	it("always returns a well-formed 6-digit lowercase hex string", () => {
		for (let h = 0; h < 360; h += 37) {
			const hex = hslToHex(h, 0.7, 0.4);
			expect(hex).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});

describe("normalizeColor", () => {
	it("lowercases hex strings", () => {
		expect(normalizeColor("#ABC123")).toBe("#abc123");
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeColor("  #abc123  ")).toBe("#abc123");
	});

	it("treats mixed-case and spaced variants as equal", () => {
		expect(normalizeColor("#AbC123")).toBe(normalizeColor(" #abc123 "));
	});

	it("leaves an already-normalized value unchanged", () => {
		expect(normalizeColor("#abc123")).toBe("#abc123");
	});
});