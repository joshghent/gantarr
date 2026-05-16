import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sanitizeFilename, downloadJson, loadJson, exportPng, exportPdf } from "./export";
import type { GanttProject } from "../types";

describe("sanitizeFilename", () => {
	it("should sanitize a simple name", () => {
		expect(sanitizeFilename("My Project")).toBe("my-project");
	});

	it("should remove unsafe characters", () => {
		expect(sanitizeFilename('My<Project>:Name"Test')).toBe("mynametest");
	});

	it("should replace multiple spaces with single dash", () => {
		expect(sanitizeFilename("My   Project   Name")).toBe("my-project-name");
	});

	it("should remove control characters", () => {
		expect(sanitizeFilename("Test\x00\x1fProject")).toBe("testproject");
	});

	it("should truncate long names to 100 characters", () => {
		const longName = "a".repeat(150);
		expect(sanitizeFilename(longName)).toHaveLength(100);
	});

	it("should return 'untitled' for empty string", () => {
		expect(sanitizeFilename("")).toBe("untitled");
	});

	it("should return 'untitled' for whitespace only", () => {
		expect(sanitizeFilename("   ")).toBe("untitled");
	});

	it("should return 'untitled' when all characters are stripped", () => {
		expect(sanitizeFilename('<>:"/\\|?*')).toBe("untitled");
	});

	it("should handle trim and lowercase correctly", () => {
		expect(sanitizeFilename("  My PROJECT  ")).toBe("my-project");
	});

	it("should handle slash and backslash", () => {
		expect(sanitizeFilename("path/to\\file")).toBe("pathtofile");
	});
});

describe("downloadJson", () => {
	let createObjectURLSpy: ReturnType<typeof vi.fn>;
	let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
	let createElementSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		createObjectURLSpy = vi.fn(() => "blob:mock-url");
		revokeObjectURLSpy = vi.fn();
		global.URL.createObjectURL = createObjectURLSpy;
		global.URL.revokeObjectURL = revokeObjectURLSpy;

		const mockAnchor = {
			href: "",
			download: "",
			click: vi.fn(),
		};
		createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should create and download JSON file", () => {
		const project: GanttProject = {
			name: "Test Project",
			workstreams: [],
			tasks: [],
		};

		downloadJson(project);

		expect(createElementSpy).toHaveBeenCalledWith("a");
		expect(createObjectURLSpy).toHaveBeenCalled();

		const blob = createObjectURLSpy.mock.calls[0][0];
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("application/json");

		const mockAnchor = createElementSpy.mock.results[0].value;
		expect(mockAnchor.href).toBe("blob:mock-url");
		expect(mockAnchor.download).toBe("test-project.gantarr.json");
		expect(mockAnchor.click).toHaveBeenCalled();
		expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
	});

	it("should sanitize filename in download", () => {
		const project: GanttProject = {
			name: "My<Project>:Name",
			workstreams: [],
			tasks: [],
		};

		downloadJson(project);

		const mockAnchor = createElementSpy.mock.results[0].value;
		expect(mockAnchor.download).toBe("myname.gantarr.json");
	});
});

describe("loadJson", () => {
	it("should resolve with parsed JSON on success", async () => {
		const mockProject: GanttProject = {
			name: "Test",
			workstreams: [],
			tasks: [],
		};
		const mockFile = new File([JSON.stringify(mockProject)], "test.json", {
			type: "application/json",
		});

		const result = await loadJson(mockFile);
		expect(result).toEqual(mockProject);
	});

	it("should reject with error on invalid JSON", async () => {
		const mockFile = new File(["invalid json{"], "test.json", {
			type: "application/json",
		});

		await expect(loadJson(mockFile)).rejects.toThrow("Invalid JSON file");
	});

	it("should reject with error on file read error", async () => {
		const mockFile = new File(["{}"], "test.json", {
			type: "application/json",
		});

		const readerSpy = vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (this: FileReader) {
			setTimeout(() => {
				if (this.onerror) {
					this.onerror(new ProgressEvent("error"));
				}
			}, 0);
		});

		await expect(loadJson(mockFile)).rejects.toThrow("Failed to read file");
		readerSpy.mockRestore();
	});
});

