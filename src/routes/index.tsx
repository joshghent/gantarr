import { createFileRoute } from "@tanstack/react-router";
import GanttEditor from "#/components/gantt/GanttEditor";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return <GanttEditor />;
}
