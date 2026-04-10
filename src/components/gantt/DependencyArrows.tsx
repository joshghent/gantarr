import { useMemo } from "react";
import { useGantt } from "#/lib/gantt-context";
import type { GanttLayout } from "#/lib/gantt-layout";
import { getTaskRowIndex } from "#/lib/gantt-layout";

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
	const { project } = useGantt();

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
	}, [project.dependencies, project.workItems, layout, getX, getItemWidth, rowHeight]);

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
					<polygon points="0 0, 8 3, 0 6" fill="#64748b" />
				</marker>
			</defs>
			{arrows.map((arrow) => {
				const dx = arrow.toX - arrow.fromX;
				const bendOut = Math.max(20, Math.min(Math.abs(dx) * 0.3, 60));

				let path: string;
				if (dx > 30) {
					path = `M ${arrow.fromX} ${arrow.fromY}
						C ${arrow.fromX + bendOut} ${arrow.fromY},
						  ${arrow.toX - bendOut} ${arrow.toY},
						  ${arrow.toX} ${arrow.toY}`;
				} else {
					const offsetY = arrow.fromY < arrow.toY ? -20 : 20;
					path = `M ${arrow.fromX} ${arrow.fromY}
						L ${arrow.fromX + 15} ${arrow.fromY}
						Q ${arrow.fromX + 25} ${arrow.fromY}, ${arrow.fromX + 25} ${arrow.fromY + offsetY}
						L ${arrow.fromX + 25} ${(arrow.fromY + arrow.toY) / 2}
						Q ${arrow.fromX + 25} ${arrow.toY - offsetY}, ${arrow.toX - 15} ${arrow.toY}
						L ${arrow.toX} ${arrow.toY}`;
				}

				return (
					<path
						key={arrow.id}
						d={path}
						stroke="#64748b"
						strokeWidth={1.5}
						fill="none"
						markerEnd="url(#arrowhead)"
						opacity={0.7}
					/>
				);
			})}
		</svg>
	);
}
