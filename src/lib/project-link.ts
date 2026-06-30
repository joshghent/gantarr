import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";
import type { GanttProject } from "../types";
import { parseProject } from "./project-schema";

// Self-contained, serverless chart sharing: a whole project is gzipped and
// base64url-encoded into an `?import=` token. The same token is produced by
// the MCP tools (so an AI can hand back an "open in Gantarr" link) and read
// by the app on load. No storage, no backend state — the chart rides in the
// URL. We gzip with fflate (pure JS) rather than the platform
// CompressionStream/DecompressionStream: WebKit's DecompressionStream aborts
// on otherwise-valid gzip ("The operation was aborted."), so fflate keeps
// encode/decode byte-identical across Cloudflare Workers, Chrome, Safari, and
// Node.

function bytesToBase64url(bytes: Uint8Array): string {
	let binary = "";
	const chunk = 0x8000; // chunk to stay well under argument-count limits
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function base64urlToBytes(token: string): Uint8Array {
	// atob throws on non-base64 input, which surfaces as a rejected decode.
	const binary = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Serialize a project into a URL-safe `?import=` token. */
export async function encodeProject(project: GanttProject): Promise<string> {
	return bytesToBase64url(gzipSync(strToU8(JSON.stringify(project))));
}

/**
 * Decode and validate an `?import=` token back into a project. Throws if the
 * token is malformed, not gzip, or doesn't decode to a valid GanttProject.
 */
export async function decodeProject(token: string): Promise<GanttProject> {
	const json = strFromU8(gunzipSync(base64urlToBytes(token)));
	return parseProject(JSON.parse(json));
}

/** Build a full `https://origin/?import=<token>` deep link for a project. */
export async function buildImportUrl(
	origin: string,
	project: GanttProject,
): Promise<string> {
	const base = origin.replace(/\/+$/, "");
	return `${base}/?import=${await encodeProject(project)}`;
}

/** Pull the `import` token out of a query string or full URL; null if absent. */
export function extractImportToken(input: string): string | null {
	if (!input) return null;
	const q = input.indexOf("?");
	const query = q >= 0 ? input.slice(q + 1) : input;
	return new URLSearchParams(query).get("import");
}
