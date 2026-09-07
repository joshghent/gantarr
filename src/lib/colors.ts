/**
 * Shared color helpers. Kept separate from the store so both the
 * rendering components and the palette logic can use them without
 * importing project state.
 */

export function hexToRgb(
	hex: string,
): { r: number; g: number; b: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
			}
		: null;
}

/** Black or white body text, whichever reads better on `hex`. */
export function getContrastText(hex: string): string {
	const rgb = hexToRgb(hex);
	if (!rgb) return "#ffffff";
	const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
	return luminance > 0.55 ? "#1a1a1a" : "#ffffff";
}

function toHex(n: number): string {
	return Math.round(Math.min(255, Math.max(0, n)))
		.toString(16)
		.padStart(2, "0");
}

/** HSL (h in degrees, s/l in 0..1) → #rrggbb */
export function hslToHex(h: number, s: number, l: number): string {
	const hue = ((h % 360) + 360) % 360;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = l - c / 2;
	const [r, g, b] =
		hue < 60
			? [c, x, 0]
			: hue < 120
				? [x, c, 0]
				: hue < 180
					? [0, c, x]
					: hue < 240
						? [0, x, c]
						: hue < 300
							? [x, 0, c]
							: [c, 0, x];
	return `#${toHex((r + m) * 255)}${toHex((g + m) * 255)}${toHex((b + m) * 255)}`;
}

/** Normalize for comparison so "#ABC123" and "#abc123" count as one color. */
export function normalizeColor(hex: string): string {
	return hex.trim().toLowerCase();
}
