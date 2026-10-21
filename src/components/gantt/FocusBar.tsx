import { ChevronRight, X } from "lucide-react";
import { useGantt } from "#/lib/gantt-context";

/**
 * Breadcrumb shown while drilled into one project's tasks. Only renders
 * in that state, so the chart keeps its full height the rest of the time.
 */
export default function FocusBar() {
	const { focusGroup, setFocusGroup, setViewLevel } = useGantt();
	if (focusGroup === null) return null;

	return (
		<div
			data-no-export="true"
			className="flex items-center gap-1 border-b border-border bg-card px-3 py-1 font-display text-[11px] font-semibold tracking-tight"
		>
			<button
				type="button"
				onClick={() => setViewLevel("projects")}
				className="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				title="Back to all projects"
			>
				All projects
			</button>
			<ChevronRight className="h-3 w-3 text-muted-foreground" />
			<span className="truncate px-1 text-foreground">{focusGroup}</span>
			<button
				type="button"
				onClick={() => setFocusGroup(null)}
				className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				title="Show every task (Esc)"
			>
				<X className="h-3 w-3" />
				Show all tasks
			</button>
		</div>
	);
}
