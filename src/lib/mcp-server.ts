import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	createGanttChart,
	GANTARR_SCHEMA_DOC,
	renderGanttChart,
} from "./ai-tools";
import {
	type ChartInput,
	chartInputSchema,
	ganttProjectSchema,
} from "./project-schema";

// Builds a fresh MCP server bound to a specific origin. We build per-request
// (see routes/mcp.ts) so each tool call produces an absolute import link for
// the host that was actually called, without sharing mutable state across
// requests.
export function buildMcpServer(origin: string): McpServer {
	const server = new McpServer({ name: "gantarr", version: "1.0.0" });

	server.registerTool(
		"create_gantt_chart",
		{
			title: "Create a Gantt chart",
			description:
				"Build a Gantarr Gantt chart from a structured plan (workstreams " +
				"and tasks) and get a shareable link that opens it. Dates are " +
				"YYYY-MM-DD. Returns an 'open in Gantarr' URL.",
			inputSchema: chartInputSchema.shape,
		},
		async (input) => {
			const { url } = await createGanttChart(input as ChartInput, origin);
			return {
				content: [
					{ type: "text", text: `Open your chart in Gantarr:\n${url}` },
				],
			};
		},
	);

	server.registerTool(
		"render_gantt_chart",
		{
			title: "Render a full Gantarr project",
			description:
				"Take a complete GanttProject JSON object and return a shareable " +
				"link that opens it in Gantarr. Prefer create_gantt_chart unless you " +
				"already have a full project document.",
			inputSchema: { project: ganttProjectSchema },
		},
		async ({ project }) => {
			const { url } = await renderGanttChart(project, origin);
			return {
				content: [
					{ type: "text", text: `Open your chart in Gantarr:\n${url}` },
				],
			};
		},
	);

	server.registerResource(
		"gantarr-schema",
		"gantarr://schema",
		{
			title: "Gantarr chart format",
			description:
				"How to structure a Gantarr Gantt chart and produce an open link.",
			mimeType: "text/markdown",
		},
		async (uri) => ({
			contents: [{ uri: uri.href, text: GANTARR_SCHEMA_DOC }],
		}),
	);

	return server;
}
