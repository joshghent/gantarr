import type { Dependency, GanttProject, ViewLevel, WorkItem } from "../types";
import { addDays, formatDate, parseDate } from "./dates";

/**
 * Roll-up views. The chart can show a project at three levels of detail:
 *
 * - detail:      every task, as edited.
 * - projects:    one bar per headline project (tasks sharing a `group`
 *                within a workstream), spanning its tasks. Tasks with no
 *                group stay as they are.
 * - workstreams: one bar per continuous stretch of work in a workstream,
 *                labelled with the projects in it. Gaps stay visible.
 *
 * Each level is expressed as an ordinary GanttProject so the existing
 * layout, sidebar and arrow code render it unchanged. Rolled-up bars get
 * synthetic ids (see ROLLUP_PREFIX) and dependencies are re-pointed at
 * the bars that now contain their tasks.
 */

export const ROLLUP_PREFIX = "rollup:";

export function isRollupId(id: string): boolean {
	return id.startsWith(ROLLUP_PREFIX);
}

/**
 * Two stretches of work closer than this many calendar days merge into
 * one workstream bar — enough to bridge a weekend, not a real gap.
 */
const MERGE_GAP_DAYS = 3;

/** Most project names a workstream bar lists before summarising the rest. */
const MAX_SEGMENT_NAMES = 3;

/** Every distinct project name in use, sorted, for autocomplete. */
export function listGroups(project: GanttProject): string[] {
	const groups = new Set<string>();
	for (const item of project.workItems) if (item.group) groups.add(item.group);
	return [...groups].sort((a, b) => a.localeCompare(b));
}

/** The legend entry shared by every item, or null when they differ. */
function commonLegend(items: WorkItem[]): string | null {
	const first = items[0]?.legendEntryId ?? null;
	return items.every((i) => i.legendEntryId === first) ? first : null;
}

function span(items: WorkItem[]): { startDate: string; endDate: string } {
	let startDate = items[0].startDate;
	let endDate = items[0].endDate;
	for (const i of items) {
		if (i.startDate < startDate) startDate = i.startDate;
		if (i.endDate > endDate) endDate = i.endDate;
	}
	return { startDate, endDate };
}

/** Strip a task's explicit lane so rolled-up rows pack from scratch. */
function unlaned(item: WorkItem): WorkItem {
	const { lane: _lane, ...rest } = item;
	return rest;
}

/**
 * Re-point dependencies at the display bars containing their tasks. A
 * summary arrow is only drawn when it shows real sequencing — the source
 * bar finishes before the target starts. Arrows inside one bar, between
 * overlapping bars (which would point backwards) and duplicates go.
 */
function rollupDependencies(
	deps: Dependency[],
	bars: WorkItem[],
	barOf: Map<string, string>,
): Dependency[] {
	const byId = new Map(bars.map((b) => [b.id, b]));
	const seen = new Set<string>();
	const out: Dependency[] = [];
	for (const dep of deps) {
		const from = barOf.get(dep.fromItemId);
		const to = barOf.get(dep.toItemId);
		if (!from || !to || from === to) continue;
		const fromBar = byId.get(from);
		const toBar = byId.get(to);
		if (!fromBar || !toBar || fromBar.endDate >= toBar.startDate) continue;
		const key = `${from}>${to}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			id: `${ROLLUP_PREFIX}dep:${key}`,
			fromItemId: from,
			toItemId: to,
		});
	}
	return out;
}

/** One bar per project in each workstream; ungrouped tasks pass through. */
function projectBars(project: GanttProject): {
	items: WorkItem[];
	barOf: Map<string, string>;
} {
	const items: WorkItem[] = [];
	const barOf = new Map<string, string>();
	for (const ws of project.workstreams) {
		const wsItems = project.workItems.filter((i) => i.workstreamId === ws.id);
		const groups = new Map<string, WorkItem[]>();
		for (const item of wsItems) {
			if (!item.group) {
				items.push(unlaned(item));
				barOf.set(item.id, item.id);
				continue;
			}
			const members = groups.get(item.group);
			if (members) members.push(item);
			else groups.set(item.group, [item]);
		}
		for (const [group, members] of groups) {
			const id = `${ROLLUP_PREFIX}project:${ws.id}:${group}`;
			items.push({
				id,
				workstreamId: ws.id,
				title: group,
				...span(members),
				legendEntryId: commonLegend(members),
				order: items.length,
				group,
			});
			for (const m of members) barOf.set(m.id, id);
		}
	}
	return { items, barOf };
}

/** Merge each workstream's project bars into continuous stretches. */
function workstreamBars(project: GanttProject): {
	items: WorkItem[];
	barOf: Map<string, string>;
} {
	const projects = projectBars(project);
	const items: WorkItem[] = [];
	const segmentOf = new Map<string, string>();

	for (const ws of project.workstreams) {
		const bars = projects.items
			.filter((i) => i.workstreamId === ws.id)
			.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
		let current: WorkItem[] = [];
		const flush = () => {
			if (current.length === 0) return;
			const id = `${ROLLUP_PREFIX}stream:${ws.id}:${items.length}`;
			const names = [...new Set(current.map((b) => b.title))];
			const title =
				names.length > MAX_SEGMENT_NAMES
					? `${names.slice(0, MAX_SEGMENT_NAMES).join(" · ")} +${names.length - MAX_SEGMENT_NAMES}`
					: names.join(" · ");
			items.push({
				id,
				workstreamId: ws.id,
				title,
				...span(current),
				legendEntryId: commonLegend(current),
				order: items.length,
			});
			for (const b of current) segmentOf.set(b.id, id);
			current = [];
		};
		let reach = "";
		for (const bar of bars) {
			if (current.length > 0) {
				const bridged = formatDate(addDays(parseDate(reach), MERGE_GAP_DAYS));
				if (bar.startDate > bridged) flush();
			}
			if (current.length === 0 || bar.endDate > reach) reach = bar.endDate;
			current.push(bar);
		}
		flush();
	}

	const barOf = new Map<string, string>();
	for (const [taskId, projectBar] of projects.barOf) {
		const segment = segmentOf.get(projectBar);
		if (segment) barOf.set(taskId, segment);
	}
	return { items, barOf };
}

/**
 * The project as the chart should draw it at `level`. With `focusGroup`
 * set, the detail level shows only that project's tasks — the drill-down
 * sub-roadmap. Detail with no focus returns the project itself, so
 * memoised consumers see no change.
 */
export function buildDisplayProject(
	project: GanttProject,
	level: ViewLevel,
	focusGroup: string | null = null,
): GanttProject {
	if (level === "detail") {
		if (focusGroup === null) return project;
		const workItems = project.workItems.filter((i) => i.group === focusGroup);
		const ids = new Set(workItems.map((i) => i.id));
		const wsIds = new Set(workItems.map((i) => i.workstreamId));
		return {
			...project,
			workstreams: project.workstreams.filter((ws) => wsIds.has(ws.id)),
			workItems,
			dependencies: project.dependencies.filter(
				(d) => ids.has(d.fromItemId) && ids.has(d.toItemId),
			),
		};
	}

	const { items, barOf } =
		level === "projects" ? projectBars(project) : workstreamBars(project);
	return {
		...project,
		workItems: items,
		dependencies: rollupDependencies(project.dependencies, items, barOf),
	};
}
