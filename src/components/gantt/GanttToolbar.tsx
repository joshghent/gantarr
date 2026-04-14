import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useGantt } from "#/lib/gantt-context";
import { downloadJson, exportPdf, exportPng, loadJson } from "#/lib/export";
import {
	Download,
	FileDown,
	FileUp,
	Github,
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

	// --- Project name editing ---
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState(project.name);
	const nameInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setNameDraft(project.name);
	}, [project.name]);

	useEffect(() => {
		if (editingName && nameInputRef.current) {
			nameInputRef.current.focus();
			nameInputRef.current.select();
		}
	}, [editingName]);

	const commitName = () => {
		const trimmed = nameDraft.trim();
		if (trimmed && trimmed !== project.name) {
			setProject({
				...project,
				name: trimmed,
				updatedAt: new Date().toISOString(),
			});
		} else {
			setNameDraft(project.name);
		}
		setEditingName(false);
	};

	const cancelName = () => {
		setNameDraft(project.name);
		setEditingName(false);
	};

	const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const loaded = await loadJson(file);
			setProject(loaded);
		} catch (_err) {
			alert("Failed to load file. Make sure it's a valid .gantarr.json file.");
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleExportPng = async () => {
		if (!chartRef.current) return;
		await exportPng(chartRef.current, project.name);
	};

	const handleExportPdf = async () => {
		if (!chartRef.current) return;
		await exportPdf(chartRef.current, project.name);
	};

	return (
		<div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-1.5">
			{editingName ? (
				<Input
					ref={nameInputRef}
					value={nameDraft}
					onChange={(e) => setNameDraft(e.target.value)}
					onBlur={commitName}
					onKeyDown={(e) => {
						if (e.key === "Enter") commitName();
						if (e.key === "Escape") cancelName();
					}}
					className="h-7 w-56 font-display text-sm font-bold tracking-tight"
					maxLength={80}
				/>
			) : (
				<button
					type="button"
					onClick={() => setEditingName(true)}
					className="-mx-1 flex h-7 max-w-[14rem] items-center rounded-md px-2 font-display text-sm font-bold tracking-tight text-foreground transition-colors hover:bg-accent"
					title="Click to rename project"
				>
					<span className="truncate">{project.name}</span>
				</button>
			)}

			<div className="mx-1 h-5 w-px bg-border/60" />

			<Button
				variant="outline"
				size="sm"
				onClick={() => addWorkstream("New Workstream")}
				className="font-display text-xs font-semibold tracking-tight"
			>
				<Plus className="mr-1 h-3.5 w-3.5" />
				Workstream
			</Button>

			<div className="mx-1.5 h-5 w-px bg-border/60" />

			<div className="flex items-center rounded-md border border-border bg-muted/40">
				<button
					type="button"
					className={`px-3 py-1 font-display text-[11px] font-semibold tracking-tight transition-colors ${
						viewMode === "days"
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground"
					} rounded-l-md`}
					onClick={() => setViewMode("days")}
				>
					Days
				</button>
				<button
					type="button"
					className={`px-3 py-1 font-display text-[11px] font-semibold tracking-tight transition-colors ${
						viewMode === "weeks"
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground"
					} rounded-r-md`}
					onClick={() => setViewMode("weeks")}
				>
					Weeks
				</button>
			</div>

			<div className="ml-auto flex items-center gap-1">
				<Button variant="ghost" size="sm" className="text-xs" onClick={() => downloadJson(project)}>
					<Download className="mr-1 h-3.5 w-3.5" />
					Save
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="text-xs"
					onClick={() => fileInputRef.current?.click()}
				>
					<FileUp className="mr-1 h-3.5 w-3.5" />
					Load
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept=".json"
					className="hidden"
					onChange={handleLoad}
				/>

				<div className="mx-0.5 h-5 w-px bg-border/60" />

				<Button variant="ghost" size="sm" className="text-xs" onClick={handleExportPng}>
					<Image className="mr-1 h-3.5 w-3.5" />
					PNG
				</Button>
				<Button variant="ghost" size="sm" className="text-xs" onClick={handleExportPdf}>
					<FileDown className="mr-1 h-3.5 w-3.5" />
					PDF
				</Button>

				<div className="mx-0.5 h-5 w-px bg-border/60" />

				<a
					href="https://github.com/joshghent/gantarr"
					target="_blank"
					rel="noopener noreferrer"
					className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="View source on GitHub"
				>
					<Github className="h-3.5 w-3.5" />
				</a>

				<span
					className="ml-1 font-display text-[10px] font-medium tracking-tight text-muted-foreground/70 tabular-nums"
					title="Build time (UTC)"
				>
					{__BUILD_TIME__}
				</span>
			</div>
		</div>
	);
}
