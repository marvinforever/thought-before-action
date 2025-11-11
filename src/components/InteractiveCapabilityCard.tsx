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
  const [isOpen, setIsOpen] = useState(false);

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

  const getLevelBgColor = (level: string) => {
    const l = level.toLowerCase();
    switch (l) {
      case "beginner":
        return "bg-blue-500/20 border-blue-500/30";
      case "intermediate":
        return "bg-green-500/20 border-green-500/30";
      case "advanced":
        return "bg-orange-500/20 border-orange-500/30";
      case "expert":
        return "bg-purple-500/20 border-purple-500/30";
      default:
        return "bg-muted border-border";
    }
  };

  const isCurrentLevel = (level: string) => level.toLowerCase() === currentLevel.toLowerCase();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-card to-card/50">
        <CardHeader className="pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{category}</p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full hover:bg-primary/10">
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-primary" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-primary" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Current Level Badge */}
          <div className="flex items-center gap-2">
            <Badge className={`${getLevelColor(currentLevel)} px-3 py-1 text-xs font-medium`} variant="outline">
              Current: {getLevelLabel(currentLevel)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-0">
          {/* Level Cards Grid */}
          <div className="grid gap-3">
            {LEVEL_ORDER.map((level) => {
              const isCurrent = isCurrentLevel(level);
              return (
                <div
                  key={level}
                  className={`
                    relative rounded-lg border-2 p-4 transition-all duration-300
                    ${isCurrent 
                      ? `${getLevelBgColor(level)} shadow-md scale-[1.02]` 
                      : 'bg-card/50 border-border/50 opacity-60'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      className={`${getLevelColor(level)} font-semibold`}
                      variant={isCurrent ? "default" : "outline"}
                    >
                      {getLevelLabel(level)}
                    </Badge>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Current Level
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {description}
                  </p>
                </div>
              );
            })}
          </div>

          <CollapsibleContent className="space-y-4">
            {/* AI Reasoning */}
            {aiReasoning && (
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
                <div className="flex gap-2">
                  <div className="text-lg">💡</div>
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Jericho's Insight</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{aiReasoning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Resources Section */}
            {resources.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Learning Resources ({resources.length})
                </h4>
                <div className="grid gap-2">
                  {resources.map((resource) => (
                    <div
                      key={resource.id}
                      className="group border rounded-lg p-3 space-y-2 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                      onClick={() => resource.external_url && onResourceClick(resource.id, resource.external_url)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          {getContentIcon(resource.content_type)}
                          <span className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                            {resource.title}
                          </span>
                        </div>
                        {resource.rating && (
                          <div className="flex items-center gap-1 text-xs flex-shrink-0">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{resource.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      {resource.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
                          {resource.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request Level Change Button */}
            <Button
              variant="default"
              size="sm"
              className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              onClick={() => onRequestLevelChange(id)}
            >
              <Send className="h-4 w-4" />
              Request Level Change
            </Button>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
