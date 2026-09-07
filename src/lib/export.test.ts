import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import {
	downloadJson,
	expandForCapture,
	exportPdf,
	exportPng,
	loadJson,
	measureExportWidth,
	restoreAfterCapture,
	sanitizeFilename,
} from "./export";
import { createProject } from "./gantt-store";

// html-to-image and jsPDF touch the real DOM/canvas; stub them so the export
// helpers can be exercised for their filename + wiring behavior.
vi.mock("html-to-image", () => ({
	toPng: vi.fn(() => Promise.resolve("data:image/png;base64,mock")),
}));
vi.mock("jspdf", () => ({
	jsPDF: vi.fn().mockImplementation(() => ({
		addImage: vi.fn(),
		save: vi.fn(),
	})),
}));

describe("sanitizeFilename", () => {
	it("sanitizes a simple name", () => {
		expect(sanitizeFilename("My Project")).toBe("my-project");
	});

	it("strips unsafe characters but keeps the surrounding text", () => {
		expect(sanitizeFilename('My<Project>:Name"Test')).toBe("myprojectnametest");
	});

	it("collapses runs of whitespace into single dashes", () => {
		expect(sanitizeFilename("My   Project   Name")).toBe("my-project-name");
	});

	it("removes control characters", () => {
		expect(sanitizeFilename("Test\x00\x1fProject")).toBe("testproject");
	});

	it("truncates long names to 100 characters", () => {
		expect(sanitizeFilename("a".repeat(150))).toHaveLength(100);
	});

	it("returns 'untitled' for an empty string", () => {
		expect(sanitizeFilename("")).toBe("untitled");
	});

	it("returns 'untitled' for whitespace only", () => {
		expect(sanitizeFilename("   ")).toBe("untitled");
	});

	it("returns 'untitled' when every character is stripped", () => {
		expect(sanitizeFilename('<>:"/\\|?*')).toBe("untitled");
	});

	it("trims and lowercases", () => {
		expect(sanitizeFilename("  My PROJECT  ")).toBe("my-project");
	});

	it("removes slashes and backslashes", () => {
		expect(sanitizeFilename("path/to\\file")).toBe("pathtofile");
	});
});

describe("downloadJson", () => {
	let createObjectURLSpy: ReturnType<typeof vi.fn>;
	let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
	let createElementSpy: MockInstance;

	beforeEach(() => {
		createObjectURLSpy = vi.fn(() => "blob:mock-url");
		revokeObjectURLSpy = vi.fn();
		global.URL.createObjectURL =
			createObjectURLSpy as unknown as typeof URL.createObjectURL;
		global.URL.revokeObjectURL =
			revokeObjectURLSpy as unknown as typeof URL.revokeObjectURL;

		const mockAnchor = { href: "", download: "", click: vi.fn() };
		createElementSpy = vi
			.spyOn(document, "createElement")
			.mockReturnValue(mockAnchor as unknown as HTMLElement);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates and downloads a JSON file", () => {
		const project = createProject("Test Project");

		downloadJson(project);

		expect(createElementSpy).toHaveBeenCalledWith("a");
		expect(createObjectURLSpy).toHaveBeenCalled();

		const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("application/json");

		const mockAnchor = createElementSpy.mock.results[0].value as {
			href: string;
			download: string;
			click: ReturnType<typeof vi.fn>;
		};
		expect(mockAnchor.href).toBe("blob:mock-url");
		expect(mockAnchor.download).toBe("test-project.gantarr.json");
		expect(mockAnchor.click).toHaveBeenCalled();
		expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
	});

	it("sanitizes the filename on download", () => {
		const project = createProject("My<Project>:Name");

		downloadJson(project);

		const mockAnchor = createElementSpy.mock.results[0].value as {
			download: string;
		};
		expect(mockAnchor.download).toBe("myprojectname.gantarr.json");
	});
});

