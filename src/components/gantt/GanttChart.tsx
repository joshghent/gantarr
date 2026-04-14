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
import {
	buildLayout,
	getTaskRowIndex,
	getWorkstreamAtRow,
} from "#/lib/gantt-layout";
import { ROW_HEIGHT, HEADER_HEIGHT } from "./GanttSidebar";
import WorkItemBar from "./WorkItemBar";
import DependencyArrows from "./DependencyArrows";

const COL_WIDTH_DAY = 36;
const COL_WIDTH_WEEK = 110;

export default function GanttChart() {
	const {
		project,
		viewMode,
		addWorkItem,
		updateWorkItem,
		moveWorkItemToWorkstream,
		selectedItemId,
		setSelectedItemId,
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

	/** Inverse of getX: given an x pixel offset, return the closest date string */
	const getDateAtX = useCallback(
		(x: number): string => {
			const colIndex = Math.max(0, Math.min(Math.round(x / colWidth), columns.length - 1));
			return formatDate(columns[colIndex]);
		},
		[colWidth, columns],
	);

	const getItemWidth = useCallback(
		(item: { startDate: string; endDate: string }): number => {
			const x1 = getX(item.startDate);
			const x2 = getX(item.endDate);
			return Math.max(colWidth, x2 - x1 + colWidth);
		},
		[getX, colWidth],
	);

	// --- Task drag state ---
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

	// --- Dependency drag state ---
	const [depDrag, setDepDrag] = useState<{
		fromItemId: string;
		fromX: number;
		fromY: number;
		mouseX: number;
		mouseY: number;
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

	/** Start dragging a dependency arrow from a task's connector port */
	const handleConnectorDragStart = useCallback(
		(e: React.MouseEvent | React.TouchEvent, itemId: string) => {
			e.stopPropagation();
			e.preventDefault();
			const item = project.workItems.find((wi) => wi.id === itemId);
			if (!item) return;
			const rowIndex = getTaskRowIndex(layout, itemId);
			if (rowIndex === -1) return;
			const fromX = getX(item.startDate) + getItemWidth(item);
			const fromY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
			const scrollEl = scrollRef.current;
			const rect = scrollEl?.getBoundingClientRect();
			const point = "touches" in e ? e.touches[0] : e;
			setDepDrag({
				fromItemId: itemId,
				fromX,
				fromY,
				mouseX: rect
					? point.clientX - rect.left + (scrollEl?.scrollLeft ?? 0)
					: fromX,
				mouseY: rect
					? point.clientY - rect.top + (scrollEl?.scrollTop ?? 0) - HEADER_HEIGHT
					: fromY,
			});
		},
		[project.workItems, layout, getX, getItemWidth],
	);

	const handlePointerMove = useCallback(
		(clientX: number, clientY: number) => {
			// Dependency drag
			if (depDrag) {
				const scrollEl = scrollRef.current;
				const rect = scrollEl?.getBoundingClientRect();
				if (rect) {
					setDepDrag({
						...depDrag,
						mouseX: clientX - rect.left + (scrollEl?.scrollLeft ?? 0),
						mouseY: clientY - rect.top + (scrollEl?.scrollTop ?? 0) - HEADER_HEIGHT,
					});
				}
				return;
			}

			if (!dragState) return;
			const dx = clientX - dragState.startMouseX;
			const dy = clientY - dragState.startMouseY;
			const daysMoved = Math.round(dx / colWidth);

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
			depDrag,
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
			handlePointerMove(e.clientX, e.clientY);
		},
		[handlePointerMove],
	);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			const touch = e.touches[0];
			handlePointerMove(touch.clientX, touch.clientY);
		},
		[handlePointerMove],
	);

	const handleMouseUp = useCallback(
		(e: React.MouseEvent) => {
			// Finish dependency drag
			if (depDrag) {
				// Check if mouse is over a task bar
				const target = document.elementFromPoint(e.clientX, e.clientY);
				const taskEl = target?.closest("[data-workitem]");
				if (taskEl) {
					const toItemId = taskEl.getAttribute("data-workitem");
					if (toItemId && toItemId !== depDrag.fromItemId) {
						addDependency(depDrag.fromItemId, toItemId);
					}
				}
				setDepDrag(null);
				return;
			}
			setDragState(null);
		},
		[depDrag, addDependency],
	);

	const handleMouseLeave = useCallback(() => {
		setDragState(null);
		setDepDrag(null);
	}, []);

	const handleTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			// Finish dependency drag on touch — same logic as handleMouseUp
			if (depDrag) {
				const touch = e.changedTouches[0];
				if (touch) {
					const target = document.elementFromPoint(touch.clientX, touch.clientY);
					const taskEl = target?.closest("[data-workitem]");
					if (taskEl) {
						const toItemId = taskEl.getAttribute("data-workitem");
						if (toItemId && toItemId !== depDrag.fromItemId) {
							addDependency(depDrag.fromItemId, toItemId);
						}
					}
				}
				setDepDrag(null);
				return;
			}
			setDragState(null);
		},
		[depDrag, addDependency],
	);

	const handleChartClick = useCallback(
		(e: React.MouseEvent) => {
			if ((e.target as HTMLElement).closest("[data-workitem]") === null) {
				setSelectedItemId(null);
			}
		},
		[setSelectedItemId],
	);

	/** Double-click on empty area to create a new task */
	const handleChartDoubleClick = useCallback(
		(e: React.MouseEvent) => {
			// Ignore if clicking on a task bar
			if ((e.target as HTMLElement).closest("[data-workitem]")) return;

			const scrollEl = scrollRef.current;
			if (!scrollEl) return;
			const rect = scrollEl.getBoundingClientRect();
			const x = e.clientX - rect.left + scrollEl.scrollLeft;
			const y = e.clientY - rect.top + scrollEl.scrollTop - HEADER_HEIGHT;

			// Determine which row
			const rowIndex = Math.floor(y / ROW_HEIGHT);
			const wsId = getWorkstreamAtRow(layout, rowIndex);
			if (!wsId) return;

			// Determine start date
			const clickDate = getDateAtX(x);
			const endDate = formatDate(addDays(parseDate(clickDate), 4));

			addWorkItem(wsId, "New Task", clickDate, endDate);
		},
		[layout, getDateAtX, addWorkItem],
	);

	const handleItemClick = useCallback(
		(itemId: string) => {
			if (dragState?.didDrag) return;
			setSelectedItemId(itemId === selectedItemId ? null : itemId);
		},
		[dragState, selectedItemId, setSelectedItemId],
	);

	const handleItemDoubleClick = useCallback(
		(itemId: string) => {
			setModalItemId(itemId);
		},
		[setModalItemId],
	);

	// Group columns by month
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
			onMouseLeave={handleMouseLeave}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onClick={handleChartClick}
			onDoubleClick={handleChartDoubleClick}
		>
			<div
				style={{ width: totalWidth, minHeight: totalHeight + HEADER_HEIGHT }}
				className="relative"
			>
				{/* Month header row */}
				<div
					className="sticky top-0 z-20 flex border-b border-border/70 bg-card/95 backdrop-blur-sm"
					style={{ height: HEADER_HEIGHT / 2 }}
				>
					{monthGroups.map((g) => (
						<div
							key={`${g.label}-${g.startIdx}`}
							className="flex items-center justify-center border-r border-border/50 font-display text-[11px] font-bold tracking-wide text-foreground"
							style={{ width: g.span * colWidth }}
						>
							{g.label}
						</div>
					))}
				</div>

				{/* Day/Week header row */}
				<div
					className="sticky z-20 flex border-b border-border/70 bg-card/95 backdrop-blur-sm"
					style={{ height: HEADER_HEIGHT / 2, top: HEADER_HEIGHT / 2 }}
				>
					{columns.map((col) => {
						const isToday = formatDate(col) === formatDate(new Date());
						return (
							<div
								key={formatDate(col)}
								className={`flex flex-col items-center justify-center border-r border-border/40 text-[10px] leading-tight ${
									isToday
										? "bg-primary/8 font-semibold text-primary"
										: "text-muted-foreground"
								}`}
								style={{ width: colWidth }}
							>
								{viewMode === "days" ? (
									<>
										<span>{formatDayName(col)}</span>
										<span className="font-medium">{col.getDate()}</span>
									</>
								) : (
									<span>{formatShortDate(col)}</span>
								)}
							</div>
						);
					})}
				</div>

				{/* Grid area */}
				<div className="relative" style={{ minHeight: totalHeight }}>
					{/* Row backgrounds */}
					{Array.from({ length: layout.totalRows }, (_, i) => (
						<div
							key={`row-bg-${i}`}
							className={`border-b border-border/30 ${i % 2 === 0 ? "bg-card" : "bg-muted/15"}`}
							style={{ height: ROW_HEIGHT }}
						/>
					))}

					{/* Workstream divider lines */}
					{layout.bands.slice(0, -1).map((band) => (
						<div
							key={`divider-${band.workstreamId}`}
							className="pointer-events-none absolute left-0 right-0 border-b border-border/50"
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
									className={`absolute top-0 bottom-0 ${
										isToday ? "border-r border-primary/20" : "border-r border-border/25"
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
									className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-primary/50"
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

					{/* Temporary dependency drag line */}
					{depDrag && (
						<svg
							className="pointer-events-none absolute inset-0"
							style={{
								width: Math.max(depDrag.fromX, depDrag.mouseX) + 30,
								height: Math.max(depDrag.fromY, depDrag.mouseY) + 30,
								zIndex: 20,
							}}
						>
							<line
								x1={depDrag.fromX}
								y1={depDrag.fromY}
								x2={depDrag.mouseX}
								y2={depDrag.mouseY}
								stroke="#3b82f6"
								strokeWidth={2}
								strokeDasharray="6 3"
								opacity={0.8}
							/>
							<circle
								cx={depDrag.mouseX}
								cy={depDrag.mouseY}
								r={4}
								fill="#3b82f6"
								opacity={0.8}
							/>
						</svg>
					)}

					{/* Work item bars */}
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
								isDraggingDep={depDrag !== null}
								onMouseDown={handleMouseDown}
								onClick={handleItemClick}
								onDoubleClick={handleItemDoubleClick}
								onConnectorDragStart={handleConnectorDragStart}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}
