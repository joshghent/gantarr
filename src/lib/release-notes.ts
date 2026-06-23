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
