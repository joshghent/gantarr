import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { RELEASE_NOTES } from "#/lib/release-notes";

export default function ReleaseNotesDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const mcpUrl = `${origin}/mcp`;
	const [copied, setCopied] = useState(false);

	const copyMcp = async () => {
		try {
			await navigator.clipboard.writeText(mcpUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard can be unavailable (e.g. insecure context); the URL is
			// still shown for manual copy, so there's nothing to recover.
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 font-display tracking-tight">
						<Sparkles className="h-4 w-4 text-primary" />
						What's new
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-5">
					{RELEASE_NOTES.map((note) => (
						<section key={note.version}>
							<h4 className="mb-2 flex items-baseline gap-2">
								<span className="font-display text-sm font-bold tracking-tight text-foreground">
									{note.title}
								</span>
								<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
									{note.date}
								</span>
							</h4>
							<ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
								{note.items.map((item) => (
									<li key={item} className="flex gap-2">
										<span aria-hidden="true" className="text-primary">
											›
										</span>
										<span>{item}</span>
									</li>
								))}
							</ul>
						</section>
					))}

					{/* Quick-connect box for AI clients. */}
					<div className="rounded-lg border border-border bg-muted/40 p-3">
						<p className="mb-2 font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
							Connect an AI client
						</p>
						<div className="flex items-center gap-2">
							<code className="flex-1 truncate rounded border border-border bg-card px-2 py-1 font-mono text-xs text-foreground">
								{mcpUrl}
							</code>
							<Button
								variant="outline"
								size="sm"
								className="shrink-0 text-xs"
								onClick={copyMcp}
								title="Copy MCP endpoint"
							>
								{copied ? (
									<Check className="h-3.5 w-3.5" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
							</Button>
						</div>
						<a
							href="/llms.txt"
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
						>
							View the AI guide (/llms.txt)
							<ExternalLink className="h-3 w-3" />
						</a>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
