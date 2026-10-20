import {
	createContext,
	type MutableRefObject,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type {
	GanttProject,
	LegendEntry,
	ViewMode,
	WorkItem,
	Workstream,
} from "../types";
import * as store from "./gantt-store";

interface GanttContextValue {
	project: GanttProject;
	viewMode: ViewMode;
	setViewMode: (mode: ViewMode) => void;
	setProject: (project: GanttProject) => void;

	// Unsaved-changes tracking
	isDirty: boolean;
	markClean: () => void;

	// Undo / redo history of project edits
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;

	// Workstream operations
	addWorkstream: (label: string) => void;
	updateWorkstream: (
		id: string,
		updates: Partial<Omit<Workstream, "id">>,
	) => void;
	deleteWorkstream: (id: string) => void;

	// Work item operations
	addWorkItem: (
		workstreamId: string,
		title: string,
		startDate?: string,
		endDate?: string,
		legendEntryId?: string,
		lane?: number,
	) => void;
	updateWorkItem: (id: string, updates: Partial<Omit<WorkItem, "id">>) => void;
	moveWorkItemToWorkstream: (
		itemId: string,
		newWorkstreamId: string,
		lane?: number,
	) => void;
	deleteWorkItem: (id: string) => void;

	// Dependency operations
	addDependency: (fromItemId: string, toItemId: string) => void;
	deleteDependency: (id: string) => void;

	// Legend operations
	addLegendEntry: (label: string, color: string) => void;
	updateLegendEntry: (
		id: string,
		updates: Partial<Omit<LegendEntry, "id">>,
	) => void;
	deleteLegendEntry: (id: string) => void;

	// UI state
	selectedItemId: string | null;
	setSelectedItemId: (id: string | null) => void;
	connectingFrom: string | null;
	setConnectingFrom: (id: string | null) => void;
	editingItemId: string | null;
	setEditingItemId: (id: string | null) => void;
	modalItemId: string | null;
	setModalItemId: (id: string | null) => void;

	// Leftmost date currently visible in the chart viewport. Kept in a ref
	// (updated on scroll by GanttChart) so reading it doesn't force a
	// re-render on every scroll frame. Used to place new tasks near where
	// the user is looking rather than always at today.
	viewportDateRef: MutableRefObject<string | null>;
}

const MAX_HISTORY = 100;

const GanttContext = createContext<GanttContextValue | null>(null);

export function GanttProvider({
	initialProject,
	children,
}: {
	initialProject: GanttProject;
	children: ReactNode;
}) {
	const [project, setProjectState] = useState<GanttProject>(initialProject);
	// Mirror of `project` readable synchronously so history snapshots are
	// exact even when several mutations land in the same event.
	const projectRef = useRef<GanttProject>(initialProject);
	const pastRef = useRef<GanttProject[]>([]);
	const futureRef = useRef<GanttProject[]>([]);
	const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
	const [viewMode, setViewMode] = useState<ViewMode>("days");
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [modalItemId, setModalItemId] = useState<string | null>(null);
	const viewportDateRef = useRef<string | null>(null);

	// Dirty tracking — the default project that ships on first load stays
	// "clean" because we never call any mutator on it. Only explicit user
	// actions (CRUD operations, rename, reorder) flip this to true.
	const [isDirty, setIsDirty] = useState(false);

	const syncHistorySize = useCallback(() => {
		setHistorySize({
			past: pastRef.current.length,
			future: futureRef.current.length,
		});
	}, []);

	// Replace the project and record the previous one for undo.
	const commit = useCallback(
		(next: GanttProject) => {
			const prev = projectRef.current;
			if (next === prev) return;
			pastRef.current.push(prev);
			if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
			futureRef.current = [];
			projectRef.current = next;
			setProjectState(next);
			setIsDirty(true);
			syncHistorySize();
		},
		[syncHistorySize],
	);

	// Internal helper: every store mutation routes through here so we
	// don't have to remember to flip isDirty or record history in every
	// callback.
	const mutate = useCallback(
		(updater: (p: GanttProject) => GanttProject) => {
			commit(updater(projectRef.current));
		},
		[commit],
	);

	// Whole-project replacement used for mutations that aren't a simple
	// single-field edit (e.g. drag-to-reorder in the sidebar, rename in
	// the toolbar). Also marks dirty — the only way to *reset* dirty is
	// to call markClean() explicitly after save or load.
	const setProject = commit;

	const undo = useCallback(() => {
		const prev = pastRef.current.pop();
		if (!prev) return;
		futureRef.current.push(projectRef.current);
		projectRef.current = prev;
		setProjectState(prev);
		setIsDirty(true);
		syncHistorySize();
	}, [syncHistorySize]);

	const redo = useCallback(() => {
		const next = futureRef.current.pop();
		if (!next) return;
		pastRef.current.push(projectRef.current);
		projectRef.current = next;
		setProjectState(next);
		setIsDirty(true);
		syncHistorySize();
	}, [syncHistorySize]);

	const markClean = useCallback(() => {
		setIsDirty(false);
	}, []);

	const addWorkstream = useCallback(
		(label: string) => {
			mutate((p) => store.addWorkstream(p, label));
		},
		[mutate],
	);

	const updateWorkstream = useCallback(
		(id: string, updates: Partial<Omit<Workstream, "id">>) => {
			mutate((p) => store.updateWorkstream(p, id, updates));
		},
		[mutate],
	);

	const deleteWorkstream = useCallback(
		(id: string) => {
			mutate((p) => store.deleteWorkstream(p, id));
		},
		[mutate],
	);

	const addWorkItem = useCallback(
		(
			workstreamId: string,
			title: string,
			startDate?: string,
			endDate?: string,
			legendEntryId?: string,
			lane?: number,
		) => {
			mutate((p) =>
				store.addWorkItem(
					p,
					workstreamId,
					title,
					startDate,
					endDate,
					legendEntryId,
					lane,
				),
			);
		},
		[mutate],
	);

	const updateWorkItem = useCallback(
		(id: string, updates: Partial<Omit<WorkItem, "id">>) => {
			mutate((p) => store.updateWorkItem(p, id, updates));
		},
		[mutate],
	);

	const moveWorkItemToWorkstream = useCallback(
		(itemId: string, newWorkstreamId: string, lane?: number) => {
			mutate((p) =>
				store.moveWorkItemToWorkstream(p, itemId, newWorkstreamId, lane),
			);
		},
		[mutate],
	);

	const deleteWorkItem = useCallback(
		(id: string) => {
			mutate((p) => store.deleteWorkItem(p, id));
			setSelectedItemId(null);
			setModalItemId(null);
		},
		[mutate],
	);

	const addDependency = useCallback(
		(fromItemId: string, toItemId: string) => {
			mutate((p) => store.addDependency(p, fromItemId, toItemId));
		},
		[mutate],
	);

	const deleteDependency = useCallback(
		(id: string) => {
			mutate((p) => store.deleteDependency(p, id));
		},
		[mutate],
	);

	const addLegendEntry = useCallback(
		(label: string, color: string) => {
			mutate((p) => store.addLegendEntry(p, label, color));
		},
		[mutate],
	);

	const updateLegendEntry = useCallback(
		(id: string, updates: Partial<Omit<LegendEntry, "id">>) => {
			mutate((p) => store.updateLegendEntry(p, id, updates));
		},
		[mutate],
	);

	const deleteLegendEntry = useCallback(
		(id: string) => {
			mutate((p) => store.deleteLegendEntry(p, id));
		},
		[mutate],
	);

	// Browser-level unsaved-changes guard. Only attached while the
	// project is actually dirty so a clean session never nags.
	// Modern browsers ignore the custom message and show a generic
	// "Leave site?" prompt — setting returnValue is required in
	// Chrome/Edge, returning the string is the legacy Firefox path.
	useEffect(() => {
		if (!isDirty) return;
		const handler = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = "";
			return "";
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [isDirty]);

	return (
		<GanttContext.Provider
			value={{
				project,
				viewMode,
				setViewMode,
				setProject,
				isDirty,
				markClean,
				undo,
				redo,
				canUndo: historySize.past > 0,
				canRedo: historySize.future > 0,
				addWorkstream,
				updateWorkstream,
				deleteWorkstream,
				addWorkItem,
				updateWorkItem,
				moveWorkItemToWorkstream,
				deleteWorkItem,
				addDependency,
				deleteDependency,
				addLegendEntry,
				updateLegendEntry,
				deleteLegendEntry,
				selectedItemId,
				setSelectedItemId,
				connectingFrom,
				setConnectingFrom,
				editingItemId,
				setEditingItemId,
				modalItemId,
				setModalItemId,
				viewportDateRef,
			}}
		>
			{children}
		</GanttContext.Provider>
	);
}

export function useGantt(): GanttContextValue {
	const ctx = useContext(GanttContext);
	if (!ctx) throw new Error("useGantt must be used within GanttProvider");
	return ctx;
}
