import * as React from "react";
import { cn } from "@/lib/utils";

interface GaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  description?: string;
  icon?: React.ReactNode;
  colorScheme?: "default" | "success" | "warning" | "danger" | "accent";
}

const Gauge = React.forwardRef<HTMLDivElement, GaugeProps>(
  ({ 
    className, 
    value, 
    max = 100, 
    size = 120, 
    strokeWidth = 12,
    label,
    description,
    icon,
    colorScheme = "default",
    ...props 
  }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const getColorClasses = () => {
      switch (colorScheme) {
        case "success":
          return "stroke-green-500";
        case "warning":
          return "stroke-yellow-500";
        case "danger":
          return "stroke-destructive";
        case "accent":
          return "stroke-accent";
        default:
          return "stroke-primary";
      }
    };

    return (
      <div ref={ref} className={cn("flex flex-col items-center justify-center", className)} {...props}>
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              className={cn("transition-all duration-1000 ease-out", getColorClasses())}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {icon && <div className="mb-1">{icon}</div>}
            <div className="text-2xl font-bold">{value}{max === 100 ? '' : `/${max}`}</div>
            {label && <div className="text-xs text-muted-foreground mt-0.5">{label}</div>}
          </div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground text-center mt-2">{description}</p>
        )}
      </div>
    );
  }
);

Gauge.displayName = "Gauge";

export { Gauge };
