import { IGPCapability, levelToNumber } from "./igp-types";

interface IGPProgressBarProps {
  capabilities: IGPCapability[];
}

export function IGPProgressBar({ capabilities }: IGPProgressBarProps) {
  if (!capabilities.length) return null;

  const totalPossible = capabilities.length * 4; // max = mastery for all
  const totalCurrent = capabilities.reduce((sum, c) => sum + levelToNumber(c.current_level), 0);
  const percentage = Math.round((totalCurrent / totalPossible) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Overall Capability Progress</span>
        <span className="font-bold text-foreground">{percentage}%</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
