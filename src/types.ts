export interface LegendEntry {
	id: string;
	label: string;
	color: string;
	/**
	 * Whether tasks in this category show in the Workstreams view. Unset
	 * falls back to the label: development categories show, everything
	 * else doesn't.
	 */
	showInWorkstreams?: boolean;
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
	/**
	 * Name of the headline project this task belongs to. Tasks sharing a
	 * group (within a workstream) roll up into one bar in the Projects and
	 * Workstreams views, and the group is what you drill into.
	 */
	group?: string;
	/** Engineers this task occupies, counted against the team's capacity. */
	people?: number;
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

export interface SprintSettings {
	/** Sprint length in weeks. */
	lengthWeeks: number;
	/**
	 * First day of the roadmap and of its first sprint, YYYY-MM-DD. The
	 * timeline starts here unless a task starts earlier.
	 */
	startDate: string;
	/** Number of the sprint starting on `startDate`. Defaults to 1. */
	firstNumber?: number;
}

export interface GanttProject {
	id: string;
	name: string;
	workstreams: Workstream[];
	workItems: WorkItem[];
	dependencies: Dependency[];
	legend: LegendEntry[];
	sprints?: SprintSettings;
	/** Engineers available at once. Unset turns capacity tracking off. */
	teamSize?: number;
	createdAt: string;
	updatedAt: string;
}

export type ViewMode = "days" | "weeks" | "sprints";

/**
 * How much detail the chart shows: every task, one bar per headline
 * project, or one bar per stretch of key work in each workstream.
 */
export type ViewLevel = "detail" | "projects" | "workstreams";
