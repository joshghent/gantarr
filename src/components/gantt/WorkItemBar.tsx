import { memo, useEffect, useRef, useState } from "react";
import { useGantt } from "#/lib/gantt-context";
import { getItemColor } from "#/lib/gantt-layout";
import type { WorkItem } from "#/types";

interface WorkItemBarProps {
	item: WorkItem;
	x: number;
	y: number;
	width: number;
	height: number;
	isSelected: boolean;
	isConnecting: boolean;
	isConnectSource: boolean;
	onMouseDown: (
		e: React.MouseEvent | React.TouchEvent,
		itemId: string,
		type: "move" | "resize-start" | "resize-end",
	) => void;
	onClick: (itemId: string) => void;
	onDoubleClick: (itemId: string) => void;
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
	isConnecting,
	isConnectSource,
	onMouseDown,
	onClick,
	onDoubleClick,
}: WorkItemBarProps) {
	const { project, editingItemId, setEditingItemId, updateWorkItem, setModalItemId } =
		useGantt();
	const inputRef = useRef<HTMLInputElement>(null);
	const [titleDraft, setTitleDraft] = useState(item.title);

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

	const workstream = project.workstreams.find(
		(ws) => ws.id === item.workstreamId,
	);
	const color = getItemColor(item, workstream, project);

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
		// On touch devices, single tap opens modal directly
		if (isTouchDevice()) {
			setModalItemId(item.id);
			return;
		}
		// If already selected, start inline editing the title
		if (isSelected && !isEditing && !isConnecting) {
			setEditingItemId(item.id);
			return;
		}
		onClick(item.id);
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isConnecting) return;
		onDoubleClick(item.id);
	};

	return (
		<div
			data-workitem={item.id}
			className={`group absolute flex items-center rounded-full border text-xs font-medium shadow-sm transition-shadow select-none ${
				isSelected
					? "ring-2 ring-primary ring-offset-1 z-10"
					: isConnecting && !isConnectSource
						? "cursor-crosshair hover:ring-2 hover:ring-blue-400"
						: isConnectSource
							? "ring-2 ring-blue-500 z-10"
							: "hover:shadow-md cursor-grab active:cursor-grabbing"
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
				if (isConnecting || isEditing) return;
				onMouseDown(e, item.id, "move");
			}}
			onTouchStart={(e) => {
				if (isConnecting || isEditing) return;
				onMouseDown(e, item.id, "move");
			}}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
		>
			{/* Left resize handle */}
			{!isConnecting && !isEditing && (
				<div
					className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-l-full"
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
					className="mx-3 w-full bg-transparent outline-none placeholder:text-current/60"
					style={{ color: getContrastText(color) }}
				/>
			) : (
				<span className="truncate px-3">{item.title}</span>
			)}

			{/* Right resize handle */}
			{!isConnecting && !isEditing && (
				<div
					className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-r-full"
					onMouseDown={(e) => {
						e.stopPropagation();
						onMouseDown(e, item.id, "resize-end");
					}}
					onClick={(e) => e.stopPropagation()}
				/>
			)}
		</div>
	);
}

const WorkItemBar = memo(WorkItemBarInner);
export default WorkItemBar;

function getContrastText(hex: string): string {
	const rgb = hexToRgb(hex);
	if (!rgb) return "#ffffff";
	const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
	return luminance > 0.55 ? "#1a1a1a" : "#ffffff";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
			}
		: null;
}
