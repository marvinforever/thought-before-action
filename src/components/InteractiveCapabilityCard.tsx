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

  const calculateProgress = () => {
    const currentIndex = LEVEL_ORDER.indexOf(currentLevel.toLowerCase());
    const targetIndex = LEVEL_ORDER.indexOf(targetLevel.toLowerCase());
    if (currentIndex === -1 || targetIndex === -1) return 0;
    if (currentIndex >= targetIndex) return 100;
    return Math.round((currentIndex / targetIndex) * 100);
  };

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

  const progress = calculateProgress();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-primary hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base">{name}</CardTitle>
                <Badge variant="outline" className="text-xs">P{priority}</Badge>
              </div>
              <Badge variant="secondary" className="text-xs">{category}</Badge>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Badge className={getLevelColor(currentLevel)} variant="outline">
                  {getLevelLabel(currentLevel)}
                </Badge>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <Badge className={getLevelColor(targetLevel)} variant="outline">
                  {getLevelLabel(targetLevel)}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <CollapsibleContent className="space-y-3">
            {/* Description */}
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {/* AI Reasoning */}
            {aiReasoning && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground italic">
                  💡 <strong>Jericho says:</strong> {aiReasoning}
                </p>
              </div>
            )}

            {/* Linked Resources */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Recommended Resources {resources.length > 0 && `(${resources.length})`}
              </h4>
              {resources.length > 0 ? (
                <div className="space-y-2">
                  {resources.map((resource) => (
                    <div
                      key={resource.id}
                      className="border rounded-lg p-3 space-y-2 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          {getContentIcon(resource.content_type)}
                          <span className="text-sm font-medium line-clamp-1">
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
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {resource.description}
                        </p>
                      )}
                      {resource.capability_level && (
                        <Badge className={getLevelColor(resource.capability_level)} variant="outline">
                          {getLevelLabel(resource.capability_level)}
                        </Badge>
                      )}
                      {resource.external_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => onResourceClick(resource.id, resource.external_url!)}
                        >
                          View Resource
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">Resources coming soon</p>
                </div>
              )}
            </div>

            {/* Request Level Change Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
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
