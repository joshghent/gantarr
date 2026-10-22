import { describe, expect, it } from "vitest";
import type { GanttProject, WorkItem } from "../types";
import { buildLayout } from "./gantt-layout";
import {
	buildDisplayProject,
	isRollupId,
	listGroups,
	showsInWorkstreams,
} from "./rollup";

function task(
	id: string,
	workstreamId: string,
	startDate: string,
	endDate: string,
	extra: Partial<WorkItem> = {},
): WorkItem {
	return {
		id,
		workstreamId,
		title: id,
		startDate,
		endDate,
		legendEntryId: null,
		order: 0,
		...extra,
	};
}

function project(workItems: WorkItem[], deps: [string, string][] = []) {
	return {
		id: "p",
		name: "P",
		workstreams: [
			{ id: "ws1", label: "One", order: 0, color: "#e76f51" },
			{ id: "ws2", label: "Two", order: 1, color: "#2a9d8f" },
		],
		workItems,
		dependencies: deps.map(([fromItemId, toItemId], i) => ({
			id: `d${i}`,
			fromItemId,
			toItemId,
		})),
		legend: [],
		createdAt: "",
		updatedAt: "",
	} satisfies GanttProject;
}

describe("detail level", () => {
	it("returns the project untouched without a focus", () => {
		const p = project([task("a", "ws1", "2026-11-02", "2026-11-06")]);
		expect(buildDisplayProject(p, "detail")).toBe(p);
	});

	it("drills into one project's tasks and workstreams", () => {
		const p = project(
			[
				task("a", "ws1", "2026-11-02", "2026-11-06", { group: "SSO" }),
				task("b", "ws1", "2026-11-09", "2026-11-13", { group: "SSO" }),
				task("c", "ws2", "2026-11-02", "2026-11-06", { group: "Billing" }),
			],
			[
				["a", "b"],
				["b", "c"],
			],
		);
		const d = buildDisplayProject(p, "detail", "SSO");
		expect(d.workItems.map((i) => i.id)).toEqual(["a", "b"]);
		expect(d.workstreams.map((w) => w.id)).toEqual(["ws1"]);
		expect(d.dependencies.map((x) => x.id)).toEqual(["d0"]);
	});
});

describe("projects level", () => {
	const p = project(
		[
			task("a", "ws1", "2026-11-02", "2026-11-06", {
				group: "SSO",
				lane: 0,
				legendEntryId: "dev",
			}),
			task("b", "ws1", "2026-11-09", "2026-11-20", {
				group: "SSO",
				lane: 1,
				legendEntryId: "dev",
			}),
			task("c", "ws1", "2026-11-04", "2026-11-05", { lane: 2 }),
			task("d", "ws2", "2026-11-23", "2026-11-27", { group: "Billing" }),
		],
		[
			["a", "b"],
			["b", "d"],
			["a", "d"],
		],
	);
	const d = buildDisplayProject(p, "projects");

	it("spans each project over its tasks and names it", () => {
		const sso = d.workItems.find((i) => i.title === "SSO");
		expect(sso).toMatchObject({
			startDate: "2026-11-02",
			endDate: "2026-11-20",
			group: "SSO",
			legendEntryId: "dev",
		});
		expect(sso && isRollupId(sso.id)).toBe(true);
	});

	it("keeps ungrouped tasks as they are, minus explicit lanes", () => {
		const c = d.workItems.find((i) => i.id === "c");
		expect(c).toBeDefined();
		expect(c?.lane).toBeUndefined();
	});

	it("rolls dependencies up between project bars, once each", () => {
		expect(d.dependencies).toHaveLength(1);
		const [dep] = d.dependencies;
		const byId = new Map(d.workItems.map((i) => [i.id, i.title]));
		expect(byId.get(dep.fromItemId)).toBe("SSO");
		expect(byId.get(dep.toItemId)).toBe("Billing");
	});

	it("drops summary arrows between bars that overlap", () => {
		const overlapping = project(
			[
				task("a", "ws1", "2026-11-02", "2026-11-20", { group: "SSO" }),
				task("b", "ws2", "2026-11-16", "2026-11-27", { group: "Billing" }),
			],
			[["a", "b"]],
		);
		expect(buildDisplayProject(overlapping, "projects").dependencies).toEqual(
			[],
		);
	});

	it("packs into rows with the normal layout", () => {
		const layout = buildLayout(d);
		// SSO and the overlapping ungrouped task share ws1; Billing has ws2.
		expect(layout.totalRows).toBe(3);
	});
});

