import { useMemo, useState } from "react";
import { useGantt } from "#/lib/gantt-context";
import type { GanttLayout } from "#/lib/gantt-layout";
import { getTaskRowIndex } from "#/lib/gantt-layout";

/**
 * Build the arrow path from a task's right edge to a successor's left edge.
 * A single cubic Bézier handles every case: for forward dependencies the
 * control points stretch with the horizontal gap; for adjacent or backward
 * ones (a task that ends where the next begins) we keep a small fixed reach
 * so the curve makes a tidy S instead of the sharp orthogonal spikes the
 * old elbow routing produced.
 */
export function arrowPath(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
): string {
	const dx = toX - fromX;
	const reach = dx > 24 ? Math.min(Math.max(dx * 0.4, 24), 80) : 22;
	return `M ${fromX} ${fromY} C ${fromX + reach} ${fromY}, ${toX - reach} ${toY}, ${toX} ${toY}`;
}

/**
 * Sample the cubic from `arrowPath` as a polyline, trimmed back from both
 * ends. The visible arrow is a click target (click to delete), and the two
 * places it passes over are exactly the places that need to stay grabbable:
 * the source task's connector port and the target task's left edge. Trimming
 * the hit region keeps the arrow easy to click along its length while leaving
 * both tasks free to start and receive the next dependency.
 */
export function arrowHitPath(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	trimStart = 18,
	trimEnd = 12,
): string {
	const dx = toX - fromX;
	const reach = dx > 24 ? Math.min(Math.max(dx * 0.4, 24), 80) : 22;
	const p0 = [fromX, fromY];
	const p1 = [fromX + reach, fromY];
	const p2 = [toX - reach, toY];
	const p3 = [toX, toY];

	const STEPS = 32;
	const pts: [number, number][] = [];
	for (let i = 0; i <= STEPS; i++) {
		const t = i / STEPS;
		const u = 1 - t;
		const a = u * u * u;
		const b = 3 * u * u * t;
		const c = 3 * u * t * t;
		const d = t * t * t;
		pts.push([
			a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
			a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
		]);
	}

	// Cumulative arc length, so the trims are in pixels rather than in
	// curve parameter space (where they'd vary wildly with arrow length).
	const dist: number[] = [0];
	for (let i = 1; i < pts.length; i++) {
		dist.push(
			dist[i - 1] +
				Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
		);
	}
	const total = dist[dist.length - 1];
	if (total <= trimStart + trimEnd) return "";

	const kept = pts.filter(
		(_, i) => dist[i] >= trimStart && dist[i] <= total - trimEnd,
	);
	if (kept.length < 2) return "";

	return kept.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

interface DependencyArrowsProps {
	getX: (dateStr: string) => number;
	getItemWidth: (item: { startDate: string; endDate: string }) => number;
	rowHeight: number;
	layout: GanttLayout;
	/**
	 * False while the user is dragging a new dependency — the whole layer
	 * then ignores the pointer so the drop lands on the task underneath.
	 */
	interactive?: boolean;
}

export default function DependencyArrows({
	getX,
	getItemWidth,
	rowHeight,
	layout,
	interactive = true,
}: DependencyArrowsProps) {
	const { project, deleteDependency } = useGantt();
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	const arrows = useMemo(() => {
		return project.dependencies
			.map((dep) => {
				const fromItem = project.workItems.find(
					(wi) => wi.id === dep.fromItemId,
				);
				const toItem = project.workItems.find((wi) => wi.id === dep.toItemId);
				if (!fromItem || !toItem) return null;

				const fromRow = getTaskRowIndex(layout, fromItem.id);
				const toRow = getTaskRowIndex(layout, toItem.id);
				if (fromRow === -1 || toRow === -1) return null;

				const fromX = getX(fromItem.startDate) + getItemWidth(fromItem);
				const fromY = fromRow * rowHeight + rowHeight / 2;

				const toX = getX(toItem.startDate);
				const toY = toRow * rowHeight + rowHeight / 2;

				return { id: dep.id, fromX, fromY, toX, toY };
			})
			.filter(Boolean) as {
			id: string;
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
		}[];
	}, [
		project.dependencies,
		project.workItems,
		layout,
		getX,
		getItemWidth,
		rowHeight,
	]);

	if (arrows.length === 0) return null;

	const maxX = Math.max(...arrows.map((a) => Math.max(a.fromX, a.toX))) + 50;
	const maxY = Math.max(...arrows.map((a) => Math.max(a.fromY, a.toY))) + 50;

	return (
		<svg
			className="pointer-events-none absolute inset-0"
			style={{ width: maxX, height: maxY, zIndex: 5 }}
		>
			<defs>
				<marker
					id="arrowhead"
					markerWidth="8"
					markerHeight="6"
					refX="8"
					refY="3"
					orient="auto"
				>
					<polygon points="0 0, 8 3, 0 6" fill="#5a7a80" />
				</marker>
				<marker
					id="arrowhead-hover"
					markerWidth="8"
					markerHeight="6"
					refX="8"
					refY="3"
					orient="auto"
				>
					<polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
				</marker>
			</defs>
			{arrows.map((arrow) => {
				const path = arrowPath(arrow.fromX, arrow.fromY, arrow.toX, arrow.toY);
				const hitPath = arrowHitPath(
					arrow.fromX,
					arrow.fromY,
					arrow.toX,
					arrow.toY,
				);
				const isHovered = hoveredId === arrow.id;

				return (
					<g
						key={arrow.id}
						className={
							interactive
								? "pointer-events-auto cursor-pointer"
								: "pointer-events-none"
						}
						onMouseEnter={() => setHoveredId(arrow.id)}
						onMouseLeave={() =>
							setHoveredId((id) => (id === arrow.id ? null : id))
						}
						onClick={(e) => {
							e.stopPropagation();
							deleteDependency(arrow.id);
						}}
					>
						{/* Wide invisible hit target so the thin arrow is easy
						    to hover and click. Trimmed at both ends so it
						    doesn't sit on top of the tasks it connects. */}
						{hitPath && (
							<path
								d={hitPath}
								stroke="transparent"
								strokeWidth={12}
								fill="none"
							/>
						)}
						<path
							d={path}
							stroke={isHovered ? "#ef4444" : "#5a7a80"}
							strokeWidth={isHovered ? 2.5 : 1.5}
							fill="none"
							markerEnd={`url(#arrowhead${isHovered ? "-hover" : ""})`}
							opacity={isHovered ? 1 : 0.7}
							// The drawn arrow is decoration only — the trimmed
							// path above is what receives clicks.
							pointerEvents="none"
						/>
						{isHovered && <title>Click to remove dependency</title>}
					</g>
				);
			})}
		</svg>
	);
}
