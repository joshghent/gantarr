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

interface DependencyArrowsProps {
	getX: (dateStr: string) => number;
	getItemWidth: (item: { startDate: string; endDate: string }) => number;
	rowHeight: number;
	layout: GanttLayout;
}

export default function DependencyArrows({
	getX,
	getItemWidth,
	rowHeight,
	layout,
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
				const isHovered = hoveredId === arrow.id;

				return (
					<g
						key={arrow.id}
						className="pointer-events-auto cursor-pointer"
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
						    to hover and click. */}
						<path d={path} stroke="transparent" strokeWidth={12} fill="none" />
						<path
							d={path}
							stroke={isHovered ? "#ef4444" : "#5a7a80"}
							strokeWidth={isHovered ? 2.5 : 1.5}
							fill="none"
							markerEnd={`url(#arrowhead${isHovered ? "-hover" : ""})`}
							opacity={isHovered ? 1 : 0.7}
						/>
						{isHovered && <title>Click to remove dependency</title>}
					</g>
				);
			})}
		</svg>
	);
}
