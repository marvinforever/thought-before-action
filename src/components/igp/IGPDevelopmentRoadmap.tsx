import { Calendar } from "lucide-react";
import { IGPAIRecommendations } from "./igp-types";

interface IGPDevelopmentRoadmapProps {
  roadmap: IGPAIRecommendations["roadmap"];
}

function RoadmapColumn({ title, subtitle, items, accentClass }: {
  title: string;
  subtitle: string;
  items: Array<{ action: string; capability: string; resource_type: string; time_per_week: string }>;
  accentClass: string;
}) {
  return (
    <div className="flex-1 rounded-lg border bg-card overflow-hidden">
      <div className={`p-3 ${accentClass}`}>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs opacity-80">{subtitle}</p>
      </div>
      <div className="p-3 space-y-3">
        {items.map((item, i) => (
          <div key={i} className="text-sm border-l-2 border-border pl-3">
            <p className="font-medium text-foreground">{item.action}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.capability}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-muted rounded px-1.5 py-0.5">{item.resource_type}</span>
              <span className="text-xs text-muted-foreground">{item.time_per_week}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No actions assigned</p>
        )}
      </div>
    </div>
  );
}

export function IGPDevelopmentRoadmap({ roadmap }: IGPDevelopmentRoadmapProps) {
  if (!roadmap) return null;

  return (
    <div className="space-y-4 print:break-inside-avoid" id="igp-roadmap">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold text-foreground">90-Day Development Roadmap</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RoadmapColumn
          title="Start Now"
          subtitle="Month 1"
          items={roadmap.month_1 || []}
          accentClass="bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300"
        />
        <RoadmapColumn
          title="Build On"
          subtitle="Month 2–3"
          items={roadmap.month_2_3 || []}
          accentClass="bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
        />
        <RoadmapColumn
          title="Sustain"
          subtitle="Month 3+"
          items={roadmap.month_3_plus || []}
          accentClass="bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300"
        />
      </div>
    </div>
  );
}
