import { List } from "lucide-react";
import { IGPData } from "./igp-types";

interface IGPTableOfContentsProps {
  data: IGPData;
}

export function IGPTableOfContents({ data }: IGPTableOfContentsProps) {
  const sections = [
    { id: "igp-executive-summary", label: "Executive Summary" },
    ...(data.ai_recommendations?.roadmap ? [{ id: "igp-roadmap", label: "90-Day Development Roadmap" }] : []),
    { id: "igp-capability-overview", label: "Capability Overview" },
    ...(data.diagnostic ? [{ id: "igp-diagnostic", label: "Diagnostic Assessment" }] : []),
    ...(data.vision?.one_year_vision || data.vision?.three_year_vision ? [{ id: "igp-vision", label: "Professional Vision" }] : []),
  ];

  const capSections = (data.ai_recommendations?.recommendations || []).map(r => ({
    id: `igp-cap-${r.capability_name.replace(/\s+/g, '-').toLowerCase()}`,
    label: r.capability_name,
  }));

  const bottomSections = [
    ...(data.goals && data.goals.length > 0 ? [{ id: "igp-goals", label: "90-Day Goals" }] : []),
    ...(data.habits && data.habits.length > 0 ? [{ id: "igp-habits", label: "Habits & Streaks" }] : []),
    ...(data.achievements && data.achievements.length > 0 ? [{ id: "igp-achievements", label: "Achievements" }] : []),
    { id: "igp-glossary", label: "Glossary of Terms" },
  ];

  return (
    <div className="print:hidden sticky top-14">
      <div className="rounded-lg border bg-card p-4 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <List className="h-4 w-4" />
          Contents
        </div>
        <nav className="space-y-1">
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 truncate">
              {s.label}
            </a>
          ))}
          {capSections.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground pt-2">Capabilities</p>
              {capSections.map(s => (
                <a key={s.id} href={`#${s.id}`} className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 pl-2 truncate">
                  {s.label}
                </a>
              ))}
            </>
          )}
          {bottomSections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 truncate">
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
