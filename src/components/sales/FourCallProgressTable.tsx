import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Check, X, StickyNote } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CustomerDetail {
  customerName: string;
  call1: boolean;
  call2: boolean;
  call3: boolean;
  call4: boolean;
  revenue: number;
  notes: {
    call1: string | null;
    call2: string | null;
    call3: string | null;
    call4: string | null;
  };
}

interface FourCallProgress {
  repId: string;
  repName: string;
  customersTracked: number;
  call1Pct: number;
  call2Pct: number;
  call3Pct: number;
  call4Pct: number;
  overallPct: number;
  customers: CustomerDetail[];
}

interface FourCallProgressTableProps {
  data: FourCallProgress[];
  isLoading?: boolean;
  onRepClick?: (repId: string) => void;
}

function CallStatusBadge({ completed, note }: { completed: boolean; note: string | null }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {completed ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground/50" />
            )}
            {note && <StickyNote className="h-3 w-3 text-amber-500" />}
          </div>
        </TooltipTrigger>
        {note && (
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{note}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function PercentageBadge({ pct }: { pct: number }) {
  const variant = pct >= 75 ? "default" : pct >= 50 ? "secondary" : pct >= 25 ? "outline" : "destructive";
  return (
    <Badge variant={variant} className="min-w-[50px] justify-center">
      {pct}%
    </Badge>
  );
}

export function FourCallProgressTable({ data, isLoading, onRepClick }: FourCallProgressTableProps) {
  const [expandedReps, setExpandedReps] = useState<Set<string>>(new Set());

  const toggleExpanded = (repId: string) => {
    setExpandedReps((prev) => {
      const next = new Set(prev);
      if (next.has(repId)) {
        next.delete(repId);
      } else {
        next.add(repId);
      }
      return next;
    });
  };

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
        <p>No 4-Call tracking data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Rep Name</TableHead>
            <TableHead className="text-center">Customers</TableHead>
            <TableHead className="text-center">Call 1</TableHead>
            <TableHead className="text-center">Call 2</TableHead>
            <TableHead className="text-center">Call 3</TableHead>
            <TableHead className="text-center">Call 4</TableHead>
            <TableHead className="text-center">Overall</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((rep) => (
            <Collapsible
              key={rep.repId}
              open={expandedReps.has(rep.repId)}
              onOpenChange={() => toggleExpanded(rep.repId)}
              asChild
            >
              <>
                <TableRow className="hover:bg-muted/50">
                  <TableCell>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expandedReps.has(rep.repId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => onRepClick?.(rep.repId)}
                      className="font-medium hover:underline text-left"
                    >
                      {rep.repName}
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{rep.customersTracked}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <PercentageBadge pct={rep.call1Pct} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PercentageBadge pct={rep.call2Pct} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PercentageBadge pct={rep.call3Pct} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PercentageBadge pct={rep.call4Pct} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2">
                      <Progress value={rep.overallPct} className="h-2 flex-1" />
                      <span className="text-sm font-medium w-10">{rep.overallPct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
                <CollapsibleContent asChild>
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/30 p-0">
                      <div className="p-4">
                        <h4 className="text-sm font-medium mb-3">Customer Details</h4>
                        <div className="rounded border bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-center w-20">Call 1</TableHead>
                                <TableHead className="text-center w-20">Call 2</TableHead>
                                <TableHead className="text-center w-20">Call 3</TableHead>
                                <TableHead className="text-center w-20">Call 4</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rep.customers.map((customer, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">
                                    {customer.customerName}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    ${customer.revenue.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <CallStatusBadge
                                      completed={customer.call1}
                                      note={customer.notes.call1}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <CallStatusBadge
                                      completed={customer.call2}
                                      note={customer.notes.call2}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <CallStatusBadge
                                      completed={customer.call3}
                                      note={customer.notes.call3}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <CallStatusBadge
                                      completed={customer.call4}
                                      note={customer.notes.call4}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </CollapsibleContent>
              </>
            </Collapsible>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
