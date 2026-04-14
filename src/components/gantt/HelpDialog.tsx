import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

// Single source of truth for the shortcut list. Keep in sync with the
// handlers in GanttEditor and the title="..." props around the app.
const SHORTCUT_GROUPS: {
	heading: string;
	rows: { keys: string[]; label: string }[];
}[] = [
	{
		heading: "Editing",
		rows: [
			{ keys: ["⌫"], label: "Delete selected task" },
			{ keys: ["Enter"], label: "Edit selected task title" },
			{ keys: ["Esc"], label: "Deselect / cancel edit" },
			{ keys: ["N"], label: "New workstream" },
		],
	},
	{
		heading: "View",
		rows: [
			{ keys: ["D"], label: "Day view" },
			{ keys: ["W"], label: "Week view" },
		],
	},
	{
		heading: "File",
		rows: [
			{ keys: ["⌘/Ctrl", "S"], label: "Save project (.gantarr.json)" },
			{ keys: ["⌘/Ctrl", "O"], label: "Load project" },
		],
	},
	{
		heading: "Help",
		rows: [{ keys: ["?"], label: "Show this dialog" }],
	},
];

const TIPS: string[] = [
	"Double-click an empty row to create a new task where you clicked.",
	"Drag a task to move, drag its edges to resize.",
	"Drag the dot on a task's right edge to draw a dependency arrow.",
	"Click the project name in the toolbar to rename it.",
	"Drop a .gantarr.json file anywhere on the page to load it.",
];

export default function HelpDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="font-display tracking-tight">
						Keyboard shortcuts
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-5">
					{SHORTCUT_GROUPS.map((group) => (
						<section key={group.heading}>
							<h4 className="mb-2 font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
								{group.heading}
							</h4>
							<ul className="space-y-1.5">
								{group.rows.map((row) => (
									<li
										key={row.label}
										className="flex items-center justify-between gap-4 text-sm"
									>
										<span className="text-foreground">{row.label}</span>
										<div className="flex items-center gap-1">
											{row.keys.map((key, idx) => (
												<kbd
													key={`${row.label}-${idx}`}
													className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground"
												>
													{key}
												</kbd>
											))}
										</div>
									</li>
								))}
							</ul>
						</section>
					))}

					<section>
						<h4 className="mb-2 font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
							Tips
						</h4>
						<ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
							{TIPS.map((tip) => (
								<li key={tip} className="flex gap-2">
									<span aria-hidden="true">›</span>
									<span>{tip}</span>
								</li>
							))}
						</ul>
					</section>
				</div>
			</DialogContent>
		</Dialog>
	);
}
