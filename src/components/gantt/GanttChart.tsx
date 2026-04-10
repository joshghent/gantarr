import { useCallback, useMemo, useRef, useState } from "react";
import { useGantt } from "#/lib/gantt-context";
import {
	addDays,
	formatDate,
	formatDayName,
	formatMonthYear,
	formatShortDate,
	getWeeks,
	getWorkingDays,
	parseDate,
} from "#/lib/dates";
import { buildLayout, getTaskRowIndex, getWorkstreamAtRow } from "#/lib/gantt-layout";
import { ROW_HEIGHT, HEADER_HEIGHT } from "./GanttSidebar";
import WorkItemBar from "./WorkItemBar";
import DependencyArrows from "./DependencyArrows";

const COL_WIDTH_DAY = 36;
const COL_WIDTH_WEEK = 110;

export default function GanttChart() {
	const {
		project,
		viewMode,
		updateWorkItem,
		moveWorkItemToWorkstream,
		selectedItemId,
		setSelectedItemId,
		connectingFrom,
		setConnectingFrom,
		addDependency,
		setModalItemId,
	} = useGantt();
	const scrollRef = useRef<HTMLDivElement>(null);

	const layout = useMemo(() => buildLayout(project), [project]);

	// Calculate date range from all work items, with padding
	const { startDate, columns } = useMemo(() => {
		if (project.workItems.length === 0) {
			const today = new Date();
			const start = addDays(today, -7);
			const end = addDays(today, 30);
			if (viewMode === "weeks") {
				return { startDate: start, columns: getWeeks(start, end) };
			}
			return { startDate: start, columns: getWorkingDays(start, end) };
		}

		let minDate = new Date(8640000000000000);
		let maxDate = new Date(-8640000000000000);

		for (const item of project.workItems) {
			const s = parseDate(item.startDate);
			const e = parseDate(item.endDate);
			if (s < minDate) minDate = s;
			if (e > maxDate) maxDate = e;
		}

		const start = addDays(minDate, -7);
		const end = addDays(maxDate, 14);

		if (viewMode === "weeks") {
			return { startDate: start, columns: getWeeks(start, end) };
		}
		return { startDate: start, columns: getWorkingDays(start, end) };
	}, [project.workItems, viewMode]);

	const colWidth = viewMode === "days" ? COL_WIDTH_DAY : COL_WIDTH_WEEK;
	const totalWidth = columns.length * colWidth;
	const totalHeight = Math.max(layout.totalRows, 1) * ROW_HEIGHT;

	// Get x position for a date
	const getX = useCallback(
		(dateStr: string): number => {
			const date = parseDate(dateStr);
			if (viewMode === "days") {
				const workingDays = getWorkingDays(startDate, date);
				return Math.max(0, (workingDays.length - 1) * colWidth);
			}
			// For weeks: find which week the date falls in
			for (let i = 0; i < columns.length; i++) {
				const weekStart = columns[i];
				const weekEnd = addDays(weekStart, 6);
				if (date >= weekStart && date <= weekEnd) {
					const dayOfWeek = date.getDay();
					const dayIndex = dayOfWeek === 0 ? 4 : dayOfWeek - 1;
					return i * colWidth + (dayIndex / 5) * colWidth;
				}
			}
			if (date < columns[0]) return 0;
			return totalWidth;
		},
		[columns, colWidth, startDate, totalWidth, viewMode],
	);

	const getItemWidth = useCallback(
		(item: { startDate: string; endDate: string }): number => {
			const x1 = getX(item.startDate);
			const x2 = getX(item.endDate);
			return Math.max(colWidth, x2 - x1 + colWidth);
		},
		[getX, colWidth],
	);

	// Drag state
	const [dragState, setDragState] = useState<{
		itemId: string;
		type: "move" | "resize-start" | "resize-end";
		startMouseX: number;
		startMouseY: number;
		originalStartDate: string;
		originalEndDate: string;
		originalRowIndex: number;
		didDrag: boolean;
	} | null>(null);

	const handleMouseDown = useCallback(
		(
			e: React.MouseEvent | React.TouchEvent,
			itemId: string,
			type: "move" | "resize-start" | "resize-end",
		) => {
			e.stopPropagation();
			const item = project.workItems.find((wi) => wi.id === itemId);
			if (!item) return;
			const point = "touches" in e ? e.touches[0] : e;
			const rowIndex = getTaskRowIndex(layout, itemId);
			setDragState({
				itemId,
				type,
				startMouseX: point.clientX,
				startMouseY: point.clientY,
				originalStartDate: item.startDate,
				originalEndDate: item.endDate,
				originalRowIndex: rowIndex,
				didDrag: false,
			});
		},
		[project.workItems, layout],
	);

	const handlePointerMove = useCallback(
		(clientX: number, clientY: number) => {
			if (!dragState) return;
			const dx = clientX - dragState.startMouseX;
			const dy = clientY - dragState.startMouseY;
			const daysMoved = Math.round(dx / colWidth);

			// Mark as actually dragged if moved more than a couple of pixels
			if (!dragState.didDrag && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
				setDragState({ ...dragState, didDrag: true });
			}

			const origStart = parseDate(dragState.originalStartDate);
			const origEnd = parseDate(dragState.originalEndDate);

			if (dragState.type === "move") {
				if (daysMoved !== 0) {
					const newStart = addDays(origStart, daysMoved);
					const newEnd = addDays(origEnd, daysMoved);
					updateWorkItem(dragState.itemId, {
						startDate: formatDate(newStart),
						endDate: formatDate(newEnd),
					});
				}
				// Vertical drag: change workstream
				const rowsMoved = Math.round(dy / ROW_HEIGHT);
				if (rowsMoved !== 0) {
					const targetRowIndex = dragState.originalRowIndex + rowsMoved;
					const targetWsId = getWorkstreamAtRow(layout, targetRowIndex);
					const item = project.workItems.find(
						(wi) => wi.id === dragState.itemId,
					);
					if (targetWsId && item && item.workstreamId !== targetWsId) {
						moveWorkItemToWorkstream(dragState.itemId, targetWsId);
					}
				}
			} else if (dragState.type === "resize-end") {
				if (daysMoved !== 0) {
					const newEnd = addDays(origEnd, daysMoved);
					if (newEnd >= origStart) {
						updateWorkItem(dragState.itemId, {
							endDate: formatDate(newEnd),
						});
					}
				}
			} else if (dragState.type === "resize-start") {
				if (daysMoved !== 0) {
					const newStart = addDays(origStart, daysMoved);
					if (newStart <= origEnd) {
						updateWorkItem(dragState.itemId, {
							startDate: formatDate(newStart),
						});
					}
				}
			}
		},
		[
			dragState,
			colWidth,
			updateWorkItem,
			moveWorkItemToWorkstream,
			layout,
			project.workItems,
		],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!dragState) return;
			handlePointerMove(e.clientX, e.clientY);
		},
		[dragState, handlePointerMove],
	);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!dragState) return;
			const touch = e.touches[0];
			handlePointerMove(touch.clientX, touch.clientY);
		},
		[dragState, handlePointerMove],
	);

	const handleMouseUp = useCallback(() => {
		setDragState(null);
	}, []);

	const handleChartClick = useCallback(
		(e: React.MouseEvent) => {
			if (connectingFrom) {
				setConnectingFrom(null);
				return;
			}
			if ((e.target as HTMLElement).closest("[data-workitem]") === null) {
				setSelectedItemId(null);
			}
		},
		[connectingFrom, setConnectingFrom, setSelectedItemId],
	);

	const handleItemClick = useCallback(
		(itemId: string) => {
			// If a drag actually happened, don't treat as click
			if (dragState?.didDrag) return;
			if (connectingFrom) {
				if (connectingFrom !== itemId) {
					addDependency(connectingFrom, itemId);
				}
				setConnectingFrom(null);
				return;
			}
			setSelectedItemId(itemId === selectedItemId ? null : itemId);
		},
		[
			dragState,
			connectingFrom,
			setConnectingFrom,
			addDependency,
			selectedItemId,
			setSelectedItemId,
		],
	);

	const handleItemDoubleClick = useCallback(
		(itemId: string) => {
			setModalItemId(itemId);
		},
		[setModalItemId],
	);

	// Group columns by month for the top header row
	const monthGroups = useMemo(() => {
		const groups: { label: string; startIdx: number; span: number }[] = [];
		let currentMonth = -1;
		let currentYear = -1;
		for (let i = 0; i < columns.length; i++) {
			const col = columns[i];
			const m = col.getMonth();
			const y = col.getFullYear();
			if (m !== currentMonth || y !== currentYear) {
				groups.push({ label: formatMonthYear(col), startIdx: i, span: 1 });
				currentMonth = m;
				currentYear = y;
			} else {
				groups[groups.length - 1].span++;
			}
		}
		return groups;
	}, [columns]);

	return (
		<div
			ref={scrollRef}
			className="flex-1 overflow-auto"
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleMouseUp}
			onClick={handleChartClick}
		>
			<div
				style={{ width: totalWidth, minHeight: totalHeight + HEADER_HEIGHT }}
				className="relative"
			>
				{/* Month header row */}
				<div
					className="sticky top-0 z-20 flex border-b border-border bg-card"
					style={{ height: HEADER_HEIGHT / 2 }}
				>
					{monthGroups.map((g) => (
						<div
							key={`${g.label}-${g.startIdx}`}
							className="flex items-center justify-center border-r border-border text-xs font-semibold text-foreground"
							style={{ width: g.span * colWidth }}
						>
							{g.label}
						</div>
					))}
				</div>

				{/* Day/Week header row */}
				<div
					className="sticky z-20 flex border-b border-border bg-card"
					style={{ height: HEADER_HEIGHT / 2, top: HEADER_HEIGHT / 2 }}
				>
					{columns.map((col) => {
						const isToday = formatDate(col) === formatDate(new Date());
						return (
							<div
								key={formatDate(col)}
								className={`flex flex-col items-center justify-center border-r border-border text-[10px] leading-tight ${
									isToday
										? "bg-primary/10 font-semibold text-primary"
										: "text-muted-foreground"
								}`}
								style={{ width: colWidth }}
							>
								{viewMode === "days" ? (
									<>
										<span>{formatDayName(col)}</span>
										<span>{col.getDate()}</span>
									</>
								) : (
									<span>{formatShortDate(col)}</span>
								)}
							</div>
						);
					})}
				</div>

				{/* Grid area */}
				<div
					className="relative"
					style={{ minHeight: totalHeight }}
				>
					{/* Row backgrounds */}
					{layout.rows.map((row, i) => (
						<div
							key={`row-${row.workstreamId}-${row.workItemId ?? "empty"}-${i}`}
							className={`border-b border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/30"}`}
							style={{ height: ROW_HEIGHT }}
						/>
					))}

					{/* Workstream divider lines (between bands) */}
					{layout.bands.slice(0, -1).map((band) => (
						<div
							key={`divider-${band.workstreamId}`}
							className="pointer-events-none absolute left-0 right-0 border-b-2 border-border/60"
							style={{
								top: (band.startRow + band.span) * ROW_HEIGHT - 1,
							}}
						/>
					))}

					{/* Vertical grid lines */}
					<div className="pointer-events-none absolute inset-0">
						{columns.map((col, i) => {
							const isToday = formatDate(col) === formatDate(new Date());
							return (
								<div
									key={formatDate(col)}
									className={`absolute top-0 bottom-0 border-r ${
										isToday
											? "border-primary/30"
											: "border-border/50"
									}`}
									style={{ left: (i + 1) * colWidth }}
								/>
							);
						})}
					</div>

					{/* Today line */}
					{(() => {
						const todayX = getX(formatDate(new Date()));
						if (todayX >= 0 && todayX <= totalWidth) {
							return (
								<div
									className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-primary/60"
									style={{ left: todayX + colWidth / 2 }}
								/>
							);
						}
						return null;
					})()}

					{/* Dependency arrows */}
					<DependencyArrows
						getX={getX}
						getItemWidth={getItemWidth}
						rowHeight={ROW_HEIGHT}
						layout={layout}
					/>

					{/* Work item bars (one per row) */}
					{project.workItems.map((item) => {
						const rowIndex = getTaskRowIndex(layout, item.id);
						if (rowIndex === -1) return null;
						const x = getX(item.startDate);
						const width = getItemWidth(item);
						const y = rowIndex * ROW_HEIGHT + 6;

						return (
							<WorkItemBar
								key={item.id}
								item={item}
								x={x}
								y={y}
								width={width}
								height={ROW_HEIGHT - 12}
								isSelected={selectedItemId === item.id}
								isConnecting={connectingFrom !== null}
								isConnectSource={connectingFrom === item.id}
								onMouseDown={handleMouseDown}
								onClick={handleItemClick}
								onDoubleClick={handleItemDoubleClick}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}
