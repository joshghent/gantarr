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

/**
 * The chart lives inside nested scroll containers (horizontal on the
 * chart grid, vertical on the sidebar). html-to-image captures whatever
 * is currently laid out, so anything scrolled off-screen is missing from
 * the export. Before capture we temporarily promote every clipping
 * container to overflow:visible, and size the real scrollers to their
 * full content, so the whole chart lays out on-screen at once. Callers
 * must invoke `restoreAfterCapture` in a finally block.
 */
function expandForCapture(root: HTMLElement): StyleSnapshot[] {
	const clippers: HTMLElement[] = [];
	const consider = (el: Element) => {
		if (!(el instanceof HTMLElement)) return;
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

	const snapshots: StyleSnapshot[] = clippers.map((el) => ({
		el,
		cssText: el.style.cssText,
	}));

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

	for (const el of clippers) {
		el.style.overflow = "visible";
		el.style.overflowX = "visible";
		el.style.overflowY = "visible";
		el.style.maxWidth = "none";
		el.style.maxHeight = "none";
		const size = scrollSizes.get(el);
		if (size) {
			// Scroller: pin to measured content size so nothing is clipped.
			el.style.flex = "none";
			el.style.width = `${size.w}px`;
			el.style.height = `${size.h}px`;
		} else if (getComputedStyle(el).position !== "absolute") {
			// Non-scroller clipper (overflow:hidden wrapper): drop flex
			// sizing so it grows around the now-expanded children instead
			// of holding them to the original viewport dimensions. Skip
			// absolutely positioned bands — their size comes from left/
			// right/top/bottom and clearing flex would break them.
			el.style.flex = "none";
		}
	}

	// Force the root to size around its (now expanded) content so
	// html-to-image reads the full dimensions from offsetWidth/Height.
	root.style.width = `${root.scrollWidth}px`;
	root.style.height = `${root.scrollHeight}px`;

	return snapshots;
}

function restoreAfterCapture(snapshots: StyleSnapshot[]) {
	for (const { el, cssText } of snapshots) {
		el.style.cssText = cssText;
	}
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
			width: element.offsetWidth,
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
