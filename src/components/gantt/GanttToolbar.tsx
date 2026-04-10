import { useRef } from "react";
import { Button } from "#/components/ui/button";
import { useGantt } from "#/lib/gantt-context";
import { downloadJson, exportPdf, exportPng, loadJson } from "#/lib/export";
import {
	Download,
	FileDown,
	FileUp,
	Image,
	Plus,
} from "lucide-react";

export default function GanttToolbar({
	chartRef,
}: {
	chartRef: React.RefObject<HTMLDivElement | null>;
}) {
	const { project, viewMode, setViewMode, setProject, addWorkstream } =
		useGantt();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const loaded = await loadJson(file);
			setProject(loaded);
		} catch (err) {
			alert("Failed to load file. Make sure it's a valid .gantarr.json file.");
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleExportPng = async () => {
		if (!chartRef.current) return;
		await exportPng(
			chartRef.current,
			project.name.replace(/\s+/g, "-").toLowerCase(),
		);
	};

	const handleExportPdf = async () => {
		if (!chartRef.current) return;
		await exportPdf(
			chartRef.current,
			project.name.replace(/\s+/g, "-").toLowerCase(),
		);
	};

	return (
		<div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
			<Button
				variant="outline"
				size="sm"
				onClick={() => addWorkstream("New Workstream")}
			>
				<Plus className="mr-1 h-4 w-4" />
				Workstream
			</Button>

			<div className="mx-2 h-6 w-px bg-border" />

			<div className="flex items-center rounded-md border border-border">
				<button
					type="button"
					className={`px-3 py-1.5 text-xs font-medium transition-colors ${
						viewMode === "days"
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:text-foreground"
					} rounded-l-md`}
					onClick={() => setViewMode("days")}
				>
					Days
				</button>
				<button
					type="button"
					className={`px-3 py-1.5 text-xs font-medium transition-colors ${
						viewMode === "weeks"
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:text-foreground"
					} rounded-r-md`}
					onClick={() => setViewMode("weeks")}
				>
					Weeks
				</button>
			</div>

			<div className="ml-auto flex items-center gap-2">
				<Button variant="ghost" size="sm" onClick={() => downloadJson(project)}>
					<Download className="mr-1 h-4 w-4" />
					Save
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => fileInputRef.current?.click()}
				>
					<FileUp className="mr-1 h-4 w-4" />
					Load
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept=".json"
					className="hidden"
					onChange={handleLoad}
				/>

				<div className="mx-1 h-6 w-px bg-border" />

				<Button variant="ghost" size="sm" onClick={handleExportPng}>
					<Image className="mr-1 h-4 w-4" />
					PNG
				</Button>
				<Button variant="ghost" size="sm" onClick={handleExportPdf}>
					<FileDown className="mr-1 h-4 w-4" />
					PDF
				</Button>
			</div>
		</div>
	);
}
