import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { buildMcpServer } from "./mcp-server";
import { decodeProject } from "./project-link";

const ORIGIN = "https://gantarr.app";

// Spin up the real server and a real MCP client wired by an in-memory
// transport pair. This exercises the full protocol handshake + tool calls,
// not just the underlying functions.
async function connectedClient() {
	const server = buildMcpServer(ORIGIN);
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "test-client", version: "1.0.0" });
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	return client;
}

function textOf(result: unknown): string {
	const content =
		(result as { content?: Array<{ type: string; text?: string }> }).content ??
		[];
	return content
		.filter((c) => c.type === "text")
		.map((c) => c.text ?? "")
		.join("\n");
}

describe("buildMcpServer", () => {
	it("exposes the chart tools", async () => {
		const client = await connectedClient();
		const { tools } = await client.listTools();
		const names = tools.map((t) => t.name);
		expect(names).toContain("create_gantt_chart");
		expect(names).toContain("render_gantt_chart");
	});

	it("create_gantt_chart returns a decodable import link", async () => {
		const client = await connectedClient();
		const result = await client.callTool({
			name: "create_gantt_chart",
			arguments: {
				name: "Demo",
				workstreams: [
					{
						label: "Build",
						tasks: [{ title: "Spec", start: "2026-04-06", end: "2026-04-10" }],
					},
				],
			},
		});
		const text = textOf(result);
		expect(text).toContain("/?import=");
		const token = text.split("import=")[1].trim().split(/\s/)[0];
		const project = await decodeProject(token);
		expect(project.name).toBe("Demo");
		expect(project.workItems[0].title).toBe("Spec");
	});

	it("render_gantt_chart accepts a full project and returns a link", async () => {
		const client = await connectedClient();
		const project = {
			id: "p1",
			name: "Full",
			workstreams: [{ id: "w1", label: "WS", order: 0, color: "#2a9d8f" }],
			workItems: [
				{
					id: "i1",
					workstreamId: "w1",
					title: "Task",
					startDate: "2026-04-06",
					endDate: "2026-04-10",
					legendEntryId: null,
					order: 0,
				},
			],
			dependencies: [],
			legend: [],
			createdAt: "2026-04-01T00:00:00.000Z",
			updatedAt: "2026-04-01T00:00:00.000Z",
		};
		const result = await client.callTool({
			name: "render_gantt_chart",
			arguments: { project },
		});
		const text = textOf(result);
		expect(text).toContain("/?import=");
	});

	it("exposes the schema as a resource", async () => {
		const client = await connectedClient();
		const { resources } = await client.listResources();
		expect(resources.length).toBeGreaterThan(0);
		const uri = resources[0].uri;
		const read = await client.readResource({ uri });
		const text = (read.contents[0] as { text?: string }).text ?? "";
		expect(text).toContain("workstreams");
	});
});
