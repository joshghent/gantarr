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
 * Build the row layout.
 *
 * Tasks can carry an explicit `lane` (0 = first row within the
 * workstream). Those are placed at exactly that lane, so double-clicks
 * and drags feel deterministic — the bar lands where the user put it,
 * not wherever the greedy packer wants it.
 *
 * Tasks without an explicit lane fall back to the original greedy
 * lane-packing so legacy/imported projects keep working. Explicit-lane
 * tasks are placed first so packers can honor their reservation.
 *
 * Empty workstreams get a single placeholder row.
 */
export function buildLayout(project: GanttProject): GanttLayout {
	const sortedWs = [...project.workstreams].sort((a, b) => a.order - b.order);
	const taskPositions = new Map<string, TaskPosition>();
	const bands: WorkstreamBand[] = [];

	let rowIndex = 0;

	for (const ws of sortedWs) {
		const wsTasks = project.workItems.filter((wi) => wi.workstreamId === ws.id);

		const startRow = rowIndex;

		if (wsTasks.length === 0) {
			rowIndex++;
		} else {
			const lanes: WorkItem[][] = [];

			// Pass 1 — reserve explicit lanes, sorted by (lane, startDate)
			// so deterministic order within each lane.
			const explicit = wsTasks
				.filter((t) => t.lane !== undefined)
				.sort((a, b) => {
					const la = a.lane ?? 0;
					const lb = b.lane ?? 0;
					if (la !== lb) return la - lb;
					if (a.startDate !== b.startDate)
						return a.startDate < b.startDate ? -1 : 1;
					return a.endDate < b.endDate ? -1 : 1;
				});

			for (const task of explicit) {
				const lane = task.lane ?? 0;
				while (lanes.length <= lane) lanes.push([]);
				lanes[lane].push(task);
				taskPositions.set(task.id, {
					workItemId: task.id,
					workstreamId: ws.id,
					rowIndex: startRow + lane,
				});
			}

			// Pass 2 — greedy-pack the rest by start date, avoiding lanes
			// that already overlap in time (including the explicit ones).
			const implicit = wsTasks
				.filter((t) => t.lane === undefined)
				.sort((a, b) => {
					if (a.startDate !== b.startDate)
						return a.startDate < b.startDate ? -1 : 1;
					return a.endDate < b.endDate ? -1 : 1;
				});

			for (const task of implicit) {
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
