import { describe, expect, it } from "vitest";
import {
	getContrastText,
	hexToRgb,
	hslToHex,
	normalizeColor,
} from "./colors";

describe("hexToRgb", () => {
	it("parses a lowercase hex color", () => {
		expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
	});

	it("parses an uppercase hex color", () => {
		expect(hexToRgb("#00FF00")).toEqual({ r: 0, g: 255, b: 0 });
	});

	it("parses a hex color without a leading #", () => {
		expect(hexToRgb("0000ff")).toEqual({ r: 0, g: 0, b: 255 });
	});

	it("parses mixed-case hex digits", () => {
		expect(hexToRgb("#aAbBcC")).toEqual({ r: 170, g: 187, b: 204 });
	});

	it("trims surrounding whitespace before parsing", () => {
		expect(hexToRgb("  #123456  ")).toEqual({ r: 18, g: 52, b: 86 });
	});

	it("returns null for a 3-digit shorthand hex", () => {
		expect(hexToRgb("#fff")).toBeNull();
	});

	it("returns null for invalid characters", () => {
		expect(hexToRgb("#gggggg")).toBeNull();
	});

	it("returns null for an incorrect length", () => {
		expect(hexToRgb("#12345")).toBeNull();
		expect(hexToRgb("#1234567")).toBeNull();
	});

	it("returns null for an empty string", () => {
		expect(hexToRgb("")).toBeNull();
	});

	it("returns null for non-hex input entirely", () => {
		expect(hexToRgb("not-a-color")).toBeNull();
	});
});

describe("getContrastText", () => {
	it("returns dark text for white background", () => {
		expect(getContrastText("#ffffff")).toBe("#1a1a1a");
	});

	it("returns light text for black background", () => {
		expect(getContrastText("#000000")).toBe("#ffffff");
	});

	it("returns light text for a dark, saturated color", () => {
		expect(getContrastText("#0000ff")).toBe("#ffffff");
	});

	it("returns dark text for a light, saturated color", () => {
		expect(getContrastText("#ffff00")).toBe("#1a1a1a");
	});

	it("falls back to white text when given an invalid hex", () => {
		expect(getContrastText("not-a-color")).toBe("#ffffff");
	});

	it("is right at the boundary just above the threshold", () => {
		// luminance just over 0.55 should read as dark text
		const hex = "#8f8f8f"; // luminance ~ 0.56
		expect(getContrastText(hex)).toBe("#1a1a1a");
	});

	it("is right at the boundary just below the threshold", () => {
		const hex = "#8b8b8b"; // luminance ~ 0.545
		expect(getContrastText(hex)).toBe("#ffffff");
	});
});

describe("hslToHex", () => {
	it("converts pure red (h=0)", () => {
		expect(hslToHex(0, 1, 0.5)).toBe("#ff0000");
	});

	it("converts pure green (h=120)", () => {
		expect(hslToHex(120, 1, 0.5)).toBe("#00ff00");
	});

	it("converts pure blue (h=240)", () => {
		expect(hslToHex(240, 1, 0.5)).toBe("#0000ff");
	});

	it("converts yellow (h=60)", () => {
		expect(hslToHex(60, 1, 0.5)).toBe("#ffff00");
	});

	it("converts cyan (h=180)", () => {
		expect(hslToHex(180, 1, 0.5)).toBe("#00ffff");
	});

	it("converts magenta (h=300)", () => {
		expect(hslToHex(300, 1, 0.5)).toBe("#ff00ff");
	});

	it("produces white at lightness 1 regardless of hue/saturation", () => {
		expect(hslToHex(0, 1, 1)).toBe("#ffffff");
		expect(hslToHex(200, 0.5, 1)).toBe("#ffffff");
	});

	it("produces black at lightness 0 regardless of hue/saturation", () => {
		expect(hslToHex(0, 1, 0)).toBe("#000000");
		expect(hslToHex(200, 0.5, 0)).toBe("#000000");
	});

	it("produces a gray when saturation is 0", () => {
		expect(hslToHex(180, 0, 0.5)).toBe("#808080");
	});

	it("normalizes negative hue values", () => {
		expect(hslToHex(-360, 1, 0.5)).toBe(hslToHex(0, 1, 0.5));
		expect(hslToHex(-60, 1, 0.5)).toBe(hslToHex(300, 1, 0.5));
	});

	it("normalizes hue values greater than 360", () => {
		expect(hslToHex(360, 1, 0.5)).toBe(hslToHex(0, 1, 0.5));
		expect(hslToHex(480, 1, 0.5)).toBe(hslToHex(120, 1, 0.5));
	});

	it("always returns a well-formed 7-character hex string", () => {
		const hex = hslToHex(37, 0.42, 0.33);
		expect(hex).toMatch(/^#[0-9a-f]{6}$/);
	});
});

describe("normalizeColor", () => {
	it("lowercases hex letters", () => {
		expect(normalizeColor("#ABC123")).toBe("#abc123");
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeColor("  #abc123  ")).toBe("#abc123");
	});

	it("treats differently-cased equivalent colors as equal", () => {
		expect(normalizeColor("#ABC123")).toBe(normalizeColor("#abc123"));
	});

	it("leaves an already-normalized color unchanged", () => {
		expect(normalizeColor("#123abc")).toBe("#123abc");
	});
});