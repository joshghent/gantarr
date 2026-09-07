import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { GanttProject } from "../types";

/**
 * Sanitize a project name for use as a filename. Strips characters that
 * are unsafe on common filesystems (Windows especially), normalizes
 * whitespace, caps length, and falls back to "untitled" if nothing
 * survives. The *display* name in the app isn't touched — React escapes
 * that for us.
 */
export function sanitizeFilename(name: string): string {
	const cleaned = name
		.trim()
		// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
		.replace(/\s+/g, "-")
		.toLowerCase()
		.slice(0, 100);
	return cleaned || "untitled";
}

/**
 * html-to-image filter: drop any node flagged with data-no-export so
 * connector dots, drag grips, and the trailing "+ Workstream" button
 * never show up in PNG/PDF captures.
 */
function excludeFromExport(node: HTMLElement): boolean {
	if (node instanceof Element) {
		const el = node as HTMLElement;
		if (el.dataset?.noExport !== undefined) return false;
	}
	return true;
}

type StyleSnapshot = { el: HTMLElement; cssText: string };

const CLIP_VALUES = new Set(["auto", "scroll", "hidden"]);

function depth(el: HTMLElement): number {
	let d = 0;
	let node: HTMLElement | null = el.parentElement;
	while (node) {
		d++;
		node = node.parentElement;
	}
	return d;
}

/**
 * Height of an element's laid-out content, ignoring anything the export
 * drops. `scrollHeight` can't be used here: it never reports less than the
 * element's own client height, so a mostly-empty chart would keep reporting
 * a full viewport.
 */
function contentHeight(el: HTMLElement): number {
	const top = el.getBoundingClientRect().top;
	let bottom = top;
	for (const child of Array.from(el.children)) {
		if (!(child instanceof HTMLElement)) continue;
		if (child.dataset.noExport !== undefined) continue;
		const rect = child.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) continue;
		bottom = Math.max(bottom, rect.bottom);
	}
	const cs = getComputedStyle(el);
	const padding =
		Number.parseFloat(cs.paddingBottom || "0") +
		Number.parseFloat(cs.borderBottomWidth || "0");
	return Math.ceil(bottom - top + padding);
}

/**
 * The chart lives inside nested scroll containers (horizontal on the
 * chart grid, vertical on the sidebar). html-to-image captures whatever
 * is currently laid out, so anything scrolled off-screen is missing from
 * the export. Before capture we temporarily promote every clipping
 * container to overflow:visible, and size the real scrollers to their
 * full content, so the whole chart lays out on-screen at once. Heights go
 * the other way too: every box collapses onto its content, so a short chart
 * on a tall screen doesn't export a screenful of blank paper. Callers must
 * invoke `restoreAfterCapture` in a finally block.
 */
export function expandForCapture(root: HTMLElement): StyleSnapshot[] {
	// Text elements opt out of the overflow-visible treatment: instead of
	// spilling their content across the chart, they keep clipping so labels
	// stay inside their box. `wrap` lets multi-line labels (task bars,
	// workstream names) flow onto extra lines; `nowrap` keeps single-line
	// labels (month/week headers) on one line and ellipsizes the overflow.
	const wrappers = Array.from(
		root.querySelectorAll<HTMLElement>("[data-export-clip]"),
	);
	const wrapperSet = new Set(wrappers);
	const wrapperSnapshots: StyleSnapshot[] = wrappers.map((el) => ({
		el,
		cssText: el.style.cssText,
	}));
	for (const el of wrappers) {
		el.style.overflow = "hidden";
		if (el.dataset.exportClip === "wrap") {
			el.style.whiteSpace = "normal";
			el.style.wordBreak = "break-word";
			el.style.textOverflow = "clip";
		} else {
			el.style.whiteSpace = "nowrap";
			el.style.textOverflow = "ellipsis";
		}
	}

	const clippers: HTMLElement[] = [];
	const consider = (el: Element) => {
		if (!(el instanceof HTMLElement)) return;
		// Marked text elements are handled above — never expand them.
		if (wrapperSet.has(el)) return;
		const cs = getComputedStyle(el);
		if (
			CLIP_VALUES.has(cs.overflow) ||
			CLIP_VALUES.has(cs.overflowX) ||
			CLIP_VALUES.has(cs.overflowY)
		) {
			clippers.push(el);
		}
	};
	consider(root);
	root.querySelectorAll("*").forEach(consider);

	const snapshots: StyleSnapshot[] = wrapperSnapshots.concat(
		clippers.map((el) => ({
			el,
			cssText: el.style.cssText,
		})),
	);

	// Measure scroll sizes BEFORE mutating — once we set overflow:visible
	// the browser recomputes scrollWidth/Height based on new layout, which
	// may no longer reflect the scroll extent we care about.
	const scrollSizes = new Map<HTMLElement, { w: number; h: number }>();
	for (const el of clippers) {
		const cs = getComputedStyle(el);
		const isScroller =
			cs.overflow === "auto" ||
			cs.overflow === "scroll" ||
			cs.overflowX === "auto" ||
			cs.overflowX === "scroll" ||
			cs.overflowY === "auto" ||
			cs.overflowY === "scroll";
		if (isScroller) {
			scrollSizes.set(el, { w: el.scrollWidth, h: el.scrollHeight });
		}
	}

	// Absolutely positioned clippers (the workstream bands) get their size
	// from top/height, so the flex + height treatment below would destroy
	// them. They only need the overflow relaxed.
	const flowClippers = clippers.filter(
		(el) => getComputedStyle(el).position !== "absolute",
	);

	for (const el of clippers) {
		el.style.overflow = "visible";
		el.style.overflowX = "visible";
		el.style.overflowY = "visible";
		el.style.maxWidth = "none";
		el.style.maxHeight = "none";
	}

	for (const el of flowClippers) {
		// Drop flex sizing so the box grows (or shrinks) around the
		// now-expanded children instead of being held to the viewport.
		el.style.flex = "none";
		const size = scrollSizes.get(el);
		if (size) {
			// Scroller: pin the width to the measured content so nothing is
			// clipped horizontally.
			el.style.width = `${size.w}px`;
		}
		// Heights come from the content, never from the viewport: a scroller
		// with less content than screen reports scrollHeight === clientHeight,
		// which is what used to leave a screen's worth of blank paper under a
		// three-row chart.
		el.style.minHeight = "0";
		el.style.height = "auto";
	}

	// The root is a flex item in a full-height column; without this it keeps
	// stretching to the viewport no matter how short its content is.
	root.style.alignSelf = "flex-start";

	// Pin each box to its real content height, innermost first so every
	// parent measures children that have already collapsed.
	for (const el of [...flowClippers].sort((a, b) => depth(b) - depth(a))) {
		const height = contentHeight(el);
		if (height > 0) el.style.height = `${height}px`;
	}

	// Force the root to size around its (now expanded) content so
	// html-to-image reads the full dimensions from offsetWidth/Height.
	root.style.width = `${root.scrollWidth}px`;
	root.style.height = `${root.scrollHeight}px`;

	return snapshots;
}

