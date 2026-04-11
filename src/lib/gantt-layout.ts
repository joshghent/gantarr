import type { GanttProject, WorkItem, Workstream } from "../types";

export interface TaskPosition {
	workItemId: string;
	workstreamId: string;
	rowIndex: number; // absolute row in the full chart
}

export interface WorkstreamBand {
	workstreamId: string;
	startRow: number;
	span: number; // number of rows this workstream occupies
}

export interface GanttLayout {
	/** Position of every task, keyed by item id for fast lookup */
	taskPositions: Map<string, TaskPosition>;
	bands: WorkstreamBand[];
	totalRows: number;
}

/**
 * Check if two tasks overlap in time (dates are YYYY-MM-DD strings).
 * We add a 1-day buffer so adjacent tasks don't look cramped.
 */
function tasksOverlap(a: WorkItem, b: WorkItem): boolean {
	return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/**
 * Build the row layout. Non-overlapping tasks within a workstream are
 * packed onto the same row (lane). Overlapping tasks get separate rows.
 * Empty workstreams get a single placeholder row.
 */
export function buildLayout(project: GanttProject): GanttLayout {
	const sortedWs = [...project.workstreams].sort((a, b) => a.order - b.order);
	const taskPositions = new Map<string, TaskPosition>();
	const bands: WorkstreamBand[] = [];

	let rowIndex = 0;

	for (const ws of sortedWs) {
		const tasks = project.workItems
			.filter((wi) => wi.workstreamId === ws.id)
			.sort((a, b) => {
				// Sort by start date first, then by end date
				if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
				return a.endDate < b.endDate ? -1 : 1;
			});

		const startRow = rowIndex;

		if (tasks.length === 0) {
			// Empty workstream — one placeholder row
			rowIndex++;
		} else {
			// Pack tasks into lanes. Each lane tracks which tasks it contains.
			const lanes: WorkItem[][] = [];

			for (const task of tasks) {
				// Find the first lane where this task doesn't overlap with any existing task
				let placed = false;
				for (let i = 0; i < lanes.length; i++) {
					const overlaps = lanes[i].some((t) => tasksOverlap(t, task));
					if (!overlaps) {
						lanes[i].push(task);
						taskPositions.set(task.id, {
							workItemId: task.id,
							workstreamId: ws.id,
							rowIndex: startRow + i,
						});
						placed = true;
						break;
					}
				}
				if (!placed) {
					// Need a new lane
					lanes.push([task]);
					taskPositions.set(task.id, {
						workItemId: task.id,
						workstreamId: ws.id,
						rowIndex: startRow + lanes.length - 1,
					});
				}
			}

			rowIndex += Math.max(lanes.length, 1);
		}

		bands.push({
			workstreamId: ws.id,
			startRow,
			span: rowIndex - startRow,
		});
	}

	return { taskPositions, bands, totalRows: rowIndex };
}

/** Look up the row index for a given task id */
export function getTaskRowIndex(layout: GanttLayout, itemId: string): number {
	const pos = layout.taskPositions.get(itemId);
	return pos ? pos.rowIndex : -1;
}

/** Find which workstream contains the given row index */
export function getWorkstreamAtRow(
	layout: GanttLayout,
	rowIndex: number,
): string | null {
	const band = layout.bands.find(
		(b) => rowIndex >= b.startRow && rowIndex < b.startRow + b.span,
	);
	return band?.workstreamId ?? null;
}

/** Get the effective color for a work item (legend overrides workstream) */
export function getItemColor(
	item: WorkItem,
	workstream: Workstream | undefined,
	project: GanttProject,
): string {
	if (item.legendEntryId) {
		const legend = project.legend.find((le) => le.id === item.legendEntryId);
		if (legend) return legend.color;
	}
	return workstream?.color ?? "#94a3b8";
}
