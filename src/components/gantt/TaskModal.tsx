import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { useGantt } from "#/lib/gantt-context";
import { Trash2 } from "lucide-react";

export default function TaskModal() {
	const {
		project,
		modalItemId,
		setModalItemId,
		updateWorkItem,
		moveWorkItemToWorkstream,
		deleteWorkItem,
	} = useGantt();

	const item = project.workItems.find((wi) => wi.id === modalItemId);

	const [title, setTitle] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [workstreamId, setWorkstreamId] = useState("");
	const [legendEntryId, setLegendEntryId] = useState<string | null>(null);

	useEffect(() => {
		if (item) {
			setTitle(item.title);
			setStartDate(item.startDate);
			setEndDate(item.endDate);
			setWorkstreamId(item.workstreamId);
			setLegendEntryId(item.legendEntryId);
		}
	}, [item]);

	if (!item) return null;

	const handleSave = () => {
		if (!title.trim()) return;
		// Update title, dates, legend
		updateWorkItem(item.id, {
			title: title.trim(),
			startDate,
			endDate: endDate < startDate ? startDate : endDate,
			legendEntryId,
		});
		// If workstream changed, move it
		if (workstreamId !== item.workstreamId) {
			moveWorkItemToWorkstream(item.id, workstreamId);
		}
		setModalItemId(null);
	};

	const handleDelete = () => {
		deleteWorkItem(item.id);
	};

	return (
		<Dialog
			open={modalItemId !== null}
			onOpenChange={(open) => !open && setModalItemId(null)}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Task</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<Label htmlFor="task-title">Title</Label>
						<Input
							id="task-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSave();
							}}
							className="mt-1"
							autoFocus
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label htmlFor="task-start">Start date</Label>
							<Input
								id="task-start"
								type="date"
								value={startDate}
								onChange={(e) => {
									setStartDate(e.target.value);
									if (e.target.value > endDate) {
										setEndDate(e.target.value);
									}
								}}
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="task-end">End date</Label>
							<Input
								id="task-end"
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								min={startDate}
								className="mt-1"
							/>
						</div>
					</div>

					<div>
						<Label htmlFor="task-workstream">Workstream</Label>
						<select
							id="task-workstream"
							value={workstreamId}
							onChange={(e) => setWorkstreamId(e.target.value)}
							className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							{project.workstreams
								.slice()
								.sort((a, b) => a.order - b.order)
								.map((ws) => (
									<option key={ws.id} value={ws.id}>
										{ws.label}
									</option>
								))}
						</select>
					</div>

					<div>
						<Label>Category</Label>
						<div className="mt-1 flex flex-wrap gap-1.5">
							<button
								type="button"
								onClick={() => setLegendEntryId(null)}
								className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
									legendEntryId === null
										? "border-primary bg-primary/10 text-primary"
										: "border-border text-muted-foreground hover:border-foreground/30"
								}`}
							>
								Use workstream color
							</button>
							{project.legend.map((le) => (
								<button
									key={le.id}
									type="button"
									onClick={() => setLegendEntryId(le.id)}
									className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
										legendEntryId === le.id
											? "border-primary bg-primary/10 text-primary"
											: "border-border text-muted-foreground hover:border-foreground/30"
									}`}
								>
									<span
										className="inline-block h-2.5 w-2.5 rounded-full"
										style={{ backgroundColor: le.color }}
									/>
									{le.label}
								</button>
							))}
						</div>
					</div>
				</div>

				<DialogFooter className="flex !justify-between gap-2 sm:!justify-between">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleDelete}
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
					>
						<Trash2 className="mr-1 h-4 w-4" />
						Delete
					</Button>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setModalItemId(null)}
						>
							Cancel
						</Button>
						<Button size="sm" onClick={handleSave}>
							Save
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
