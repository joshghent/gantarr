import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { GanttProject } from "../types";

export function downloadJson(project: GanttProject) {
	const data = JSON.stringify(project, null, 2);
	const blob = new Blob([data], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${project.name.replace(/\s+/g, "-").toLowerCase()}.gantarr.json`;
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

export async function exportPng(element: HTMLElement, filename: string) {
	const dataUrl = await toPng(element, {
		backgroundColor: "#ffffff",
		pixelRatio: 2,
		skipFonts: true,
	});
	const a = document.createElement("a");
	a.href = dataUrl;
	a.download = `${filename}.png`;
	a.click();
}

export async function exportPdf(element: HTMLElement, filename: string) {
	const dataUrl = await toPng(element, {
		backgroundColor: "#ffffff",
		pixelRatio: 2,
		skipFonts: true,
	});

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
	pdf.save(`${filename}.pdf`);
}
