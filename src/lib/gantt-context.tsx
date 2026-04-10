import {
	createContext,
	useCallback,
	useContext,
	useState,
	type ReactNode,
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
	) => void;
	updateWorkItem: (id: string, updates: Partial<Omit<WorkItem, "id">>) => void;
	moveWorkItemToWorkstream: (itemId: string, newWorkstreamId: string) => void;
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
}

const GanttContext = createContext<GanttContextValue | null>(null);

export function GanttProvider({
	initialProject,
	children,
}: {
	initialProject: GanttProject;
	children: ReactNode;
}) {
	const [project, setProjectState] = useState<GanttProject>(initialProject);
	const [viewMode, setViewMode] = useState<ViewMode>("days");
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [modalItemId, setModalItemId] = useState<string | null>(null);

	const setProject = useCallback((p: GanttProject) => {
		setProjectState(p);
	}, []);

	const addWorkstream = useCallback((label: string) => {
		setProjectState((p) => store.addWorkstream(p, label));
	}, []);

	const updateWorkstream = useCallback(
		(id: string, updates: Partial<Omit<Workstream, "id">>) => {
			setProjectState((p) => store.updateWorkstream(p, id, updates));
		},
		[],
	);

	const deleteWorkstream = useCallback((id: string) => {
		setProjectState((p) => store.deleteWorkstream(p, id));
	}, []);

	const addWorkItem = useCallback(
		(
			workstreamId: string,
			title: string,
			startDate?: string,
			endDate?: string,
			legendEntryId?: string,
		) => {
			setProjectState((p) =>
				store.addWorkItem(
					p,
					workstreamId,
					title,
					startDate,
					endDate,
					legendEntryId,
				),
			);
		},
		[],
	);

	const updateWorkItem = useCallback(
		(id: string, updates: Partial<Omit<WorkItem, "id">>) => {
			setProjectState((p) => store.updateWorkItem(p, id, updates));
		},
		[],
	);

	const moveWorkItemToWorkstream = useCallback(
		(itemId: string, newWorkstreamId: string) => {
			setProjectState((p) =>
				store.moveWorkItemToWorkstream(p, itemId, newWorkstreamId),
			);
		},
		[],
	);

	const deleteWorkItem = useCallback((id: string) => {
		setProjectState((p) => store.deleteWorkItem(p, id));
		setSelectedItemId(null);
		setModalItemId(null);
	}, []);

	const addDependency = useCallback(
		(fromItemId: string, toItemId: string) => {
			setProjectState((p) => store.addDependency(p, fromItemId, toItemId));
		},
		[],
	);

	const deleteDependency = useCallback((id: string) => {
		setProjectState((p) => store.deleteDependency(p, id));
	}, []);

	const addLegendEntry = useCallback((label: string, color: string) => {
		setProjectState((p) => store.addLegendEntry(p, label, color));
	}, []);

	const updateLegendEntry = useCallback(
		(id: string, updates: Partial<Omit<LegendEntry, "id">>) => {
			setProjectState((p) => store.updateLegendEntry(p, id, updates));
		},
		[],
	);

	const deleteLegendEntry = useCallback((id: string) => {
		setProjectState((p) => store.deleteLegendEntry(p, id));
	}, []);

	return (
		<GanttContext.Provider
			value={{
				project,
				viewMode,
				setViewMode,
				setProject,
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
