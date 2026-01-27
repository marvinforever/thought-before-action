import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface PipelineSummary {
  repId: string;
  repName: string;
  totalValue: number;
  dealCount: number;
  byStage: Record<string, { count: number; value: number }>;
  staleDeals: number;
  lastActivity: string | null;
}

interface PipelineHealthChartProps {
  data: PipelineSummary[];
  isLoading?: boolean;
  onRepClick?: (repId: string) => void;
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: "#3b82f6",
  discovery: "#8b5cf6",
  proposal: "#f59e0b",
  closing: "#22c55e",
  follow_up: "#14b8a6",
  won: "#10b981",
  lost: "#ef4444",
};

const STAGE_ORDER = ["prospecting", "discovery", "proposal", "closing", "follow_up", "won", "lost"];

export function PipelineHealthChart({ data, isLoading, onRepClick }: PipelineHealthChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No pipeline data available</p>
      </div>
    );
  }

  // Prepare data for stacked bar chart
  const chartData = data.map((rep) => {
    const entry: Record<string, any> = {
      name: rep.repName.split(" ")[0], // First name for chart
      fullName: rep.repName,
      repId: rep.repId,
      total: rep.totalValue,
    };
    
    for (const stage of STAGE_ORDER) {
      entry[stage] = rep.byStage[stage]?.value || 0;
    }
    
    return entry;
  }).sort((a, b) => b.total - a.total);

  // Get unique stages that have data
  const activeStages = STAGE_ORDER.filter((stage) =>
    data.some((rep) => rep.byStage[stage]?.value > 0)
  );

  // Reps with stale deals
  const repsWithStaleDeals = data.filter((rep) => rep.staleDeals > 0);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Value by Rep */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline Value by Rep & Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrency}
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={12}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                  ]}
                  labelFormatter={(label) => {
                    const item = chartData.find((d) => d.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())
                  }
                />
                {activeStages.map((stage) => (
                  <Bar
                    key={stage}
                    dataKey={stage}
                    stackId="a"
                    fill={STAGE_COLORS[stage] || "#888"}
                    cursor="pointer"
                    onClick={(data) => onRepClick?.(data.repId)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Deal Counts Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {data.map((rep) => (
          <Card
            key={rep.repId}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onRepClick?.(rep.repId)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-sm truncate">{rep.repName}</h4>
                {rep.staleDeals > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5">
                    {rep.staleDeals} stale
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold">{formatCurrency(rep.totalValue)}</p>
              <p className="text-xs text-muted-foreground">{rep.dealCount} deals</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(rep.byStage).map(([stage, info]) => (
                  <Badge
                    key={stage}
                    variant="outline"
                    className="text-[10px] px-1.5"
                    style={{ borderColor: STAGE_COLORS[stage] }}
                  >
                    {info.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stale Deals Alert */}
      {repsWithStaleDeals.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Stale Deals Detected</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {repsWithStaleDeals.length} rep(s) have deals with no activity in 14+ days:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {repsWithStaleDeals.map((rep) => (
                    <Badge
                      key={rep.repId}
                      variant="outline"
                      className="cursor-pointer hover:bg-amber-500/10"
                      onClick={() => onRepClick?.(rep.repId)}
                    >
                      {rep.repName} ({rep.staleDeals})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
