import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TrendingUp, BookOpen, Video, Headphones, ExternalLink, Star, Send, Info } from "lucide-react";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

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

  const getLevelBgGradient = (level: string) => {
    const l = level.toLowerCase();
    switch (l) {
      case "beginner":
        return "bg-gradient-to-br from-blue-500/20 to-blue-600/10";
      case "intermediate":
        return "bg-gradient-to-br from-green-500/20 to-green-600/10";
      case "advanced":
        return "bg-gradient-to-br from-orange-500/20 to-orange-600/10";
      case "expert":
        return "bg-gradient-to-br from-purple-500/20 to-purple-600/10";
      default:
        return "bg-muted";
    }
  };

  const isCurrentLevel = (level: string) => level.toLowerCase() === currentLevel.toLowerCase();

  const handleLevelClick = (level: string) => {
    setSelectedLevel(level);
    setDialogOpen(true);
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setDialogOpen(true)}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl mb-1">{name}</CardTitle>
              <p className="text-sm text-muted-foreground">{category}</p>
            </div>
            <Badge className={`${getLevelColor(currentLevel)} px-3 py-1.5 text-sm font-semibold whitespace-nowrap`}>
              {getLevelLabel(currentLevel)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {resources.length > 0 && (
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{resources.length} resource{resources.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {aiReasoning && (
                <div className="flex items-center gap-1">
                  <span>💡</span>
                  <span>AI insights available</span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="gap-2">
              View Details
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{name}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-base">
              {category}
              <span className="text-muted-foreground">•</span>
              <Badge className={getLevelColor(currentLevel)} variant="outline">
                Current: {getLevelLabel(currentLevel)}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Level Matrix */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Capability Levels
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {LEVEL_ORDER.map((level) => {
                  const isCurrent = isCurrentLevel(level);
                  
                  return (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className={`
                        relative rounded-lg p-3 text-center transition-all duration-200
                        border-2 ${isCurrent ? 'border-primary shadow-md' : selectedLevel === level ? 'border-primary/50' : 'border-border hover:border-primary/30'}
                        ${isCurrent ? getLevelBgGradient(level) : selectedLevel === level ? 'bg-accent/10' : 'bg-card hover:bg-accent/5'}
                      `}
                    >
                      <Badge 
                        className={`${getLevelColor(level)} text-xs font-semibold mb-1`}
                        variant={isCurrent ? "default" : "outline"}
                      >
                        {getLevelLabel(level)}
                      </Badge>
                      {isCurrent && (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <TrendingUp className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium text-primary">Current</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Level Description */}
            {selectedLevel && (
              <div className={`${isCurrentLevel(selectedLevel) ? getLevelBgGradient(selectedLevel) + ' border-2 border-primary' : 'bg-muted/50 border border-border'} rounded-lg p-4 animate-in fade-in slide-in-from-top-2`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getLevelColor(selectedLevel)} variant="outline">
                    {getLevelLabel(selectedLevel)}
                  </Badge>
                  {isCurrentLevel(selectedLevel) && (
                    <span className="text-sm font-semibold text-primary">Your Current Level</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{description}</p>
              </div>
            )}

            {!selectedLevel && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-sm leading-relaxed">{description}</p>
              </div>
            )}

            {/* AI Reasoning */}
            {aiReasoning && (
              <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                <div className="flex gap-3">
                  <div className="text-xl flex-shrink-0">💡</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-primary mb-2">Jericho's Insight</h4>
                    <p className="text-sm leading-relaxed">{aiReasoning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Resources */}
            {resources.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Learning Resources ({resources.length})
                </h4>
                <div className="grid gap-3">
                  {resources.map((resource) => (
                    <div
                      key={resource.id}
                      className="group border rounded-lg p-4 hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          {getContentIcon(resource.content_type)}
                          <h5 className="font-medium text-sm">{resource.title}</h5>
                        </div>
                        {resource.rating && (
                          <div className="flex items-center gap-1 text-xs flex-shrink-0">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{resource.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      {resource.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {resource.description}
                        </p>
                      )}
                      {resource.external_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
                          onClick={() => onResourceClick(resource.id, resource.external_url!)}
                        >
                          View Resource
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="default"
                className="flex-1 gap-2"
                onClick={() => {
                  onRequestLevelChange(id);
                  setDialogOpen(false);
                }}
              >
                <Send className="h-4 w-4" />
                Request Level Change
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
