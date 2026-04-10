import type { GanttProject, WorkItem, Workstream } from "../types";

export interface LayoutRow {
	workstreamId: string;
	workItemId: string | null; // null = empty placeholder row
	rowIndex: number;
}

export interface WorkstreamBand {
	workstreamId: string;
	startRow: number;
	span: number; // number of rows
}

export interface GanttLayout {
	rows: LayoutRow[];
	bands: WorkstreamBand[];
	totalRows: number;
}

/**
 * Build the row layout for a project. Each task gets its own row, grouped
 * by workstream. Empty workstreams get a single placeholder row so they
 * remain visible and can receive new tasks.
 */
export function buildLayout(project: GanttProject): GanttLayout {
	const sortedWs = [...project.workstreams].sort((a, b) => a.order - b.order);
	const rows: LayoutRow[] = [];
	const bands: WorkstreamBand[] = [];

	let rowIndex = 0;
	for (const ws of sortedWs) {
		const tasks = project.workItems
			.filter((wi) => wi.workstreamId === ws.id)
			.sort((a, b) => a.order - b.order);

		const startRow = rowIndex;

		if (tasks.length === 0) {
			rows.push({ workstreamId: ws.id, workItemId: null, rowIndex });
			rowIndex++;
		} else {
			for (const task of tasks) {
				rows.push({
					workstreamId: ws.id,
					workItemId: task.id,
					rowIndex,
				});
				rowIndex++;
			}
		}

		bands.push({
			workstreamId: ws.id,
			startRow,
			span: rowIndex - startRow,
		});
	}

	return { rows, bands, totalRows: rowIndex };
}

/** Look up the row index for a given task id */
export function getTaskRowIndex(layout: GanttLayout, itemId: string): number {
	const row = layout.rows.find((r) => r.workItemId === itemId);
	return row ? row.rowIndex : -1;
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
