import { List } from "lucide-react";
import { IGPRecommendation, IGPData } from "./igp-types";

interface IGPTableOfContentsProps {
  data: IGPData;
}

export function IGPTableOfContents({ data }: IGPTableOfContentsProps) {
  const sections = [
    { id: "igp-executive-summary", label: "Executive Summary" },
    ...(data.ai_recommendations.roadmap ? [{ id: "igp-roadmap", label: "90-Day Development Roadmap" }] : []),
    { id: "igp-capability-overview", label: "Capability Overview" },
    ...(data.diagnostic ? [{ id: "igp-diagnostic", label: "Diagnostic Assessment" }] : []),
  ];

  const capSections = (data.ai_recommendations.recommendations || []).map(r => ({
    id: `igp-cap-${r.capability_name.replace(/\s+/g, '-').toLowerCase()}`,
    label: r.capability_name,
  }));

  return (
    <div className="print:hidden sticky top-4">
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
          <a href="#igp-glossary" className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5">
            Glossary
          </a>
        </nav>
      </div>
    </div>
  );
}
