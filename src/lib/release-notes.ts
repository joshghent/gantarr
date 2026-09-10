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
