import { useEffect, useRef, useState } from "react";
import type { GanttProject } from "../types";
import { decodeProject, extractImportToken } from "./project-link";

export type ImportStatus =
	| { state: "idle" }
	| { state: "error"; message: string };

/**
 * On mount, if the URL carries an `?import=<token>`, decode it into a project,
 * hand it to `onImport`, and strip the token so a refresh won't re-import and
 * the address bar stays clean. Errors are surfaced (not swallowed) via the
 * returned status so the UI can tell the user the link was bad.
 */
export function useImportFromUrl(
	onImport: (project: GanttProject) => void,
): ImportStatus {
	const [status, setStatus] = useState<ImportStatus>({ state: "idle" });
	// Keep the latest callback without making the effect re-run.
	const onImportRef = useRef(onImport);
	onImportRef.current = onImport;

	useEffect(() => {
		const token = extractImportToken(window.location.search);
		if (!token) return;

		let cancelled = false;
		decodeProject(token)
			.then((project) => {
				if (cancelled) return;
				onImportRef.current(project);
				const url = new URL(window.location.href);
				url.searchParams.delete("import");
				window.history.replaceState(
					{},
					"",
					url.pathname + url.search + url.hash,
				);
			})
			.catch((err) => {
				if (cancelled) return;
				setStatus({
					state: "error",
					message:
						err instanceof Error ? err.message : "Could not open that link",
				});
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return status;
}