export function restoreAfterCapture(snapshots: StyleSnapshot[]) {
	for (const { el, cssText } of snapshots) {
		el.style.cssText = cssText;
	}
}

/** Breathing room kept to the right of the last piece of content. */
const EXPORT_RIGHT_PAD = 24;

/**
 * How wide the export actually needs to be.
 *
 * The chart always renders a comfortable run of empty columns past the last
 * task (and enough to fill the viewport), which is right for working in but
 * shows up in a PNG as a field of blank grid. Measure the rightmost real
 * content — task bars, their overflow labels, legend chips — and cut there,
 * snapped out to the next whole day/week column so the grid never ends
 * mid-cell. html-to-image draws the element into a canvas of exactly this
 * width, so a smaller number simply crops the empty right-hand side.
 */
export function measureExportWidth(root: HTMLElement): number {
	const full = root.offsetWidth;
	const rootLeft = root.getBoundingClientRect().left;

	let right = 0;
	for (const el of root.querySelectorAll<HTMLElement>("[data-export-ink]")) {
		if (el.closest("[data-no-export]")) continue;
		const rect = el.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) continue;
		right = Math.max(right, rect.right - rootLeft);
	}
	if (right <= 0) return full;

	right += EXPORT_RIGHT_PAD;

	// Snap out to a column boundary so the last cell is whole.
	const grid = root.querySelector<HTMLElement>("[data-chart-grid]");
	const colWidth = Number(grid?.dataset.colWidth ?? 0);
	if (grid && colWidth > 0) {
		const gridLeft = grid.getBoundingClientRect().left - rootLeft;
		if (right > gridLeft) {
			right = gridLeft + Math.ceil((right - gridLeft) / colWidth) * colWidth;
		}
	}

	return Math.max(1, Math.min(full, Math.ceil(right)));
}

async function captureFullChart(element: HTMLElement): Promise<string> {
	const snapshots = expandForCapture(element);
	try {
		// One frame for the browser to flush layout changes before we
		// serialize the tree.
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
		return await toPng(element, {
			backgroundColor: "#ffffff",
			pixelRatio: 2,
			skipFonts: true,
			filter: excludeFromExport,
			width: measureExportWidth(element),
			height: element.offsetHeight,
		});
	} finally {
		restoreAfterCapture(snapshots);
	}
}

export function downloadJson(project: GanttProject) {
	const data = JSON.stringify(project, null, 2);
	const blob = new Blob([data], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${sanitizeFilename(project.name)}.gantarr.json`;
	a.click();
	URL.revokeObjectURL(url);
}

export function loadJson(file: File): Promise<GanttProject> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const project = JSON.parse(reader.result as string) as GanttProject;
				resolve(project);
			} catch {
				reject(new Error("Invalid JSON file"));
			}
		};
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsText(file);
	});
}

export async function exportPng(element: HTMLElement, projectName: string) {
	const dataUrl = await captureFullChart(element);
	const a = document.createElement("a");
	a.href = dataUrl;
	a.download = `${sanitizeFilename(projectName)}.png`;
	a.click();
}

export async function exportPdf(element: HTMLElement, projectName: string) {
	const dataUrl = await captureFullChart(element);

	const img = new Image();
	img.src = dataUrl;
	await new Promise((resolve) => {
		img.onload = resolve;
	});

	const imgWidth = img.width;
	const imgHeight = img.height;

	// Landscape A4 or wider
	const pdfWidth = Math.max(297, imgWidth * 0.264583); // mm
	const pdfHeight = (imgHeight / imgWidth) * pdfWidth;

	const pdf = new jsPDF({
		orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
		unit: "mm",
		format: [pdfWidth, pdfHeight],
	});

	pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
	pdf.save(`${sanitizeFilename(projectName)}.pdf`);
}
