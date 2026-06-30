import { useCallback, useEffect, useRef, useState } from "react";
import { downloadJson, loadJson } from "#/lib/export";
import { GanttProvider, useGantt } from "#/lib/gantt-context";
import { createProject } from "#/lib/gantt-store";
import {
	hasUnseenRelease,
	LATEST_RELEASE_VERSION,
	RELEASE_SEEN_KEY,
} from "#/lib/release-notes";
import { useImportFromUrl } from "#/lib/use-import-from-url";
import GanttChart from "./GanttChart";
import GanttSidebar from "./GanttSidebar";
import GanttToolbar from "./GanttToolbar";
import HelpDialog from "./HelpDialog";
import ItemDetailPanel from "./ItemDetailPanel";
import LegendPanel from "./LegendPanel";
import ReleaseNotesDialog from "./ReleaseNotesDialog";
import TaskModal from "./TaskModal";

function GanttEditorInner() {
	const chartRef = useRef<HTMLDivElement>(null);
	const {
		project,
		selectedItemId,
		setSelectedItemId,
		deleteWorkItem,
		setViewMode,
		addWorkstream,
		setProject,
		isDirty,
		markClean,
		editingItemId,
		modalItemId,
	} = useGantt();

	const [helpOpen, setHelpOpen] = useState(false);
	const [dragOverActive, setDragOverActive] = useState(false);
	const [releaseOpen, setReleaseOpen] = useState(false);

	// --- Open a chart shared via ?import= (e.g. produced by an AI) ---
	const importStatus = useImportFromUrl(
		useCallback(
			(imported) => {
				setProject(imported);
				markClean();
			},
			[setProject, markClean],
		),
	);
	useEffect(() => {
		if (importStatus.state === "error") {
			alert(`Couldn't open that shared chart: ${importStatus.message}`);
		}
	}, [importStatus]);

	// --- One-time "What's new" popup, gated by last-seen version ---
	const markReleaseSeen = useCallback(() => {
		try {
			window.localStorage.setItem(RELEASE_SEEN_KEY, LATEST_RELEASE_VERSION);
		} catch {
			// localStorage may be unavailable (private mode); the dialog still
			// works, it just can't remember being dismissed.
		}
	}, []);

	useEffect(() => {
		let lastSeen: string | null = null;
		try {
			lastSeen = window.localStorage.getItem(RELEASE_SEEN_KEY);
		} catch {
			lastSeen = null;
		}
		if (hasUnseenRelease(lastSeen)) setReleaseOpen(true);
	}, []);

	const handleReleaseOpenChange = useCallback(
		(open: boolean) => {
			setReleaseOpen(open);
			if (!open) markReleaseSeen();
		},
		[markReleaseSeen],
	);

	// --- File loading (used by Cmd+O shortcut and drop handler) ---
	const runLoad = useCallback(
		async (file: File) => {
			try {
				const loaded = await loadJson(file);
				setProject(loaded);
				markClean();
			} catch (_err) {
				alert(
					"Failed to load file. Make sure it's a valid .gantarr.json file.",
				);
			}
		},
		[setProject, markClean],
	);

	const handleLoadWithConfirm = useCallback(
		async (file: File) => {
			// Protect in-progress work — prompt before replacing it.
			if (
				isDirty &&
				!window.confirm(
					"Replace current project with the dropped file? Any unsaved changes will be lost. Cancel to save first.",
				)
			) {
				return;
			}
			await runLoad(file);
		},
		[isDirty, runLoad],
	);

	// --- Drop handler: accept a .gantarr.json or .json file from anywhere ---
	useEffect(() => {
		const onDragOver = (e: DragEvent) => {
			if (!e.dataTransfer?.types?.includes("Files")) return;
			e.preventDefault();
			setDragOverActive(true);
		};
		const onDragLeave = (e: DragEvent) => {
			// Only clear when the drag actually leaves the window.
			if (e.relatedTarget === null) setDragOverActive(false);
		};
		const onDrop = (e: DragEvent) => {
			if (!e.dataTransfer?.files?.length) return;
			e.preventDefault();
			setDragOverActive(false);
			const file = Array.from(e.dataTransfer.files).find((f) =>
				/\.(gantarr\.)?json$/i.test(f.name),
			);
			if (!file) {
				alert("Drop a .gantarr.json file to load it.");
				return;
			}
			handleLoadWithConfirm(file);
		};

		window.addEventListener("dragover", onDragOver);
		window.addEventListener("dragleave", onDragLeave);
		window.addEventListener("drop", onDrop);
		return () => {
			window.removeEventListener("dragover", onDragOver);
			window.removeEventListener("dragleave", onDragLeave);
			window.removeEventListener("drop", onDrop);
		};
	}, [handleLoadWithConfirm]);

	// --- Keyboard shortcuts ---
	useEffect(() => {
		const isEditable = (el: EventTarget | null): boolean => {
			if (!(el instanceof HTMLElement)) return false;
			const tag = el.tagName.toLowerCase();
			return (
				tag === "input" ||
				tag === "textarea" ||
				tag === "select" ||
				el.isContentEditable
			);
		};

		const onKeyDown = (e: KeyboardEvent) => {
			const editable = isEditable(e.target);

			// Cmd/Ctrl+S — save (works everywhere, even mid-edit)
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				downloadJson(project);
				markClean();
				return;
			}

			// Cmd/Ctrl+O — load (trigger a hidden file picker)
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
				e.preventDefault();
				const input = document.createElement("input");
				input.type = "file";
				input.accept = ".json";
				input.onchange = async () => {
					const file = input.files?.[0];
					if (file) await handleLoadWithConfirm(file);
				};
				input.click();
				return;
			}

			// Escape — close help, deselect, leave the rest to dialogs.
			if (e.key === "Escape") {
				if (helpOpen) {
					setHelpOpen(false);
					return;
				}
				if (!editable && selectedItemId) {
					setSelectedItemId(null);
				}
				return;
			}

			// Shortcuts below must NOT fire while typing in a field.
			if (editable) return;

			// Backspace / Delete — remove selected task
			if ((e.key === "Backspace" || e.key === "Delete") && selectedItemId) {
				e.preventDefault();
				deleteWorkItem(selectedItemId);
				return;
			}

			// ? / Shift+/ — open help
			if (e.key === "?" || (e.shiftKey && e.key === "/")) {
				e.preventDefault();
				setHelpOpen(true);
				return;
			}

			// Bare letter shortcuts — skip if any modifier is held, or a
			// modal is open.
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (modalItemId || editingItemId) return;

			if (e.key === "d" || e.key === "D") {
				e.preventDefault();
				setViewMode("days");
				return;
			}
			if (e.key === "w" || e.key === "W") {
				e.preventDefault();
				setViewMode("weeks");
				return;
			}
			if (e.key === "n" || e.key === "N") {
				e.preventDefault();
				addWorkstream("New Workstream");
				return;
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		selectedItemId,
		setSelectedItemId,
		deleteWorkItem,
		setViewMode,
		addWorkstream,
		project,
		markClean,
		handleLoadWithConfirm,
		helpOpen,
		editingItemId,
		modalItemId,
	]);

	return (
		<div className="flex h-screen flex-col">
			<GanttToolbar
				chartRef={chartRef}
				onOpenHelp={() => setHelpOpen(true)}
				onOpenWhatsNew={() => setReleaseOpen(true)}
			/>
			<div className="relative flex flex-1 overflow-hidden">
				<div ref={chartRef} className="flex flex-1 overflow-hidden">
					<GanttSidebar />
					<div className="flex flex-1 flex-col overflow-hidden">
						<div className="flex flex-1 overflow-hidden">
							<GanttChart />
						</div>
						<LegendPanel />
					</div>
				</div>
				{selectedItemId && <ItemDetailPanel />}

				{/* Drop-target overlay — only visible while a file is being
				    dragged over the window. */}
				{dragOverActive && (
					<div
						data-no-export="true"
						className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-primary/5 backdrop-blur-[2px]"
					>
						<div className="rounded-xl border-2 border-dashed border-primary/60 bg-card/90 px-6 py-4 font-display text-sm font-semibold tracking-tight text-foreground shadow-lg">
							Drop to load project
						</div>
					</div>
				)}
			</div>
			<TaskModal />
			<HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
			<ReleaseNotesDialog
				open={releaseOpen}
				onOpenChange={handleReleaseOpenChange}
			/>
		</div>
	);
}

export default function GanttEditor() {
	const project = createProject("My Project");
	return (
		<GanttProvider initialProject={project}>
			<GanttEditorInner />
		</GanttProvider>
	);
}
