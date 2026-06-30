import { createFileRoute } from "@tanstack/react-router";

import { buildLlmsTxt } from "#/lib/ai-tools";

// Serves /llms.txt — the machine-readable guide AI clients read to learn how
// to build Gantarr charts and where the MCP endpoint lives. Plain text so it
// drops straight into a chat or an llms.txt crawler.
export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const origin = new URL(request.url).origin;
				return new Response(buildLlmsTxt(origin), {
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
