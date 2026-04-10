import { useState, useEffect } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { useGantt } from "#/lib/gantt-context";
import {
	ArrowRight,
	Link2,
	Trash2,
	X,
} from "lucide-react";

export default function ItemDetailPanel() {
	const {
		project,
		selectedItemId,
		setSelectedItemId,
		updateWorkItem,
		deleteWorkItem,
		connectingFrom,
		setConnectingFrom,
		deleteDependency,
	} = useGantt();

	const item = project.workItems.find((wi) => wi.id === selectedItemId);

	const [title, setTitle] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [legendEntryId, setLegendEntryId] = useState<string | null>(null);

	useEffect(() => {
		if (item) {
			setTitle(item.title);
			setStartDate(item.startDate);
			setEndDate(item.endDate);
			setLegendEntryId(item.legendEntryId);
		}
	}, [item]);

	if (!item) return null;

	const commitChanges = () => {
		updateWorkItem(item.id, {
			title: title.trim() || item.title,
			startDate,
			endDate,
			legendEntryId,
		});
	};

	const incomingDeps = project.dependencies.filter(
		(d) => d.toItemId === item.id,
	);
	const outgoingDeps = project.dependencies.filter(
		(d) => d.fromItemId === item.id,
	);

	return (
		<div className="w-72 flex-shrink-0 border-l border-border bg-card overflow-y-auto">
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<h3 className="text-sm font-semibold">Work Item</h3>
				<button
					type="button"
					onClick={() => setSelectedItemId(null)}
					className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			<div className="space-y-4 p-4">
				<div>
					<Label htmlFor="item-title" className="text-xs">
						Title
					</Label>
					<Input
						id="item-title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						onBlur={commitChanges}
						onKeyDown={(e) => {
							if (e.key === "Enter") commitChanges();
						}}
						className="mt-1 h-8 text-sm"
					/>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div>
						<Label htmlFor="item-start" className="text-xs">
							Start
						</Label>
						<Input
							id="item-start"
							type="date"
							value={startDate}
							onChange={(e) => {
								setStartDate(e.target.value);
								if (e.target.value > endDate) {
									setEndDate(e.target.value);
								}
							}}
							onBlur={commitChanges}
							className="mt-1 h-8 text-xs"
						/>
					</div>
					<div>
						<Label htmlFor="item-end" className="text-xs">
							End
						</Label>
						<Input
							id="item-end"
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							onBlur={commitChanges}
							min={startDate}
							className="mt-1 h-8 text-xs"
						/>
					</div>
				</div>

				<div>
					<Label className="text-xs">Category</Label>
					<div className="mt-1 flex flex-wrap gap-1.5">
						<button
							type="button"
							onClick={() => {
								setLegendEntryId(null);
								updateWorkItem(item.id, { legendEntryId: null });
							}}
							className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
								legendEntryId === null
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-muted-foreground hover:border-foreground/30"
							}`}
						>
							None
						</button>
						{project.legend.map((le) => (
							<button
								key={le.id}
								type="button"
								onClick={() => {
									setLegendEntryId(le.id);
									updateWorkItem(item.id, {
										legendEntryId: le.id,
									});
								}}
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

				<div>
					<Label className="text-xs">Dependencies</Label>
					<div className="mt-1 space-y-1">
						{incomingDeps.map((dep) => {
							const fromItem = project.workItems.find(
								(wi) => wi.id === dep.fromItemId,
							);
							return (
								<div
									key={dep.id}
									className="flex items-center gap-1 rounded bg-muted/50 px-2 py-1 text-xs"
								>
									<ArrowRight className="h-3 w-3 text-muted-foreground" />
									<span className="flex-1 truncate">
										{fromItem?.title || "Unknown"} → this
									</span>
									<button
										type="button"
										onClick={() => deleteDependency(dep.id)}
										className="text-destructive-foreground hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							);
						})}
						{outgoingDeps.map((dep) => {
							const toItem = project.workItems.find(
								(wi) => wi.id === dep.toItemId,
							);
							return (
								<div
									key={dep.id}
									className="flex items-center gap-1 rounded bg-muted/50 px-2 py-1 text-xs"
								>
									<ArrowRight className="h-3 w-3 text-muted-foreground" />
									<span className="flex-1 truncate">
										this → {toItem?.title || "Unknown"}
									</span>
									<button
										type="button"
										onClick={() => deleteDependency(dep.id)}
										className="text-destructive-foreground hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							);
						})}
					</div>
					<Button
						variant="outline"
						size="sm"
						className="mt-2 w-full text-xs"
						onClick={() => {
							if (connectingFrom === item.id) {
								setConnectingFrom(null);
							} else {
								setConnectingFrom(item.id);
							}
						}}
					>
						<Link2 className="mr-1 h-3 w-3" />
						{connectingFrom === item.id
							? "Click target item..."
							: "Add Dependency"}
					</Button>
				</div>

				<div className="border-t border-border pt-4">
					<Button
						variant="destructive"
						size="sm"
						className="w-full text-xs"
						onClick={() => deleteWorkItem(item.id)}
					>
						<Trash2 className="mr-1 h-3 w-3" />
						Delete Item
					</Button>
				</div>
			</div>
		</div>
	);
}