describe("workstreams level", () => {
	const p = project([
		task("a", "ws1", "2026-11-02", "2026-11-06", { group: "SSO" }),
		// Overlaps SSO, so it shares its bar.
		task("b", "ws1", "2026-11-05", "2026-11-13", { group: "Reliability" }),
		// Starts the day after — back to back, so it keeps its own bar.
		task("c", "ws1", "2026-11-14", "2026-11-20", { group: "Billing" }),
		task("d", "ws2", "2026-11-02", "2026-11-03"),
		task("e", "ws2", "2026-11-03", "2026-11-04", { group: "SSO" }),
	]);
	const d = buildDisplayProject(p, "workstreams");
	const ws1 = d.workItems.filter((i) => i.workstreamId === "ws1");

	it("merges overlapping work and keeps back-to-back work apart", () => {
		expect(ws1.map((i) => [i.startDate, i.endDate])).toEqual([
			["2026-11-02", "2026-11-13"],
			["2026-11-14", "2026-11-20"],
		]);
	});

	it("labels each bar with the projects in it", () => {
		expect(ws1.map((i) => i.title)).toEqual(["SSO · Reliability", "Billing"]);
		const ws2 = d.workItems.filter((i) => i.workstreamId === "ws2");
		expect(ws2.map((i) => i.title)).toEqual(["d · SSO"]);
	});

	it("summarises long lists of projects", () => {
		const many = project(
			["A", "B", "C", "D", "E"].map((g, i) =>
				task(g, "ws1", `2026-11-0${i + 2}`, `2026-11-0${i + 3}`, {
					group: g,
				}),
			),
		);
		const [bar] = buildDisplayProject(many, "workstreams").workItems;
		expect(bar.title).toBe("A · B · C +2");
	});

	describe("with a legend", () => {
		const legend = [
			{ id: "dev", label: "Development", color: "#3b82f6" },
			{ id: "bau", label: "BAU", color: "#22c55e" },
		];
		const withLegend = {
			...project(
				[
					task("pentest", "ws1", "2026-11-30", "2027-01-08", {
						legendEntryId: "dev",
					}),
					task("webinars", "ws1", "2027-01-09", "2027-02-24", {
						legendEntryId: "dev",
					}),
					task("support", "ws1", "2026-11-02", "2027-03-01", {
						legendEntryId: "bau",
					}),
					task("uncoloured", "ws1", "2026-12-01", "2026-12-05"),
				],
				[["pentest", "webinars"]],
			),
			legend,
		};

		it("shows only development work by default", () => {
			const bars = buildDisplayProject(withLegend, "workstreams").workItems;
			expect(bars.map((b) => b.title)).toEqual(["pentest", "webinars"]);
		});

		it("keeps the arrow between consecutive bars", () => {
			const d = buildDisplayProject(withLegend, "workstreams");
			expect(d.dependencies).toHaveLength(1);
		});

		it("follows each category's own setting", () => {
			const custom = {
				...withLegend,
				legend: [
					{ ...legend[0], showInWorkstreams: false },
					{ ...legend[1], showInWorkstreams: true },
				],
			};
			const bars = buildDisplayProject(custom, "workstreams").workItems;
			expect(bars.map((b) => b.title)).toEqual(["support"]);
		});
	});
});

describe("showsInWorkstreams", () => {
	it("defaults to development categories", () => {
		const entry = (label: string) => ({ id: label, label, color: "#000" });
		expect(showsInWorkstreams(entry("Development"))).toBe(true);
		expect(showsInWorkstreams(entry("Dev work"))).toBe(true);
		expect(showsInWorkstreams(entry("BAU / 20% time"))).toBe(false);
		expect(showsInWorkstreams(entry("Devops"))).toBe(true);
	});
});

describe("listGroups", () => {
	it("lists distinct project names alphabetically", () => {
		const p = project([
			task("a", "ws1", "2026-11-02", "2026-11-06", { group: "SSO" }),
			task("b", "ws2", "2026-11-02", "2026-11-06", { group: "Billing" }),
			task("c", "ws2", "2026-11-02", "2026-11-06", { group: "SSO" }),
			task("d", "ws2", "2026-11-02", "2026-11-06"),
		]);
		expect(listGroups(p)).toEqual(["Billing", "SSO"]);
	});
});
