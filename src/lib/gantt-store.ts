import { v4 as uuid } from "uuid";
import type {
	Dependency,
	GanttProject,
	LegendEntry,
	WorkItem,
	Workstream,
} from "../types";
import { formatDate, today } from "./dates";

// Palette used to assign colors to new workstreams (cycles through)
const WORKSTREAM_PALETTE = [
	"#e76f51", // red-orange
	"#f4a261", // orange
	"#e9c46a", // yellow
	"#2a9d8f", // teal
	"#264653", // dark blue
	"#8ecae6", // sky blue
	"#a78bfa", // purple
	"#f472b6", // pink
];

const DEFAULT_LEGEND = [
	{ label: "Development", color: "#3b82f6" },
	{ label: "Design", color: "#8b5cf6" },
	{ label: "Marketing", color: "#f97316" },
	{ label: "Business Change", color: "#22c55e" },
	{ label: "QA", color: "#ef4444" },
];

function nextWorkstreamColor(project: GanttProject): string {
	return WORKSTREAM_PALETTE[
		project.workstreams.length % WORKSTREAM_PALETTE.length
	];
}

export function createProject(name: string): GanttProject {
	const legend: LegendEntry[] = DEFAULT_LEGEND.map((c) => ({
		id: uuid(),
		label: c.label,
		color: c.color,
	}));

	const wsId = uuid();
	const ws: Workstream = {
		id: wsId,
		label: "Phase 1",
		order: 0,
		color: WORKSTREAM_PALETTE[0],
	};

	const start = today();
	const end = formatDate(
		new Date(new Date(start).getTime() + 6 * 24 * 60 * 60 * 1000),
	);

	const item: WorkItem = {
		id: uuid(),
		workstreamId: wsId,
		title: "First task",
		startDate: start,
		endDate: end,
		legendEntryId: null,
		order: 0,
	};

	return {
		id: uuid(),
		name,
		workstreams: [ws],
		workItems: [item],
		dependencies: [],
		legend,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

export function addWorkstream(
	project: GanttProject,
	label: string,
): GanttProject {
	const workstream: Workstream = {
		id: uuid(),
		label,
		order: project.workstreams.length,
		color: nextWorkstreamColor(project),
	};
	return {
		...project,
		workstreams: [...project.workstreams, workstream],
		updatedAt: new Date().toISOString(),
	};
}

export function updateWorkstream(
	project: GanttProject,
	id: string,
	updates: Partial<Omit<Workstream, "id">>,
): GanttProject {
	return {
		...project,
		workstreams: project.workstreams.map((ws) =>
			ws.id === id ? { ...ws, ...updates } : ws,
		),
		updatedAt: new Date().toISOString(),
	};
}

export function deleteWorkstream(
	project: GanttProject,
	id: string,
): GanttProject {
	const itemIds = project.workItems
		.filter((wi) => wi.workstreamId === id)
		.map((wi) => wi.id);
	return {
		...project,
		workstreams: project.workstreams
			.filter((ws) => ws.id !== id)
			.map((ws, i) => ({ ...ws, order: i })),
		workItems: project.workItems.filter((wi) => wi.workstreamId !== id),
		dependencies: project.dependencies.filter(
			(d) => !itemIds.includes(d.fromItemId) && !itemIds.includes(d.toItemId),
		),
		updatedAt: new Date().toISOString(),
	};
}

export function reorderWorkstreams(
	project: GanttProject,
	workstreams: Workstream[],
): GanttProject {
	return {
		...project,
		workstreams: workstreams.map((ws, i) => ({ ...ws, order: i })),
		updatedAt: new Date().toISOString(),
	};
}

export function addWorkItem(
	project: GanttProject,
	workstreamId: string,
	title: string,
	startDate?: string,
	endDate?: string,
	legendEntryId?: string,
): GanttProject {
	const start = startDate || today();
	const end =
		endDate ||
		formatDate(
			new Date(new Date(start).getTime() + 4 * 24 * 60 * 60 * 1000),
		);

	// Compute next order for this workstream
	const existingInWs = project.workItems.filter(
		(wi) => wi.workstreamId === workstreamId,
	);
	const order = existingInWs.length;

	const item: WorkItem = {
		id: uuid(),
		workstreamId,
		title,
		startDate: start,
		endDate: end,
		legendEntryId: legendEntryId || null,
		order,
	};
	return {
		...project,
		workItems: [...project.workItems, item],
		updatedAt: new Date().toISOString(),
	};
}

export function updateWorkItem(
	project: GanttProject,
	id: string,
	updates: Partial<Omit<WorkItem, "id">>,
): GanttProject {
	return {
		...project,
		workItems: project.workItems.map((wi) =>
			wi.id === id ? { ...wi, ...updates } : wi,
		),
		updatedAt: new Date().toISOString(),
	};
}

/** Move a work item to a different workstream, appending to the end */
export function moveWorkItemToWorkstream(
	project: GanttProject,
	itemId: string,
	newWorkstreamId: string,
): GanttProject {
	const item = project.workItems.find((wi) => wi.id === itemId);
	if (!item || item.workstreamId === newWorkstreamId) return project;

	const newOrder = project.workItems.filter(
		(wi) => wi.workstreamId === newWorkstreamId,
	).length;

	return {
		...project,
		workItems: project.workItems.map((wi) =>
			wi.id === itemId
				? { ...wi, workstreamId: newWorkstreamId, order: newOrder }
				: wi,
		),
		updatedAt: new Date().toISOString(),
	};
}

export function deleteWorkItem(
	project: GanttProject,
	id: string,
): GanttProject {
	return {
		...project,
		workItems: project.workItems.filter((wi) => wi.id !== id),
		dependencies: project.dependencies.filter(
			(d) => d.fromItemId !== id && d.toItemId !== id,
		),
		updatedAt: new Date().toISOString(),
	};
}

export function addDependency(
	project: GanttProject,
	fromItemId: string,
	toItemId: string,
): GanttProject {
	if (
		project.dependencies.some(
			(d) => d.fromItemId === fromItemId && d.toItemId === toItemId,
		)
	) {
		return project;
	}
	const dep: Dependency = { id: uuid(), fromItemId, toItemId };
	return {
		...project,
		dependencies: [...project.dependencies, dep],
		updatedAt: new Date().toISOString(),
	};
}

export function deleteDependency(
	project: GanttProject,
	id: string,
): GanttProject {
	return {
		...project,
		dependencies: project.dependencies.filter((d) => d.id !== id),
		updatedAt: new Date().toISOString(),
	};
}

export function addLegendEntry(
	project: GanttProject,
	label: string,
	color: string,
): GanttProject {
	const entry: LegendEntry = { id: uuid(), label, color };
	return {
		...project,
		legend: [...project.legend, entry],
		updatedAt: new Date().toISOString(),
	};
}

export function updateLegendEntry(
	project: GanttProject,
	id: string,
	updates: Partial<Omit<LegendEntry, "id">>,
): GanttProject {
	return {
		...project,
		legend: project.legend.map((le) =>
			le.id === id ? { ...le, ...updates } : le,
		),
		updatedAt: new Date().toISOString(),
	};
}

export function deleteLegendEntry(
	project: GanttProject,
	id: string,
): GanttProject {
	return {
		...project,
		legend: project.legend.filter((le) => le.id !== id),
		workItems: project.workItems.map((wi) =>
			wi.legendEntryId === id ? { ...wi, legendEntryId: null } : wi,
		),
		updatedAt: new Date().toISOString(),
	};
}