describe("exportPng", () => {
	let mockElement: HTMLElement;
	let createElementSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockElement = document.createElement("div");
		mockElement.style.cssText = "width: 100px; height: 100px;";
		Object.defineProperty(mockElement, "scrollWidth", { value: 100, configurable: true });
		Object.defineProperty(mockElement, "scrollHeight", { value: 100, configurable: true });
		Object.defineProperty(mockElement, "offsetWidth", { value: 100, configurable: true });
		Object.defineProperty(mockElement, "offsetHeight", { value: 100, configurable: true });

		const mockAnchor = {
			href: "",
			download: "",
			click: vi.fn(),
		};
		createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);

		global.requestAnimationFrame = vi.fn((cb) => {
			cb(0);
			return 0;
		});

		vi.mock("html-to-image", () => ({
			toPng: vi.fn(() => Promise.resolve("data:image/png;base64,mock")),
		}));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should export PNG with sanitized filename", async () => {
		const { toPng } = await import("html-to-image");
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");

		await exportPng(mockElement, "Test Project");

		const mockAnchor = createElementSpy.mock.results[0].value;
		expect(mockAnchor.href).toBe("data:image/png;base64,mock");
		expect(mockAnchor.download).toBe("test-project.png");
		expect(mockAnchor.click).toHaveBeenCalled();
	});

	it("should handle special characters in project name", async () => {
		const { toPng } = await import("html-to-image");
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");

		await exportPng(mockElement, "My<Project>:Name");

		const mockAnchor = createElementSpy.mock.results[0].value;
		expect(mockAnchor.download).toBe("myname.png");
	});
});

describe("exportPdf", () => {
	let mockElement: HTMLElement;
	let createElementSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockElement = document.createElement("div");
		mockElement.style.cssText = "width: 100px; height: 100px;";
		Object.defineProperty(mockElement, "scrollWidth", { value: 100, configurable: true });
		Object.defineProperty(mockElement, "scrollHeight", { value: 100, configurable: true });
		Object.defineProperty(mockElement, "offsetWidth", { value: 100, configurable: true });
		Object.defineProperty(mockElement, "offsetHeight", { value: 100, configurable: true });

		createElementSpy = vi.spyOn(document, "createElement");

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
				setTimeout(() => {
					if (this.onload) {
						this.onload();
					}
				}, 0);
			}
		} as any;

		vi.mock("html-to-image", () => ({
			toPng: vi.fn(() => Promise.resolve("data:image/png;base64,mock")),
		}));

		vi.mock("jspdf", () => ({
			jsPDF: vi.fn().mockImplementation(() => ({
				addImage: vi.fn(),
				save: vi.fn(),
			})),
		}));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should export PDF with sanitized filename", async () => {
		const { toPng } = await import("html-to-image");
		const { jsPDF } = await import("jspdf");
		
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");
		const mockPdfInstance = {
			addImage: vi.fn(),
			save: vi.fn(),
		};
		vi.mocked(jsPDF).mockReturnValue(mockPdfInstance as any);

		await exportPdf(mockElement, "Test Project");

		expect(mockPdfInstance.save).toHaveBeenCalledWith("test-project.pdf");
	});

	it("should create landscape PDF for wide images", async () => {
		const { toPng } = await import("html-to-image");
		const { jsPDF } = await import("jspdf");
		
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");
		const mockPdfInstance = {
			addImage: vi.fn(),
			save: vi.fn(),
		};
		vi.mocked(jsPDF).mockReturnValue(mockPdfInstance as any);

		global.Image = class MockImage {
			onload: (() => void) | null = null;
			src = "";
			width = 1200;
			height = 600;

			constructor() {
				setTimeout(() => {
					if (this.onload) {
						this.onload();
					}
				}, 0);
			}
		} as any;

		await exportPdf(mockElement, "Test Project");

		expect(jsPDF).toHaveBeenCalledWith(
			expect.objectContaining({
				orientation: "landscape",
			})
		);
	});

	it("should handle special characters in project name", async () => {
		const { toPng } = await import("html-to-image");
		const { jsPDF } = await import("jspdf");
		
		vi.mocked(toPng).mockResolvedValue("data:image/png;base64,mock");
		const mockPdfInstance = {
			addImage: vi.fn(),
			save: vi.fn(),
		};
		vi.mocked(jsPDF).mockReturnValue(mockPdfInstance as any);

		await exportPdf(mockElement, "My<Project>:Name");

		expect(mockPdfInstance.save).toHaveBeenCalledWith("myname.pdf");
	});
});