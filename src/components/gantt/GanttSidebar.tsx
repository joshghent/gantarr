import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "#/components/ui/input";
import { useGantt } from "#/lib/gantt-context";
import { buildLayout } from "#/lib/gantt-layout";
import { GripVertical, Plus, Trash2 } from "lucide-react";

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 48;

export default function GanttSidebar() {
	const {
		project,
		addWorkstream,
		updateWorkstream,
		deleteWorkstream,
		addWorkItem,
		setProject,
	} = useGantt();

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// Drag-to-reorder state
	const [dragWsId, setDragWsId] = useState<string | null>(null);
	const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const bandRectsRef = useRef<{ id: string; top: number; height: number }[]>(
		[],
	);

	useEffect(() => {
		if (editingId && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editingId]);

	const layout = buildLayout(project);
	const sortedWs = [...project.workstreams].sort((a, b) => a.order - b.order);

	const startEdit = (id: string, currentLabel: string) => {
		setEditingId(id);
		setEditValue(currentLabel);
	};

	const commitEdit = () => {
		if (editingId && editValue.trim()) {
			updateWorkstream(editingId, { label: editValue.trim() });
		}
		setEditingId(null);
	};

	const handleDelete = (wsId: string, label: string) => {
		const taskCount = project.workItems.filter(
			(wi) => wi.workstreamId === wsId,
		).length;
		const msg =
			taskCount > 0
				? `Delete "${label}" and its ${taskCount} task${taskCount > 1 ? "s" : ""}?`
				: `Delete "${label}"?`;
		if (window.confirm(msg)) {
			deleteWorkstream(wsId);
		}
	};

	// --- Drag-to-reorder handlers ---

	const handleGripMouseDown = useCallback(
		(e: React.MouseEvent, wsId: string) => {
			e.preventDefault();
			e.stopPropagation();

			if (containerRef.current) {
				const containerRect = containerRef.current.getBoundingClientRect();
				bandRectsRef.current = layout.bands.map((band) => ({
					id: band.workstreamId,
					top: containerRect.top + band.startRow * ROW_HEIGHT,
					height: band.span * ROW_HEIGHT,
				}));
			}
			setDragWsId(wsId);
		},
		[layout.bands],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!dragWsId) return;
			const mouseY = e.clientY;
			const bands = bandRectsRef.current;

			let targetIdx: number | null = null;
			for (let i = 0; i < bands.length; i++) {
				const mid = bands[i].top + bands[i].height / 2;
				if (mouseY < mid) {
					targetIdx = i;
					break;
				}
			}
			if (targetIdx === null) targetIdx = bands.length;

			const dragIdx = sortedWs.findIndex((ws) => ws.id === dragWsId);
			if (targetIdx === dragIdx || targetIdx === dragIdx + 1) {
				setDropTargetIdx(null);
			} else {
				setDropTargetIdx(targetIdx);
			}
		},
		[dragWsId, sortedWs],
	);

	const handleMouseUp = useCallback(() => {
		if (dragWsId && dropTargetIdx !== null) {
			const dragIdx = sortedWs.findIndex((ws) => ws.id === dragWsId);
			if (dragIdx !== -1) {
				const reordered = [...sortedWs];
				const [moved] = reordered.splice(dragIdx, 1);
				const insertAt =
					dropTargetIdx > dragIdx ? dropTargetIdx - 1 : dropTargetIdx;
				reordered.splice(insertAt, 0, moved);

				const updated = {
					...project,
					workstreams: reordered.map((ws, i) => ({ ...ws, order: i })),
					updatedAt: new Date().toISOString(),
				};
				setProject(updated);
			}
		}
		setDragWsId(null);
		setDropTargetIdx(null);
	}, [dragWsId, dropTargetIdx, sortedWs, project, setProject]);

	const getDropIndicatorTop = (): number | null => {
		if (dropTargetIdx === null) return null;
		if (dropTargetIdx >= layout.bands.length) {
			const lastBand = layout.bands[layout.bands.length - 1];
			return (lastBand.startRow + lastBand.span) * ROW_HEIGHT;
		}
		return layout.bands[dropTargetIdx].startRow * ROW_HEIGHT;
	};

	const dropIndicatorTop = getDropIndicatorTop();

	return (
		<div
			className="flex w-52 flex-shrink-0 flex-col border-r border-border bg-card"
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
		>
			{/* Header */}
			<div
				className="flex items-center border-b border-border px-3 font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
				style={{ height: HEADER_HEIGHT }}
			>
				Workstreams
			</div>

			<div
				ref={containerRef}
				className="relative flex-1 overflow-y-auto"
				style={{ minHeight: layout.totalRows * ROW_HEIGHT + 40 }}
			>
				{/* Workstream bands */}
				{layout.bands.map((band, bandIdx) => {
					const ws = project.workstreams.find(
						(w) => w.id === band.workstreamId,
					);
					if (!ws) return null;
					const top = band.startRow * ROW_HEIGHT;
					const height = band.span * ROW_HEIGHT;
					const isDragging = dragWsId === ws.id;

					return (
						<div
							key={ws.id}
							className={`group absolute left-0 right-0 flex flex-col ${isDragging ? "opacity-40" : ""}`}
							style={{
								top,
								height,
								backgroundColor: ws.color,
								borderBottom:
									bandIdx < layout.bands.length - 1
										? "2px solid rgba(0,0,0,0.15)"
										: undefined,
							}}
						>
							{/* Top bar: grip handle + actions */}
							<div className="flex items-center gap-0.5 px-1 pt-1">
								<div
									data-no-export="true"
									className="cursor-grab rounded p-0.5 text-white/50 hover:bg-white/20 hover:text-white active:cursor-grabbing"
									onMouseDown={(e) =>
										handleGripMouseDown(e, ws.id)
									}
									title="Drag to reorder"
								>
									<GripVertical className="h-3.5 w-3.5" />
								</div>

								<div className="flex-1" />

								<button
									type="button"
									data-no-export="true"
									onClick={() => addWorkItem(ws.id, "New Task")}
									className="flex items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/30"
									title="Add task"
								>
									<Plus className="h-3 w-3" />
									Task
								</button>
								<button
									type="button"
									data-no-export="true"
									onClick={() => handleDelete(ws.id, ws.label)}
									className="rounded bg-white/20 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/50"
									title="Delete workstream"
								>
									<Trash2 className="h-3 w-3" />
								</button>
							</div>

							{/* Label area — click to edit */}
							<div
								className="flex flex-1 cursor-text items-center px-3"
								onClick={() => startEdit(ws.id, ws.label)}
								title="Click to rename"
							>
								{editingId === ws.id ? (
									<Input
										ref={inputRef}
										value={editValue}
										onChange={(e) => setEditValue(e.target.value)}
										onBlur={commitEdit}
										onClick={(e) => e.stopPropagation()}
										onKeyDown={(e) => {
											if (e.key === "Enter") commitEdit();
											if (e.key === "Escape")
												setEditingId(null);
										}}
										className="h-7 bg-white/90 text-sm text-gray-900"
									/>
								) : (
									<span className="select-none font-display text-[13px] font-bold leading-tight tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
										{ws.label}
									</span>
								)}
							</div>
						</div>
					);
				})}

				{/* Drop indicator line */}
				{dragWsId && dropIndicatorTop !== null && (
					<div
						className="pointer-events-none absolute left-0 right-0 z-30"
						style={{ top: dropIndicatorTop - 2 }}
					>
						<div className="h-1 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]" />
					</div>
				)}

				{/* + Workstream button below the last band */}
				<button
					type="button"
					data-no-export="true"
					onClick={() => addWorkstream("New Workstream")}
					className="absolute left-0 right-0 flex items-center justify-center gap-1.5 border-t border-dashed border-border py-2.5 font-display text-[11px] font-semibold tracking-tight text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					style={{ top: layout.totalRows * ROW_HEIGHT }}
				>
					<Plus className="h-3.5 w-3.5" />
					Workstream
				</button>
			</div>
		</div>
	);
}

export { ROW_HEIGHT, HEADER_HEIGHT };