describe("loadJson", () => {
	it("resolves with the parsed project on success", async () => {
		const project = createProject("Test");
		const file = new File([JSON.stringify(project)], "test.json", {
			type: "application/json",
		});

		const result = await loadJson(file);
		expect(result).toEqual(project);
	});

	it("rejects on invalid JSON", async () => {
		const file = new File(["invalid json{"], "test.json", {
			type: "application/json",
		});
		await expect(loadJson(file)).rejects.toThrow("Invalid JSON file");
	});

	it("rejects on a file read error", async () => {
		const file = new File(["{}"], "test.json", { type: "application/json" });
		const readerSpy = vi
			.spyOn(FileReader.prototype, "readAsText")
			.mockImplementation(function (this: FileReader) {
				setTimeout(() => {
					this.onerror?.(
						new ProgressEvent("error") as ProgressEvent<FileReader>,
					);
				}, 0);
			});

		await expect(loadJson(file)).rejects.toThrow("Failed to read file");
		readerSpy.mockRestore();
	});
});

describe("exportPng", () => {
	let mockElement: HTMLElement;
	let createElementSpy: MockInstance;

	beforeEach(() => {
		mockElement = document.createElement("div");
		for (const dim of [
			"scrollWidth",
			"scrollHeight",
			"offsetWidth",
			"offsetHeight",
		]) {
			Object.defineProperty(mockElement, dim, {
				value: 100,
				configurable: true,
			});
		}

		const mockAnchor = { href: "", download: "", click: vi.fn() };
		createElementSpy = vi
			.spyOn(document, "createElement")
			.mockReturnValue(mockAnchor as unknown as HTMLElement);

		global.requestAnimationFrame = vi.fn((cb) => {
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("exports a PNG with a sanitized filename", async () => {
		const { toPng } = await import("html-to-image");
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");

		await exportPng(mockElement, "Test Project");

		const mockAnchor = createElementSpy.mock.results[0].value as {
			href: string;
			download: string;
			click: ReturnType<typeof vi.fn>;
		};
		expect(mockAnchor.href).toBe("data:image/png;base64,mock");
		expect(mockAnchor.download).toBe("test-project.png");
		expect(mockAnchor.click).toHaveBeenCalled();
	});

	it("handles special characters in the project name", async () => {
		const { toPng } = await import("html-to-image");
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");

		await exportPng(mockElement, "My<Project>:Name");

		const mockAnchor = createElementSpy.mock.results[0].value as {
			download: string;
		};
		expect(mockAnchor.download).toBe("myprojectname.png");
	});
});

describe("exportPdf", () => {
	let mockElement: HTMLElement;

	beforeEach(() => {
		mockElement = document.createElement("div");
		for (const dim of [
			"scrollWidth",
			"scrollHeight",
			"offsetWidth",
			"offsetHeight",
		]) {
			Object.defineProperty(mockElement, dim, {
				value: 100,
				configurable: true,
			});
		}

		global.requestAnimationFrame = vi.fn((cb) => {
			cb(0);
			return 0;
		});

		global.Image = class MockImage {
			onload: (() => void) | null = null;
			src = "";
			width = 800;
			height = 600;
			constructor() {
				setTimeout(() => this.onload?.(), 0);
			}
		} as unknown as typeof Image;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("exports a PDF with a sanitized filename", async () => {
		const { toPng } = await import("html-to-image");
		const { jsPDF } = await import("jspdf");
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");
		const mockPdf = { addImage: vi.fn(), save: vi.fn() };
		vi.mocked(jsPDF).mockReturnValue(
			mockPdf as unknown as InstanceType<typeof jsPDF>,
		);

		await exportPdf(mockElement, "Test Project");

		expect(mockPdf.save).toHaveBeenCalledWith("test-project.pdf");
	});

	it("creates a landscape PDF for wide images", async () => {
		const { toPng } = await import("html-to-image");
		const { jsPDF } = await import("jspdf");
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");
		const mockPdf = { addImage: vi.fn(), save: vi.fn() };
		vi.mocked(jsPDF).mockReturnValue(
			mockPdf as unknown as InstanceType<typeof jsPDF>,
		);

		global.Image = class MockImage {
			onload: (() => void) | null = null;
			src = "";
			width = 1200;
			height = 600;
			constructor() {
				setTimeout(() => this.onload?.(), 0);
			}
		} as unknown as typeof Image;

		await exportPdf(mockElement, "Test Project");

		expect(jsPDF).toHaveBeenCalledWith(
			expect.objectContaining({ orientation: "landscape" }),
		);
	});

	it("handles special characters in the project name", async () => {
		const { toPng } = await import("html-to-image");
		const { jsPDF } = await import("jspdf");
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");
		const mockPdf = { addImage: vi.fn(), save: vi.fn() };
		vi.mocked(jsPDF).mockReturnValue(
			mockPdf as unknown as InstanceType<typeof jsPDF>,
		);

		await exportPdf(mockElement, "My<Project>:Name");

		expect(mockPdf.save).toHaveBeenCalledWith("myprojectname.pdf");
	});
});

describe("expandForCapture — text elements", () => {
	it("makes wrap-marked labels wrap-and-clip instead of spilling", () => {
		const root = document.createElement("div");
		const label = document.createElement("span");
		// Simulate the on-screen truncation the tailwind `truncate` class
		// gives task/workstream labels.
		label.dataset.exportClip = "wrap";
		label.style.overflow = "hidden";
		label.style.whiteSpace = "nowrap";
		label.style.textOverflow = "ellipsis";
		root.appendChild(label);

		const snapshots = expandForCapture(root);
		try {
			// Must NOT be promoted to overflow:visible (that's what let text
			// spill across the chart on export).
			expect(label.style.overflow).toBe("hidden");
			expect(label.style.whiteSpace).toBe("normal");
			expect(label.style.wordBreak).toBe("break-word");
		} finally {
			restoreAfterCapture(snapshots);
		}

		// Original inline styles are restored afterwards.
		expect(label.style.whiteSpace).toBe("nowrap");
		expect(label.style.overflow).toBe("hidden");
	});

	it("keeps nowrap-marked headers on one line with an ellipsis", () => {
		const root = document.createElement("div");
		const month = document.createElement("span");
		month.dataset.exportClip = "nowrap";
		month.style.overflow = "hidden";
		root.appendChild(month);

		const snapshots = expandForCapture(root);
		try {
			expect(month.style.overflow).toBe("hidden");
			expect(month.style.whiteSpace).toBe("nowrap");
			expect(month.style.textOverflow).toBe("ellipsis");
		} finally {
			restoreAfterCapture(snapshots);
		}
	});
});

describe("measureExportWidth", () => {
	// jsdom has no layout engine, so the geometry is stubbed: what's under
	// test is the "how far right does real content reach" arithmetic, not
	// the browser's box model.
	function box(el: HTMLElement, left: number, right: number) {
		el.getBoundingClientRect = () =>
			({
				left,
				right,
				top: 0,
				bottom: 20,
				width: right - left,
				height: 20,
				x: left,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;
	}

	function setup(fullWidth: number) {
		const root = document.createElement("div");
		Object.defineProperty(root, "offsetWidth", {
			value: fullWidth,
			configurable: true,
		});
		box(root, 0, fullWidth);
		document.body.appendChild(root);
		return root;
	}

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("falls back to the full width when there's no marked content", () => {
		const root = setup(2000);
		expect(measureExportWidth(root)).toBe(2000);
	});

	it("cuts just past the rightmost piece of content", () => {
		const root = setup(2000);
		const bar = document.createElement("div");
		bar.dataset.exportInk = "true";
		box(bar, 300, 500);
		root.appendChild(bar);
		// 500 + 24px of breathing room
		expect(measureExportWidth(root)).toBe(524);
	});

	it("never returns more than the element's own width", () => {
		const root = setup(600);
		const bar = document.createElement("div");
		bar.dataset.exportInk = "true";
		box(bar, 0, 595);
		root.appendChild(bar);
		expect(measureExportWidth(root)).toBe(600);
	});

	it("ignores content that the export drops anyway", () => {
		const root = setup(2000);
		const kept = document.createElement("div");
		kept.dataset.exportInk = "true";
		box(kept, 0, 400);
		const dropped = document.createElement("div");
		dropped.dataset.noExport = "true";
		const inner = document.createElement("div");
		inner.dataset.exportInk = "true";
		box(inner, 0, 1800);
		dropped.appendChild(inner);
		root.append(kept, dropped);
		expect(measureExportWidth(root)).toBe(424);
	});

	it("rounds out to a whole day/week column", () => {
		const root = setup(2000);
		const grid = document.createElement("div");
		grid.dataset.chartGrid = "true";
		grid.dataset.colWidth = "36";
		box(grid, 200, 2000);
		const bar = document.createElement("div");
		bar.dataset.exportInk = "true";
		box(bar, 300, 500);
		grid.appendChild(bar);
		root.appendChild(grid);
		// 500 + 24 = 524 -> 9 columns of 36 past the grid's left edge (200)
		expect(measureExportWidth(root)).toBe(200 + 36 * 9);
	});
});
