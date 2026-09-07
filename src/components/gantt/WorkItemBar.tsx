import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getContrastText } from "#/lib/colors";
import { useGantt } from "#/lib/gantt-context";
import { getItemColor } from "#/lib/gantt-layout";
import type { WorkItem } from "#/types";

/**
 * Minimum room to the right of a bar before we bother spilling the label
 * out there — below this an outside label is just an ellipsis, so the
 * title stays inside the bar instead.
 */
const MIN_OUTSIDE_LABEL_SPACE = 44;

interface WorkItemBarProps {
	item: WorkItem;
	x: number;
	y: number;
	width: number;
	height: number;
	isSelected: boolean;
	isDraggingDep: boolean;
	/** Free pixels between this bar's right edge and the next bar in its row. */
	labelSpaceRight: number;
	onMouseDown: (
		e: React.MouseEvent | React.TouchEvent,
		itemId: string,
		type: "move" | "resize-start" | "resize-end",
	) => void;
	onClick: (itemId: string) => void;
	onDoubleClick: (itemId: string) => void;
	onConnectorDragStart: (
		e: React.MouseEvent | React.TouchEvent,
		itemId: string,
	) => void;
}

function isTouchDevice(): boolean {
	if (typeof window === "undefined") return false;
	return (
		"ontouchstart" in window ||
		(typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
	);
}

function WorkItemBarInner({
	item,
	x,
	y,
	width,
	height,
	isSelected,
	isDraggingDep,
	labelSpaceRight,
	onMouseDown,
	onClick,
	onDoubleClick,
	onConnectorDragStart,
}: WorkItemBarProps) {
	const {
		project,
		editingItemId,
		setEditingItemId,
		updateWorkItem,
		setModalItemId,
	} = useGantt();
	const inputRef = useRef<HTMLInputElement>(null);
	const labelRef = useRef<HTMLSpanElement>(null);
	const [titleDraft, setTitleDraft] = useState(item.title);
	const [labelOverflows, setLabelOverflows] = useState(false);

	const isEditing = editingItemId === item.id;

	useEffect(() => {
		setTitleDraft(item.title);
	}, [item.title]);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	// Does the title fit inside the bar? Short tasks are only a column or
	// two wide, so their titles used to be cut down to an ellipsis (and in
	// exports, wrapped into an unreadable stack). Measure the label and, if
	// it doesn't fit, render it beside the bar instead. The measured span
	// stays in the DOM (hidden, not unmounted) so the measurement is stable
	// and can't oscillate between the two layouts. Runs on every render —
	// the title, the bar width and the font can all move it — and settles
	// immediately because an unchanged result doesn't re-render.
	useLayoutEffect(() => {
		const el = labelRef.current;
		if (!el) return;
		setLabelOverflows(el.scrollWidth > el.clientWidth + 1);
	});

	const workstream = project.workstreams.find(
		(ws) => ws.id === item.workstreamId,
	);
	const color = getItemColor(item, workstream, project);

	const showOutsideLabel =
		!isEditing && labelOverflows && labelSpaceRight >= MIN_OUTSIDE_LABEL_SPACE;

	const commitTitle = () => {
		if (titleDraft.trim()) {
			updateWorkItem(item.id, { title: titleDraft.trim() });
		} else {
			setTitleDraft(item.title);
		}
		setEditingItemId(null);
	};

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isTouchDevice()) {
			setModalItemId(item.id);
			return;
		}
		if (isSelected && !isEditing) {
			setEditingItemId(item.id);
			return;
		}
		onClick(item.id);
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDoubleClick(item.id);
	};

	return (
		<div
			data-workitem={item.id}
			data-export-ink="true"
			className={`group absolute flex items-center rounded-lg border text-xs font-medium transition-shadow select-none ${
				isSelected
					? "ring-2 ring-primary/70 ring-offset-1 z-10 shadow-sm"
					: isDraggingDep
						? "cursor-crosshair hover:ring-2 hover:ring-primary/50"
						: "hover:shadow-sm cursor-grab active:cursor-grabbing"
			}`}
			style={{
				left: x,
				top: y,
				width: Math.max(width, 24),
				height,
				backgroundColor: color,
				borderColor: `color-mix(in srgb, ${color} 80%, black)`,
				color: getContrastText(color),
			}}
			onMouseDown={(e) => {
				if (isEditing || isDraggingDep) return;
				onMouseDown(e, item.id, "move");
			}}
			onTouchStart={(e) => {
				if (isEditing) return;
				onMouseDown(e, item.id, "move");
			}}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
		>
			{/* Left resize handle */}
			{!isEditing && !isDraggingDep && (
				<div
					className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-black/8 rounded-l-lg"
					onMouseDown={(e) => {
						e.stopPropagation();
						onMouseDown(e, item.id, "resize-start");
					}}
					onClick={(e) => e.stopPropagation()}
				/>
			)}

			{isEditing ? (
				<input
					ref={inputRef}
					value={titleDraft}
					onChange={(e) => setTitleDraft(e.target.value)}
					onBlur={commitTitle}
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						if (e.key === "Enter") commitTitle();
						if (e.key === "Escape") {
							setTitleDraft(item.title);
							setEditingItemId(null);
						}
					}}
					className="mx-3 w-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-current/60"
					style={{ color: getContrastText(color) }}
				/>
			) : (
				<span
					ref={labelRef}
					data-export-clip="nowrap"
					className="min-w-0 flex-1 truncate whitespace-nowrap px-3"
					// Hidden rather than removed: the browser keeps laying it
					// out, so the overflow measurement above stays valid.
					style={showOutsideLabel ? { visibility: "hidden" } : undefined}
				>
					{item.title}
				</span>
			)}

			{/* Overflow label — sits to the right of a bar that's too narrow
			    for its own title, capped at the gap before the next task so
			    it never runs over its neighbour. */}
			{showOutsideLabel && (
				<span
					data-export-clip="nowrap"
					data-export-ink="true"
					className="pointer-events-none absolute top-1/2 -translate-y-1/2 truncate whitespace-nowrap text-foreground"
					style={{
						left: "100%",
						marginLeft: 10,
						maxWidth: Math.max(0, labelSpaceRight - 14),
					}}
					title={item.title}
				>
					{item.title}
				</span>
			)}

			{/* Right resize handle */}
			{!isEditing && !isDraggingDep && (
				<div
					className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-black/8 rounded-r-lg"
					onMouseDown={(e) => {
						e.stopPropagation();
						onMouseDown(e, item.id, "resize-end");
					}}
					onClick={(e) => e.stopPropagation()}
				/>
			)}

			{/* Connector port — drag from here to create a dependency.
			    Sits above the dependency-arrow layer (z-index 5) so an
			    existing arrow leaving this task can't swallow the drag
			    that would start the next one. */}
			{!isEditing && !isDraggingDep && (
				<div
					data-no-export="true"
					className="absolute -right-1.5 top-1/2 z-20 -translate-y-1/2 h-2.5 w-2.5 touch-none rounded-full border-2 border-white bg-muted-foreground opacity-70 group-hover:opacity-100 cursor-crosshair shadow-sm hover:bg-primary hover:scale-110 transition-all"
					onMouseDown={(e) => onConnectorDragStart(e, item.id)}
					onTouchStart={(e) => onConnectorDragStart(e, item.id)}
					onClick={(e) => e.stopPropagation()}
					title="Drag to link tasks"
				/>
			)}
		</div>
	);
}

const WorkItemBar = memo(WorkItemBarInner);
export default WorkItemBar;
