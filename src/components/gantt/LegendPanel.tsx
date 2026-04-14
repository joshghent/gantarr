import { useState } from "react";
import { Input } from "#/components/ui/input";
import { useGantt } from "#/lib/gantt-context";
import { Palette, Plus, Trash2, Check, X } from "lucide-react";

export default function LegendPanel() {
	const { project, addLegendEntry, updateLegendEntry, deleteLegendEntry } =
		useGantt();
	const [isAdding, setIsAdding] = useState(false);
	const [newLabel, setNewLabel] = useState("");
	const [newColor, setNewColor] = useState("#3b82f6");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");
	const [editColor, setEditColor] = useState("");

	const handleAdd = () => {
		if (newLabel.trim()) {
			addLegendEntry(newLabel.trim(), newColor);
			setNewLabel("");
			setNewColor("#3b82f6");
			setIsAdding(false);
		}
	};

	const startEdit = (id: string, label: string, color: string) => {
		setEditingId(id);
		setEditLabel(label);
		setEditColor(color);
	};

	const commitEdit = () => {
		if (editingId && editLabel.trim()) {
			updateLegendEntry(editingId, {
				label: editLabel.trim(),
				color: editColor,
			});
		}
		setEditingId(null);
	};

	return (
		<div className="border-t border-border bg-card px-4 py-2.5">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-1.5 font-display text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
					<Palette className="h-3 w-3" />
					Legend
				</div>
				<button
					type="button"
					onClick={() => setIsAdding(true)}
					className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
				>
					<Plus className="h-3.5 w-3.5" />
				</button>
			</div>

			<div className="flex flex-wrap gap-2">
				{project.legend.map((entry) =>
					editingId === entry.id ? (
						<div
							key={entry.id}
							className="flex items-center gap-1 rounded-md border border-border bg-background p-1"
						>
							<input
								type="color"
								value={editColor}
								onChange={(e) => setEditColor(e.target.value)}
								className="h-6 w-6 cursor-pointer rounded border-0 p-0"
							/>
							<Input
								value={editLabel}
								onChange={(e) => setEditLabel(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") commitEdit();
									if (e.key === "Escape") setEditingId(null);
								}}
								className="h-6 w-20 text-xs"
								autoFocus
							/>
							<button
								type="button"
								onClick={commitEdit}
								className="p-0.5 text-green-600"
							>
								<Check className="h-3 w-3" />
							</button>
							<button
								type="button"
								onClick={() => setEditingId(null)}
								className="p-0.5 text-muted-foreground"
							>
								<X className="h-3 w-3" />
							</button>
							<button
								type="button"
								onClick={() => {
									deleteLegendEntry(entry.id);
									setEditingId(null);
								}}
								className="p-0.5 text-destructive-foreground"
							>
								<Trash2 className="h-3 w-3" />
							</button>
						</div>
					) : (
						<button
							key={entry.id}
							type="button"
							onClick={() =>
								startEdit(entry.id, entry.label, entry.color)
							}
							className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
						>
							<span
								className="inline-block h-2.5 w-2.5 rounded-full"
								style={{ backgroundColor: entry.color }}
							/>
							{entry.label}
						</button>
					),
				)}

				{isAdding && (
					<div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
						<input
							type="color"
							value={newColor}
							onChange={(e) => setNewColor(e.target.value)}
							className="h-6 w-6 cursor-pointer rounded border-0 p-0"
						/>
						<Input
							value={newLabel}
							onChange={(e) => setNewLabel(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleAdd();
								if (e.key === "Escape") setIsAdding(false);
							}}
							placeholder="Label..."
							className="h-6 w-20 text-xs"
							autoFocus
						/>
						<button
							type="button"
							onClick={handleAdd}
							className="p-0.5 text-green-600"
						>
							<Check className="h-3 w-3" />
						</button>
						<button
							type="button"
							onClick={() => setIsAdding(false)}
							className="p-0.5 text-muted-foreground"
						>
							<X className="h-3 w-3" />
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
