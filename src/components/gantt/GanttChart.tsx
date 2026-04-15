import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useGantt } from "#/lib/gantt-context";
import {
	addDays,
	daysBetween,
	formatDate,
	formatDayName,
	formatMonthYear,
	formatShortDate,
	getDays,
	getWeeks,
	parseDate,
} from "#/lib/dates";
import { buildLayout, getTaskRowIndex } from "#/lib/gantt-layout";
import { ROW_HEIGHT, HEADER_HEIGHT } from "./GanttSidebar";
import WorkItemBar from "./WorkItemBar";
import DependencyArrows from "./DependencyArrows";

const COL_WIDTH_DAY = 36;
const COL_WIDTH_WEEK = 112; // 16px per day × 7 — keeps the math clean

export default function GanttChart() {
	const {
		project,
		viewMode,
		addWorkItem,
		selectedItemId,
		setSelectedItemId,
		addDependency,
		setModalItemId,
		setProject,
	} = useGantt();
	const scrollRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);

	const layout = useMemo(() => buildLayout(project), [project]);

	// Measure the scrollable container so we can extend the date range
	// far enough that the chart always fills the viewport on initial
	// load (no awkward empty right margin). Re-measures on resize.
	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		setContainerWidth(el.clientWidth);
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerWidth(entry.contentRect.width);
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// Calculate date range from all work items, with padding. Then
	// extend the end date until we have enough columns to fill the
	// visible width of the chart area.
	const { startDate, columns } = useMemo(() => {
		let start: Date;
		let end: Date;

		if (project.workItems.length === 0) {
			const today = new Date();
			start = addDays(today, -14);
			end = addDays(today, 60);
		} else {
			let minDate = new Date(8640000000000000);
			let maxDate = new Date(-8640000000000000);
			for (const item of project.workItems) {
				const s = parseDate(item.startDate);
				const e = parseDate(item.endDate);
				if (s < minDate) minDate = s;
				if (e > maxDate) maxDate = e;
			}
			start = addDays(minDate, -7);
			end = addDays(maxDate, 30);
		}

		const colW = viewMode === "days" ? COL_WIDTH_DAY : COL_WIDTH_WEEK;
		const buildCols = (s: Date, e: Date) =>
			viewMode === "weeks" ? getWeeks(s, e) : getDays(s, e);

		let cols = buildCols(start, end);

		// Pad to fill the viewport. Loop is bounded by minCols so it
		// always terminates; each iteration adds a week of calendar days.
		if (containerWidth > 0) {
			const minCols = Math.ceil(containerWidth / colW);
			let guard = 0;
			while (cols.length < minCols && guard < 200) {
				end = addDays(end, 7);
				cols = buildCols(start, end);
				guard++;
			}
		}

		// Pin the chart origin to columns[0] so every pixel calculation
		// agrees with what's actually rendered. In week view that's the
		// Monday of the first week (getWeeks rounds to Monday); in day
		// view it's the first day.
		return { startDate: cols[0] ?? start, columns: cols };
	}, [project.workItems, viewMode, containerWidth]);

	const colWidth = viewMode === "days" ? COL_WIDTH_DAY : COL_WIDTH_WEEK;
	// One calendar day's pixel width. In day view a column IS a day,
	// so they're equal. In week view a column is seven days, so days
	// are a seventh the width. Both layouts then share a single
	// positioning formula: `daysFromStart * dayWidth`.
	const dayWidth = viewMode === "days" ? colWidth : colWidth / 7;
	const totalWidth = columns.length * colWidth;
	const totalHeight = Math.max(layout.totalRows, 1) * ROW_HEIGHT;

	// Get x position for a date — the left edge of its slot.
	// Day view: one slot = one calendar day.
	// Week view: one slot = one calendar week (the task snaps to the
	// Monday of the week that contains `date`).
	const getX = useCallback(
		(dateStr: string): number => {
			const date = parseDate(dateStr);
			const d = daysBetween(startDate, date);
			if (viewMode === "weeks") {
				const weekIndex = Math.max(0, Math.floor(d / 7));
				return weekIndex * colWidth;
			}
			return Math.max(0, d * dayWidth);
		},
		[startDate, dayWidth, colWidth, viewMode],
	);

	/** Inverse of getX: given an x pixel offset, return the date at that slot. */
	const getDateAtX = useCallback(
		(x: number): string => {
			if (viewMode === "weeks") {
				const weekIndex = Math.max(0, Math.round(x / colWidth));
				return formatDate(addDays(startDate, weekIndex * 7));
			}
			const d = Math.max(0, Math.round(x / dayWidth));
			return formatDate(addDays(startDate, d));
		},
		[dayWidth, colWidth, startDate, viewMode],
	);

	// Width of a task bar in pixels.
	// Day view: days covered × dayWidth.
	// Week view: whole weeks from the start's week to the end's week ×
	// colWidth, so a task always fills full week columns.
	const getItemWidth = useCallback(
		(item: { startDate: string; endDate: string }): number => {
			const s = parseDate(item.startDate);
			const e = parseDate(item.endDate);
			if (viewMode === "weeks") {
				const startDays = Math.max(0, daysBetween(startDate, s));
				const endDays = Math.max(0, daysBetween(startDate, e));
				const weeksCovered = Math.max(
					1,
					Math.floor(endDays / 7) - Math.floor(startDays / 7) + 1,
				);
				return weeksCovered * colWidth;
			}
			const daysCovered = Math.max(1, daysBetween(s, e) + 1);
			return daysCovered * dayWidth;
		},
		[startDate, dayWidth, colWidth, viewMode],
	);

	// --- Task drag state ---
	// Dragging is a pure *visual* preview — we never touch project state
	// until mouseup, so buildLayout doesn't re-run and the other bars
	// don't re-render. offsetX/offsetY are pixel deltas already snapped
	// to the grid, applied to the dragged bar's position in the render.
	const [dragState, setDragState] = useState<{
		itemId: string;
		type: "move" | "resize-start" | "resize-end";
		startMouseX: number;
		startMouseY: number;
		originalStartDate: string;
		originalEndDate: string;
		originalRowIndex: number;
		offsetX: number;
		offsetY: number;
		didDrag: boolean;
	} | null>(null);

	// Stable mirror of dragState for use inside memoized callbacks that
	// must NOT re-create when dragState changes (otherwise React.memo on
	// WorkItemBar would fail and every bar re-renders each drag frame).
	const dragStateRef = useRef(dragState);
	dragStateRef.current = dragState;

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
				offsetX: 0,
				offsetY: 0,
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

			const rawDx = clientX - dragState.startMouseX;
			const rawDy = clientY - dragState.startMouseY;

			// Snap to grid — the dragged bar visually jumps day-by-day
			// (and row-by-row for move drags), matching the discrete
			// nature of Gantt data. State only updates when the snap
			// boundary is crossed, so most mouse moves are free.
			const snappedX = Math.round(rawDx / colWidth) * colWidth;
			const snappedY =
				dragState.type === "move"
					? Math.round(rawDy / ROW_HEIGHT) * ROW_HEIGHT
					: 0;

			const didDrag =
				dragState.didDrag || Math.abs(rawDx) > 4 || Math.abs(rawDy) > 4;

			if (
				didDrag === dragState.didDrag &&
				snappedX === dragState.offsetX &&
				snappedY === dragState.offsetY
			) {
				return;
			}

			setDragState({
				...dragState,
				offsetX: snappedX,
				offsetY: snappedY,
				didDrag,
			});
		},
		[depDrag, dragState, colWidth],
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

	const commitDrag = useCallback(
		(d: NonNullable<typeof dragState>) => {
			if (!d.didDrag) return;

			const columnsMoved = Math.round(d.offsetX / colWidth);
			const rowsMoved = Math.round(d.offsetY / ROW_HEIGHT);
			if (columnsMoved === 0 && rowsMoved === 0) return;

			const item = project.workItems.find((wi) => wi.id === d.itemId);
			if (!item) return;

			const origStart = parseDate(d.originalStartDate);
			const origEnd = parseDate(d.originalEndDate);

			// Day view: 1 column = 1 calendar day. Week view: 1 column =
			// 7 calendar days.
			const daysPerColumn = viewMode === "weeks" ? 7 : 1;
			const daysMoved = columnsMoved * daysPerColumn;

			// Compute the new state for the dragged task.
			let newStart = origStart;
			let newEnd = origEnd;
			let newWsId = item.workstreamId;
			let newLane: number | undefined;

			if (d.type === "move") {
				newStart = addDays(origStart, daysMoved);
				newEnd = addDays(origEnd, daysMoved);
				if (rowsMoved !== 0) {
					const targetRowIndex = d.originalRowIndex + rowsMoved;
					const targetBand = layout.bands.find(
						(b) =>
							targetRowIndex >= b.startRow &&
							targetRowIndex < b.startRow + b.span,
					);
					if (targetBand) {
						newWsId = targetBand.workstreamId;
						newLane = targetRowIndex - targetBand.startRow;
					}
				}
			} else if (d.type === "resize-end") {
				newEnd = addDays(origEnd, daysMoved);
				if (newEnd < origStart) newEnd = origStart;
			} else if (d.type === "resize-start") {
				newStart = addDays(origStart, daysMoved);
				if (newStart > origEnd) newStart = origEnd;
			}

			// If we didn't get an explicit target lane (horizontal-only
			// move, or a resize), pin the dragged task to its current
			// lane so the packer can't slide it elsewhere.
			if (newLane === undefined) {
				const origBand = layout.bands.find(
					(b) => b.workstreamId === item.workstreamId,
				);
				if (origBand) newLane = d.originalRowIndex - origBand.startRow;
			}

			// Freeze implicit-lane tasks in every workstream this drag
			// touches, so the greedy packer doesn't reshuffle them onto
			// different rows just because this task's dates or lane
			// changed. Without this, dragging A horizontally past B
			// would collapse them onto the same lane, "pulling" B up.
			const affectedWsIds = new Set<string>([item.workstreamId, newWsId]);
			const nextWorkItems = project.workItems.map((wi) => {
				if (wi.id === item.id) {
					return {
						...wi,
						workstreamId: newWsId,
						startDate: formatDate(newStart),
						endDate: formatDate(newEnd),
						...(newLane !== undefined ? { lane: newLane } : {}),
					};
				}
				if (affectedWsIds.has(wi.workstreamId) && wi.lane === undefined) {
					const currentRow = getTaskRowIndex(layout, wi.id);
					const itemBand = layout.bands.find(
						(b) => b.workstreamId === wi.workstreamId,
					);
					if (itemBand && currentRow >= 0) {
						return { ...wi, lane: currentRow - itemBand.startRow };
					}
				}
				return wi;
			});

			setProject({
				...project,
				workItems: nextWorkItems,
				updatedAt: new Date().toISOString(),
			});
		},
		[colWidth, viewMode, project, layout, setProject],
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
			if (dragState) {
				commitDrag(dragState);
				setDragState(null);
			}
		},
		[depDrag, addDependency, dragState, commitDrag],
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
			if (dragState) {
				commitDrag(dragState);
				setDragState(null);
			}
		},
		[depDrag, addDependency, dragState, commitDrag],
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

			// Determine which row — and therefore which workstream and
			// which lane within it. The clicked lane becomes the new
			// task's explicit `lane`, so the layout doesn't pack it
			// onto the first available row.
			const rowIndex = Math.floor(y / ROW_HEIGHT);
			const band = layout.bands.find(
				(b) => rowIndex >= b.startRow && rowIndex < b.startRow + b.span,
			);
			if (!band) return;
			const wsId = band.workstreamId;
			const lane = rowIndex - band.startRow;

			// Default duration is 4 calendar days (a 5-day task).
			const clickDate = getDateAtX(x);
			const endDate = formatDate(addDays(parseDate(clickDate), 4));

			addWorkItem(wsId, "New Task", clickDate, endDate, undefined, lane);
		},
		[layout, getDateAtX, addWorkItem],
	);

	const handleItemClick = useCallback(
		(itemId: string) => {
			// Read dragState through a ref so this callback stays stable
			// during a drag — otherwise every WorkItemBar would re-render
			// on each drag frame because its onClick prop changed.
			if (dragStateRef.current?.didDrag) return;
			setSelectedItemId(itemId === selectedItemId ? null : itemId);
		},
		[selectedItemId, setSelectedItemId],
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
						// In day view "today" is an exact-date match. In
						// week view it's whichever week column contains
						// today — the Monday in columns[i] covers that
						// Monday through Sunday.
						const now = new Date();
						const isToday =
							viewMode === "days"
								? formatDate(col) === formatDate(now)
								: now >= col && now <= addDays(col, 6);
						const day = col.getDay();
						const isWeekend =
							viewMode === "days" && (day === 0 || day === 6);
						return (
							<div
								key={formatDate(col)}
								className={`flex flex-col items-center justify-center border-r border-border/40 text-[10px] leading-tight ${
									isToday
										? "bg-primary/8 font-semibold text-primary"
										: isWeekend
											? "bg-emerald-500/[0.08] text-emerald-700/70"
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

					{/* Weekend column tint — only in day view where each
					    column is one calendar day, so we can tint the
					    Sat/Sun columns and let everything align naturally. */}
					{viewMode === "days" && (
						<div className="pointer-events-none absolute inset-0">
							{columns.map((col, i) => {
								const day = col.getDay();
								if (day !== 0 && day !== 6) return null;
								return (
									<div
										key={`weekend-${formatDate(col)}`}
										className="absolute top-0 bottom-0 bg-emerald-500/[0.07]"
										style={{ left: i * colWidth, width: colWidth }}
									/>
								);
							})}
						</div>
					)}

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

					{/* Today line — uses direct day-diff math rather than
					    getX so the line lands on today's actual position,
					    not the week column's snapped left edge. */}
					{(() => {
						const now = new Date();
						const daysFromStart = daysBetween(startDate, now);
						if (daysFromStart < 0) return null;
						const todayX = daysFromStart * dayWidth + dayWidth / 2;
						if (todayX > totalWidth) return null;
						return (
							<div
								className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-primary/50"
								style={{ left: todayX }}
							/>
						);
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
						let x = getX(item.startDate);
						let width = getItemWidth(item);
						let y = rowIndex * ROW_HEIGHT + 6;

						// Drag preview — only the dragged bar's numbers
						// change, so every other WorkItemBar stays shallow-
						// equal and React.memo skips it.
						if (dragState?.itemId === item.id && dragState.didDrag) {
							if (dragState.type === "move") {
								x += dragState.offsetX;
								y += dragState.offsetY;
							} else if (dragState.type === "resize-end") {
								width = Math.max(colWidth, width + dragState.offsetX);
							} else if (dragState.type === "resize-start") {
								x += dragState.offsetX;
								width = Math.max(colWidth, width - dragState.offsetX);
							}
						}

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
