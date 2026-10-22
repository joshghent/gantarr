// Release notes shown in the "What's new" dialog. Newest entry first. To
// announce a new feature, prepend an entry — the dialog and the one-time
// auto-open pick it up automatically.

export interface ReleaseNote {
	/** Stable identifier stored in localStorage to track "last seen". */
	version: string;
	date: string; // YYYY-MM-DD
	title: string;
	items: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
	{
		version: "2026-10-22-key-work-sprint-numbers",
		date: "2026-10-22",
		title: "Sharper Workstreams view, custom sprint numbers",
		items: [
			"The Workstreams view (3) now shows just the key work in each workstream — development by default. Tasks left in the workstream's own colour, BAU and the like stay out of it.",
			"Back-to-back projects keep their own bars there instead of running together; only work that overlaps shares a bar.",
			"Choose which legend categories show in the Workstreams view with the eye toggle when editing a legend entry.",
			"Sprint settings now take the date the roadmap starts and the number of its first sprint. The timeline begins on that date.",
		],
	},
	{
		version: "2026-10-21-levels-sprints-capacity",
		date: "2026-10-21",
		title: "Stakeholder views, sprints and team capacity",
		items: [
			"Give tasks a Project, then switch to Projects (2) for one bar per project, or Workstreams (3) for a headline view with one bar per stretch of work. Double-click a project bar to open just its tasks.",
			"New Sprints view (S): columns are numbered sprints. Set the sprint length and when sprint 1 starts from the toolbar.",
			"Set your team size and how many engineers each task needs. Gantarr marks the weeks that are overbooked and warns you in the toolbar.",
			"Dependency arrows between back-to-back tasks no longer leave their arrowhead hanging off the line.",
		],
	},
	{
		version: "2026-09-10-labels-inside-bars",
		date: "2026-09-10",
		title: "Task titles stay in their bars",
		items: [
			"Long task titles are trimmed inside their bar again instead of being written out in the empty grid beside it — hover a trimmed title to read it in full.",
			"Only a bar too narrow to hold any readable text still puts its title alongside, and only when there's room to show more of it there.",
		],
	},
	{
		version: "2026-09-07-colors-arrows-exports",
		date: "2026-09-07",
		title: "Distinct colours, multi-link arrows, tighter exports",
		items: [
			"New workstreams always take a colour nothing else is using — no more two bands in a row wearing the same blue after a delete or a long project.",
			"A task can be linked to (and from) as many others as you like — existing arrows no longer swallow the drag that would start the next one.",
			"Task titles that don't fit their bar are written beside it instead of being squeezed or stacked into an unreadable block.",
			"PNG/PDF exports are cropped to the chart itself, without the empty grid below and to the right of your work.",
		],
	},
	{
		version: "2026.07.01-polish",
		date: "2026-07-01",
		title: "Cleaner exports & tidier arrows",
		items: [
			"PNG/PDF exports now wrap long task and workstream names instead of spilling them across the chart, and month labels stay inside their columns.",
			"Dependency arrows between back-to-back tasks are smooth again — no more spiky elbows.",
			"Click any dependency arrow to remove it.",
			"New tasks added from the sidebar now land where you're looking, not always on today.",
		],
	},
	{
		version: "2026.06.22-ai",
		date: "2026-06-22",
		title: "Build charts with AI",
		items: [
			"Connect ChatGPT, Claude, or any MCP client to the new /mcp endpoint and ask it to build a Gantt chart.",
			"AI assistants get an 'open in Gantarr' link — the whole chart rides in the URL, no account or upload needed.",
			"Read the machine-readable guide at /llms.txt, or paste the starter prompt into any chat.",
		],
	},
];

/** The version users are considered "caught up" to once they've seen it. */
export const LATEST_RELEASE_VERSION = RELEASE_NOTES[0].version;

/** localStorage key holding the last release version the user has seen. */
export const RELEASE_SEEN_KEY = "gantarr:lastSeenRelease";

/** True when the latest release hasn't been seen yet (incl. first-time users). */
export function hasUnseenRelease(lastSeen: string | null): boolean {
	return lastSeen !== LATEST_RELEASE_VERSION;
}
