import type { GanttProject } from "../types";
import { buildImportUrl } from "./project-link";
import { buildProject, type ChartInput, parseProject } from "./project-schema";

// Shared, transport-agnostic logic behind the AI integration. The MCP server
// (src/routes/mcp.ts) and the /llms.txt docs route both build on these so the
// "describe a plan → get an open-in-Gantarr link" behavior is defined once and
// unit-tested directly, independent of MCP wiring.

export interface ChartResult {
	/** A shareable https://…/?import=<token> deep link that opens the chart. */
	url: string;
	/** The fully-expanded project (also useful to return as raw JSON). */
	project: GanttProject;
}

/** Build a chart from the friendly AI input shape and return an open link. */
export async function createGanttChart(
	input: ChartInput,
	origin: string,
): Promise<ChartResult> {
	const project = buildProject(input);
	const url = await buildImportUrl(origin, project);
	return { url, project };
}

/** Validate a full GanttProject JSON payload and return an open link. */
export async function renderGanttChart(
	json: unknown,
	origin: string,
): Promise<ChartResult> {
	const project = parseProject(json);
	const url = await buildImportUrl(origin, project);
	return { url, project };
}

/**
 * Authoring guide handed to AI clients — as an MCP resource and inline in
 * /llms.txt. Kept in one place so the docs and the live tools never drift.
 */
export const GANTARR_SCHEMA_DOC = `# Gantarr — build a Gantt chart with AI

Gantarr turns a structured plan into an interactive Gantt chart. You can create
one without any account or upload: build the plan as JSON, and Gantarr opens it
from a self-contained link — no data is stored on a server.

## Two ways to produce a chart

1. **MCP tools** (recommended) at the \`/mcp\` endpoint:
   - \`create_gantt_chart\` — pass the friendly "chart input" shape below.
   - \`render_gantt_chart\` — pass a full GanttProject JSON object.
   Both return an "open in Gantarr" link.

2. **Deep link** — encode a chart yourself into \`https://<host>/?import=<token>\`.
   Prefer the MCP tools, which produce this token for you.

## Chart input (friendly shape — for create_gantt_chart)

\`\`\`jsonc
{
  "name": "Q1 Launch",                 // required
  "workstreams": [                      // required, at least one
    {
      "label": "Engineering",           // required
      "color": "#2a9d8f",               // optional hex; defaults from palette
      "tasks": [
        {
          "title": "Build API",         // required; also used to link dependencies
          "start": "2026-01-05",        // required, YYYY-MM-DD
          "end": "2026-01-16",          // required, YYYY-MM-DD, must be >= start
          "type": "Development",        // optional legend category (auto-created)
          "lane": 0                      // optional explicit row within the workstream
        }
      ]
    }
  ],
  "legend": [                           // optional; categories referenced by task.type
    { "label": "Development", "color": "#3b82f6" }
  ],
  "dependencies": [                     // optional; arrows between tasks, by title
    { "from": "Build API", "to": "Launch" }
  ]
}
\`\`\`

## Full project shape (for render_gantt_chart / a raw ?import= link)

A GanttProject is the wire format the app stores:

- \`id\`, \`name\`, \`createdAt\`, \`updatedAt\`
- \`workstreams[]\`: \`{ id, label, order, color }\`
- \`workItems[]\`:  \`{ id, workstreamId, title, startDate, endDate, legendEntryId, order, lane? }\`
  (\`startDate\`/\`endDate\` are YYYY-MM-DD; \`legendEntryId\` is null or a legend id)
- \`dependencies[]\`: \`{ id, fromItemId, toItemId }\`
- \`legend[]\`: \`{ id, label, color }\`

Prefer the friendly chart input + \`create_gantt_chart\`; it fills in ids,
ordering, colors, and legend resolution for you.

## Tips
- Dates are calendar dates; the chart treats Mon–Fri as working days.
- Keep titles unique if you use dependencies — they're matched by title.
- Reuse a small set of legend categories for a clean, readable chart.`;

/**
 * The /llms.txt body for a given deployment. Combines the static authoring
 * guide with this host's concrete MCP endpoint and a copy-paste prompt that
 * works in any chat client (no connector required).
 */
export function buildLlmsTxt(origin: string): string {
	const base = origin.replace(/\/+$/, "");
	return `${GANTARR_SCHEMA_DOC}

## This deployment

- App: ${base}
- MCP endpoint: ${base}/mcp
- Deep-link format: ${base}/?import=<token>

## Copy-paste prompt (works in any AI chat)

Paste this into ChatGPT, Claude, or any assistant, then describe your project:

"""
You can build interactive Gantt charts with Gantarr. When I describe a plan,
respond with a single GanttProject JSON document matching the schema at
${base}/llms.txt, then give me a link of the form
${base}/?import=<token> where <token> is the gzipped + base64url-encoded JSON.
If you cannot produce the encoded token, just return the JSON and tell me to
drag it into ${base}. Use YYYY-MM-DD dates and keep task titles unique.
"""

For a hands-off experience, add ${base}/mcp as a custom MCP connector and use
the create_gantt_chart tool instead.`;
}
