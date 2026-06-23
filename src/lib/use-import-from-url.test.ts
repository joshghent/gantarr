import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeProject } from "./project-link";
import { buildProject, type ChartInput } from "./project-schema";
import { useImportFromUrl } from "./use-import-from-url";

function sample() {
	const input: ChartInput = {
		name: "Imported",
		workstreams: [
			{
				label: "Build",
				tasks: [{ title: "Task", start: "2026-05-04", end: "2026-05-08" }],
			},
		],
	};
	return buildProject(input);
}

describe("useImportFromUrl", () => {
	beforeEach(() => {
		window.history.replaceState({}, "", "/");
	});

	it("decodes ?import= into a project and strips the token from the url", async () => {
		const project = sample();
		const token = await encodeProject(project);
		window.history.replaceState({}, "", `/?import=${token}`);

		const onImport = vi.fn();
		renderHook(() => useImportFromUrl(onImport));

		await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
		expect(onImport.mock.calls[0][0]).toEqual(project);
		expect(window.location.search).not.toContain("import=");
	});

	it("does nothing when there is no import token", async () => {
		const onImport = vi.fn();
		const { result } = renderHook(() => useImportFromUrl(onImport));
		await new Promise((r) => setTimeout(r, 20));
		expect(onImport).not.toHaveBeenCalled();
		expect(result.current.state).toBe("idle");
	});

	it("reports an error for a malformed token and does not import", async () => {
		window.history.replaceState({}, "", "/?import=not-a-valid-token!!!");
		const onImport = vi.fn();
		const { result } = renderHook(() => useImportFromUrl(onImport));

		await waitFor(() => expect(result.current.state).toBe("error"));
		expect(onImport).not.toHaveBeenCalled();
	});
});
