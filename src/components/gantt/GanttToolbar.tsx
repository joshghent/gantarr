import {
	Download,
	Settings2,
	FileDown,
	FileUp,
	Github,
	HelpCircle,
	Image,
	Plus,
	Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { downloadJson, exportPdf, exportPng, loadJson } from "#/lib/export";
import { useGantt } from "#/lib/gantt-context";
import { resolveSprints } from "#/lib/sprints";

// Injected at build time by Vite's `define` (see vite.config.ts). Declared
// here because tsc's include globs don't pick up the ambient in env.d.ts.
declare const __BUILD_TIME__: string;

// Prefer "⌘" on macOS so the tooltips feel native. Server-rendered
// strings can't touch window so fall back to "Ctrl" there.
const MOD_KEY =
	typeof navigator !== "undefined" && /mac/i.test(navigator.platform)
		? "⌘"
		: "Ctrl";

export default function GanttToolbar({
	chartRef,
	onOpenHelp,
	onOpenWhatsNew,
}: {
	chartRef: React.RefObject<HTMLDivElement | null>;
	onOpenHelp: () => void;
	onOpenWhatsNew: () => void;
}) {
	const {
		project,
		viewMode,
		setViewMode,
		setProject,
		addWorkstream,
		markClean,
	} = useGantt();
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
			// A freshly-loaded project is our new baseline — batched
			// with setProject in the same event handler so React lands
			// on (project: loaded, isDirty: false) in a single render.
			markClean();
		} catch (_err) {
			alert("Failed to load file. Make sure it's a valid .gantarr.json file.");
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleSave = () => {
		downloadJson(project);
		markClean();
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
				title="Add workstream (N)"
			>
				<Plus className="mr-1 h-3.5 w-3.5" />
				Workstream
			</Button>

			<div className="mx-1.5 h-5 w-px bg-border/60" />

			<Segmented
				value={viewMode}
				onChange={setViewMode}
				options={[
					{ value: "days", label: "Days", title: "Day view (D)" },
					{ value: "weeks", label: "Weeks", title: "Week view (W)" },
					{ value: "sprints", label: "Sprints", title: "Sprint view (S)" },
				]}
			/>
			{viewMode === "sprints" && <SprintSettingsButton />}

			<div className="ml-auto flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					className="text-xs"
					onClick={handleSave}
					title={`Save project (${MOD_KEY}S)`}
				>
					<Download className="mr-1 h-3.5 w-3.5" />
					Save
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="text-xs"
					onClick={() => fileInputRef.current?.click()}
					title={`Load project (${MOD_KEY}O)`}
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

				<Button
					variant="ghost"
					size="sm"
					className="text-xs"
					onClick={handleExportPng}
					title="Export as PNG"
				>
					<Image className="mr-1 h-3.5 w-3.5" />
					PNG
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="text-xs"
					onClick={handleExportPdf}
					title="Export as PDF"
				>
					<FileDown className="mr-1 h-3.5 w-3.5" />
					PDF
				</Button>

				<div className="mx-0.5 h-5 w-px bg-border/60" />

				<button
					type="button"
					onClick={onOpenWhatsNew}
					className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="What's new"
				>
					<Sparkles className="h-3.5 w-3.5" />
				</button>

				<button
					type="button"
					onClick={onOpenHelp}
					className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="Keyboard shortcuts (?)"
				>
					<HelpCircle className="h-3.5 w-3.5" />
				</button>

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

/** Toolbar pill group where exactly one option is active. */
export function Segmented<T extends string>({
	value,
	onChange,
	options,
}: {
	value: T;
	onChange: (value: T) => void;
	options: { value: T; label: string; title: string }[];
}) {
	return (
		<div className="flex items-center rounded-md border border-border bg-muted/40">
			{options.map((opt, i) => (
				<button
					key={opt.value}
					type="button"
					className={`px-3 py-1 font-display text-[11px] font-semibold tracking-tight transition-colors ${
						value === opt.value
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground"
					} ${i === 0 ? "rounded-l-md" : ""} ${
						i === options.length - 1 ? "rounded-r-md" : ""
					}`}
					onClick={() => onChange(opt.value)}
					title={opt.title}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}

/** Sprint length and the day sprint 1 starts, saved with the project. */
function SprintSettingsButton() {
	const { project, setProject } = useGantt();
	const sprints = resolveSprints(project);

	const update = (changes: Partial<typeof sprints>) => {
		setProject({
			...project,
			sprints: { ...sprints, ...changes },
			updatedAt: new Date().toISOString(),
		});
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-7 items-center gap-1 rounded-md px-2 font-display text-[11px] font-semibold tracking-tight text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="Sprint settings"
				>
					<Settings2 className="h-3.5 w-3.5" />
					{sprints.lengthWeeks}w
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-60 space-y-3 p-3">
				<div>
					<p className="mb-1.5 text-xs font-medium">Sprint length</p>
					<Segmented
						value={String(sprints.lengthWeeks)}
						onChange={(v) => update({ lengthWeeks: Number(v) })}
						options={[1, 2, 3, 4].map((w) => ({
							value: String(w),
							label: `${w}w`,
							title: `${w} week${w > 1 ? "s" : ""}`,
						}))}
					/>
				</div>
				<label className="block">
					<span className="mb-1.5 block text-xs font-medium">
						Sprint 1 starts
					</span>
					<Input
						type="date"
						value={sprints.startDate}
						onChange={(e) => {
							if (e.target.value) update({ startDate: e.target.value });
						}}
						className="h-8 text-xs"
					/>
				</label>
			</PopoverContent>
		</Popover>
	);
}
