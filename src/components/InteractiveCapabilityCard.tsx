import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp, TrendingUp, BookOpen, Video, Headphones, ExternalLink, Star, Send } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Resource = {
  id: string;
  title: string;
  description: string;
  content_type: string;
  external_url: string | null;
  rating: number | null;
  capability_level: string | null;
};

type CapabilityCardProps = {
  id: string;
  name: string;
  category: string;
  description: string;
  currentLevel: string;
  targetLevel: string;
  priority: number;
  aiReasoning: string | null;
  resources: Resource[];
  onRequestLevelChange: (capabilityId: string) => void;
  onResourceClick: (resourceId: string, url: string) => void;
};

const LEVEL_ORDER = ["beginner", "intermediate", "advanced", "expert"];
const LEVEL_COLORS = {
  beginner: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  intermediate: "bg-green-500/10 text-green-700 dark:text-green-400",
  advanced: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  expert: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export default function InteractiveCapabilityCard({
  id,
  name,
  category,
  description,
  currentLevel,
  targetLevel,
  priority,
  aiReasoning,
  resources,
  onRequestLevelChange,
  onResourceClick,
}: CapabilityCardProps) {
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  const getLevelColor = (level: string) => {
    return LEVEL_COLORS[level.toLowerCase() as keyof typeof LEVEL_COLORS] || "bg-muted";
  };

  const getLevelLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case "book":
        return <BookOpen className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "podcast":
        return <Headphones className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getLevelBorder = (level: string) => {
    const l = level.toLowerCase();
    switch (l) {
      case "beginner":
        return "border-blue-500";
      case "intermediate":
        return "border-green-500";
      case "advanced":
        return "border-orange-500";
      case "expert":
        return "border-purple-500";
      default:
        return "border-border";
    }
  };

  const isCurrentLevel = (level: string) => level.toLowerCase() === currentLevel.toLowerCase();

  return (
    <Card className="overflow-hidden">
      {/* Header with gradient background */}
      <div className={`p-6 pb-4 ${getLevelBorder(currentLevel)} border-t-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-foreground mb-1">{name}</h3>
            <p className="text-sm text-muted-foreground">{category}</p>
          </div>
          <Badge className={`${getLevelColor(currentLevel)} px-3 py-1.5 text-sm font-semibold whitespace-nowrap`}>
            Current: {getLevelLabel(currentLevel)}
          </Badge>
        </div>
      </div>

      {/* Matrix Grid */}
      <CardContent className="p-6 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {LEVEL_ORDER.map((level) => {
            const isCurrent = isCurrentLevel(level);
            const isExpanded = expandedLevel === level;
            
            return (
              <div key={level} className="flex flex-col">
                <button
                  onClick={() => setExpandedLevel(isExpanded ? null : level)}
                  className={`
                    relative rounded-lg border-2 p-4 text-left transition-all duration-200
                    ${isCurrent 
                      ? `${getLevelBorder(level)} bg-gradient-to-br from-card to-accent/10 shadow-md` 
                      : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge 
                      className={`${getLevelColor(level)} text-xs font-bold`}
                      variant={isCurrent ? "default" : "outline"}
                    >
                      {getLevelLabel(level)}
                    </Badge>
                    {isCurrent ? (
                      <div className="flex-shrink-0">
                        <TrendingUp className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                  
                  {isCurrent && (
                    <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                      {description}
                    </p>
                  )}
                  
                  {!isCurrent && !isExpanded && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Click to view details
                    </p>
                  )}
                </button>
                
                {/* Expanded level details */}
                {!isCurrent && isExpanded && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border animate-in slide-in-from-top-2">
                    <p className="text-sm text-foreground leading-relaxed">
                      {description}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Reasoning */}
        {aiReasoning && (
          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 mb-4">
            <div className="flex gap-3">
              <div className="text-lg flex-shrink-0">💡</div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-primary mb-1">Jericho's Insight</p>
                <p className="text-sm text-foreground/90 leading-relaxed">{aiReasoning}</p>
              </div>
            </div>
          </div>
        )}

        {/* Resources Grid */}
        {resources.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Resources
              </h4>
              <Badge variant="secondary" className="text-xs">{resources.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {resources.map((resource) => (
                <button
                  key={resource.id}
                  onClick={() => resource.external_url && onResourceClick(resource.id, resource.external_url)}
                  className="group inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  {getContentIcon(resource.content_type)}
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    {resource.content_type === "video" ? "YouTube" : "Podcast"}
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Request Level Change */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4 gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary"
          onClick={() => onRequestLevelChange(id)}
        >
          <Send className="h-4 w-4" />
          Request Level Change
        </Button>
      </CardContent>
    </Card>
  );
}
