import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Target, ArrowRight } from "lucide-react";
import { CareerPath } from "@/hooks/useCareerPath";
import { cn } from "@/lib/utils";

interface WizardStepTargetRoleProps {
  careerPaths: CareerPath[];
  selectedPath: string;
  customRole: string;
  onSelectPath: (pathId: string) => void;
  onCustomRole: (role: string) => void;
}

export function WizardStepTargetRole({
  careerPaths,
  selectedPath,
  customRole,
  onSelectPath,
  onCustomRole,
}: WizardStepTargetRoleProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">What role are you targeting?</h3>
        <p className="text-sm text-muted-foreground">
          Select a defined career path or enter a custom target role.
        </p>
      </div>

      {/* Defined Career Paths */}
      {careerPaths.length > 0 && (
        <div className="space-y-2">
          <Label>Company Career Paths</Label>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {careerPaths.map((path) => (
              <button
                key={path.id}
                onClick={() => onSelectPath(path.id)}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-all",
                  selectedPath === path.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-primary/50 hover:bg-accent/5"
                )}
              >
                <div className="font-medium text-sm">{path.name}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {path.from_role || "Current Role"}
                  </Badge>
                  <ArrowRight className="h-3 w-3" />
                  <Badge className="text-xs bg-primary">{path.to_role}</Badge>
                  {path.typical_timeline_months && (
                    <span className="ml-auto">{path.typical_timeline_months}mo typical</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {careerPaths.length > 0 && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or enter custom</span>
          </div>
        </div>
      )}

      {/* Custom Role Input */}
      <div className="space-y-2">
        <Label htmlFor="custom-role">Custom Target Role</Label>
        <Input
          id="custom-role"
          placeholder="e.g., Senior Product Manager, Team Lead, Director of Engineering..."
          value={customRole}
          onChange={(e) => onCustomRole(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          We'll analyze what capabilities you need for this role.
        </p>
      </div>
    </div>
  );
}
