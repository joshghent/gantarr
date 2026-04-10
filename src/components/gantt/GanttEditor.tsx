import { useRef } from "react";
import { GanttProvider, useGantt } from "#/lib/gantt-context";
import { createProject } from "#/lib/gantt-store";
import GanttToolbar from "./GanttToolbar";
import GanttSidebar from "./GanttSidebar";
import GanttChart from "./GanttChart";
import ItemDetailPanel from "./ItemDetailPanel";
import LegendPanel from "./LegendPanel";
import TaskModal from "./TaskModal";

function GanttEditorInner() {
	const chartRef = useRef<HTMLDivElement>(null);
	const { selectedItemId, connectingFrom } = useGantt();

	return (
		<div className="flex h-screen flex-col">
			<GanttToolbar chartRef={chartRef} />
			<div className="flex flex-1 overflow-hidden">
				<div ref={chartRef} className="flex flex-1 overflow-hidden">
					<GanttSidebar />
					<div className="flex flex-1 flex-col overflow-hidden">
						<div
							className={`flex flex-1 overflow-hidden ${connectingFrom ? "cursor-crosshair" : ""}`}
						>
							<GanttChart />
						</div>
						<LegendPanel />
					</div>
				</div>
				{selectedItemId && <ItemDetailPanel />}
			</div>
			<TaskModal />
		</div>
	);
}

export default function GanttEditor() {
	const project = createProject("My Project");
	return (
		<GanttProvider initialProject={project}>
			<GanttEditorInner />
		</GanttProvider>
	);
}
