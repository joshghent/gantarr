import { describe, expect, it } from "vitest";
import { shouldRenderLabelOutside } from "./WorkItemBar";

describe("shouldRenderLabelOutside", () => {
	// Regression (#102): every title that didn't fit its bar was written
	// beside the bar, so a week-wide task with a longish name rendered as an
	// empty coloured box with its title floating out in the grid — truncated
	// out there anyway. Wide bars keep their titles.
	it("keeps the title inside a bar wide enough to read", () => {
		// One week column in week view.
		expect(shouldRenderLabelOutside(112, 600)).toBe(false);
		// Two week columns, the case in the bug report.
		expect(shouldRenderLabelOutside(224, 900)).toBe(false);
	});

	it("spills the title out of a bar too narrow for any text", () => {
		// A single day column in day view — 12px of text room inside.
		expect(shouldRenderLabelOutside(36, 400)).toBe(true);
	});

	it("keeps the title inside when the gap beside the bar is tiny", () => {
		// An outside label here would be an ellipsis and nothing else.
		expect(shouldRenderLabelOutside(36, 40)).toBe(false);
	});

	it("keeps the title inside when the bar shows more of it than the gap", () => {
		// 60px of text room inside beats 46px outside.
		expect(shouldRenderLabelOutside(84, 60)).toBe(false);
		expect(shouldRenderLabelOutside(84, 200)).toBe(true);
	});

	it("never spills when there is no room at all to the right", () => {
		expect(shouldRenderLabelOutside(36, 0)).toBe(false);
	});
});
