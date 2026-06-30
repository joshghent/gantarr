import { createFileRoute } from "@tanstack/react-router";

import { buildMcpServer } from "#/lib/mcp-server";
import { handleMcpRequest } from "#/utils/mcp-handler";

// Remote MCP endpoint. A fresh server is built per request, bound to the
// origin the request came in on, so the chart tools return absolute
// "open in Gantarr" links for this deployment. Stateless — no storage.
export const Route = createFileRoute("/mcp")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const origin = new URL(request.url).origin;
				return handleMcpRequest(request, buildMcpServer(origin));
			},
		},
	},
});
