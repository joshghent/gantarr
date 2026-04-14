export interface LegendEntry {
	id: string;
	label: string;
	color: string;
}

export interface WorkItem {
	id: string;
	workstreamId: string;
	title: string;
	startDate: string; // ISO date string YYYY-MM-DD
	endDate: string; // ISO date string YYYY-MM-DD
	legendEntryId: string | null;
	order: number; // position within its workstream
	/**
	 * Explicit lane within the workstream (0 = first row). When set, the
	 * layout honors it instead of greedy-packing by date. Left undefined
	 * for legacy projects loaded from JSON so they keep packing.
	 */
	lane?: number;
}

export interface Dependency {
	id: string;
	fromItemId: string;
	toItemId: string;
}

export interface Workstream {
	id: string;
	label: string;
	order: number;
	color: string; // hex color used for the side band and default task color
}

export interface GanttProject {
	id: string;
	name: string;
	workstreams: Workstream[];
	workItems: WorkItem[];
	dependencies: Dependency[];
	legend: LegendEntry[];
	createdAt: string;
	updatedAt: string;
}

export type ViewMode = "days" | "weeks";
