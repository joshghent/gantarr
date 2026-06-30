import { v4 as uuid } from "uuid";
import { z } from "zod";
import type {
	Dependency,
	GanttProject,
	LegendEntry,
	WorkItem,
	Workstream,
} from "../types";
import { DEFAULT_LEGEND, WORKSTREAM_PALETTE } from "./gantt-store";

// ---------------------------------------------------------------------------
// Full GanttProject validation
//
// `parseProject` is the trust boundary for any project that did not originate
// in-process: imported `?import=` links, dropped JSON files, and full-JSON
// payloads handed to the MCP server. It mirrors the `GanttProject` shape in
// types.ts. We only enforce the date *format* here (YYYY-MM-DD) — ordering
// rules belong to construction (`buildProject`), not to accepting existing
// data, so that previously-saved files keep loading.
// ---------------------------------------------------------------------------

const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

const legendEntrySchema = z.object({
	id: z.string(),
	label: z.string(),
	color: z.string(),
});

const workstreamSchema = z.object({
	id: z.string(),
	label: z.string(),
	order: z.number(),
	color: z.string(),
});

const workItemSchema = z.object({
	id: z.string(),
	workstreamId: z.string(),
	title: z.string(),
	startDate: isoDate,
	endDate: isoDate,
	legendEntryId: z.string().nullable(),
	order: z.number(),
	lane: z.number().optional(),
});

const dependencySchema = z.object({
	id: z.string(),
	fromItemId: z.string(),
	toItemId: z.string(),
});

export const ganttProjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	workstreams: z.array(workstreamSchema),
	workItems: z.array(workItemSchema),
	dependencies: z.array(dependencySchema),
	legend: z.array(legendEntrySchema),
	createdAt: z.string(),
	updatedAt: z.string(),
});

/** Validate untrusted data into a `GanttProject`. Throws (ZodError) on failure. */
export function parseProject(data: unknown): GanttProject {
	return ganttProjectSchema.parse(data) as GanttProject;
}

// ---------------------------------------------------------------------------
// AI-facing "chart input"
//
// A deliberately flatter, friendlier shape than the wire format: an AI lists
// workstreams each containing tasks, references legend categories by `type`
// label, and links tasks by `title`. `buildProject` expands that into a full
// GanttProject (uuids, ordering, id resolution, defaults).
// ---------------------------------------------------------------------------

const taskInputSchema = z.object({
	title: z.string().min(1),
	start: isoDate,
	end: isoDate,
	type: z.string().optional(),
	lane: z.number().int().nonnegative().optional(),
});

const workstreamInputSchema = z.object({
	label: z.string().min(1),
	color: z.string().optional(),
	tasks: z.array(taskInputSchema),
});

export const chartInputSchema = z.object({
	name: z.string().min(1),
	workstreams: z.array(workstreamInputSchema).min(1),
	legend: z
		.array(z.object({ label: z.string().min(1), color: z.string() }))
		.optional(),
	dependencies: z
		.array(z.object({ from: z.string(), to: z.string() }))
		.optional(),
});

export type ChartInput = z.infer<typeof chartInputSchema>;

// Colors for legend entries the AI references but doesn't define. Reuses the
// app's default legend palette so auto-created categories look native.
const LEGEND_PALETTE = DEFAULT_LEGEND.map((l) => l.color);

/** Expand an AI-friendly `ChartInput` into a complete, valid `GanttProject`. */
export function buildProject(rawInput: ChartInput): GanttProject {
	const input = chartInputSchema.parse(rawInput);
	const now = new Date().toISOString();

	// Legend: explicit entries first, then any `type` referenced by a task but
	// not declared gets auto-created so no work item silently loses its color.
	const legend: LegendEntry[] = (input.legend ?? []).map((e) => ({
		id: uuid(),
		label: e.label,
		color: e.color,
	}));
	const legendByLabel = new Map<string, LegendEntry>();
	for (const e of legend) legendByLabel.set(e.label.toLowerCase(), e);

	const resolveLegend = (type?: string): string | null => {
		if (!type) return null;
		const key = type.toLowerCase();
		let entry = legendByLabel.get(key);
		if (!entry) {
			entry = {
				id: uuid(),
				label: type,
				color: LEGEND_PALETTE[legend.length % LEGEND_PALETTE.length],
			};
			legend.push(entry);
			legendByLabel.set(key, entry);
		}
		return entry.id;
	};

	const workstreams: Workstream[] = [];
	const workItems: WorkItem[] = [];
	// First task with a given title wins as a dependency target.
	const itemIdByTitle = new Map<string, string>();

	input.workstreams.forEach((ws, wsIndex) => {
		const wsId = uuid();
		workstreams.push({
			id: wsId,
			label: ws.label,
			order: wsIndex,
			color:
				ws.color ?? WORKSTREAM_PALETTE[wsIndex % WORKSTREAM_PALETTE.length],
		});

		ws.tasks.forEach((task, taskIndex) => {
			if (task.end < task.start) {
				throw new Error(
					`Task "${task.title}" ends (${task.end}) before it starts (${task.start})`,
				);
			}
			const id = uuid();
			workItems.push({
				id,
				workstreamId: wsId,
				title: task.title,
				startDate: task.start,
				endDate: task.end,
				legendEntryId: resolveLegend(task.type),
				order: taskIndex,
				...(task.lane !== undefined ? { lane: task.lane } : {}),
			});
			if (!itemIdByTitle.has(task.title)) itemIdByTitle.set(task.title, id);
		});
	});

	const dependencies: Dependency[] = (input.dependencies ?? []).map((dep) => {
		const fromItemId = itemIdByTitle.get(dep.from);
		const toItemId = itemIdByTitle.get(dep.to);
		if (!fromItemId)
			throw new Error(`Dependency references unknown task: "${dep.from}"`);
		if (!toItemId)
			throw new Error(`Dependency references unknown task: "${dep.to}"`);
		return { id: uuid(), fromItemId, toItemId };
	});

	return {
		id: uuid(),
		name: input.name,
		workstreams,
		workItems,
		dependencies,
		legend,
		createdAt: now,
		updatedAt: now,
	};
}
