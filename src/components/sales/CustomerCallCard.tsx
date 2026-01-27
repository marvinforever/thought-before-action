import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, DollarSign, MapPin, Leaf } from "lucide-react";
import { format } from "date-fns";

interface CallPlanData {
  id?: string;
  customer_name: string;
  total_revenue: number;
  acreage?: number;
  crops?: string;
  call_1_completed: boolean;
  call_1_date?: string;
  call_1_notes?: string;
  call_2_completed: boolean;
  call_2_date?: string;
  call_2_notes?: string;
  call_3_completed: boolean;
  call_3_date?: string;
  call_3_notes?: string;
  call_4_completed: boolean;
  call_4_date?: string;
  call_4_notes?: string;
}

interface CustomerCallCardProps {
  customer: CallPlanData;
  onUpdate: (updates: Partial<CallPlanData>) => void;
}

const CALL_STAGES = [
  { key: "1", label: "Initial Planning", description: "Pre-season strategic discussion" },
  { key: "2", label: "Pre-Plant Check-in", description: "Final inputs and timing" },
  { key: "3", label: "Season Review", description: "Mid-season assessment" },
  { key: "4", label: "Strategic Recs", description: "Post-harvest planning" },
] as const;

export function CustomerCallCard({ customer, onUpdate }: CustomerCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const completedCalls = [
    customer.call_1_completed,
    customer.call_2_completed,
    customer.call_3_completed,
    customer.call_4_completed,
  ].filter(Boolean).length;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const handleCheckChange = (callNumber: 1 | 2 | 3 | 4, checked: boolean) => {
    const dateField = `call_${callNumber}_date` as 'call_1_date' | 'call_2_date' | 'call_3_date' | 'call_4_date';
    const completedField = `call_${callNumber}_completed` as 'call_1_completed' | 'call_2_completed' | 'call_3_completed' | 'call_4_completed';
    
    const updates: Partial<CallPlanData> = {};
    updates[completedField] = checked;
    
    if (checked && !customer[dateField]) {
      updates[dateField] = format(new Date(), "yyyy-MM-dd");
    }
    onUpdate(updates);
  };

  const handleDateChange = (callNumber: 1 | 2 | 3 | 4, date: string) => {
    const dateField = `call_${callNumber}_date` as 'call_1_date' | 'call_2_date' | 'call_3_date' | 'call_4_date';
    const updates: Partial<CallPlanData> = {};
    updates[dateField] = date || undefined;
    onUpdate(updates);
  };

  const handleNotesChange = (callNumber: 1 | 2 | 3 | 4, notes: string) => {
    const notesField = `call_${callNumber}_notes` as 'call_1_notes' | 'call_2_notes' | 'call_3_notes' | 'call_4_notes';
    const updates: Partial<CallPlanData> = {};
    updates[notesField] = notes || undefined;
    onUpdate(updates);
  };

  return (
    <Card className="print:break-inside-avoid print:shadow-none print:border-2 print:border-foreground/20">
      <CardHeader className="pb-3 print:pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-bold text-lg print:text-base">{customer.customer_name}</h3>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground print:text-xs">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(customer.total_revenue)} lifetime
              </span>
              {customer.acreage && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {customer.acreage.toLocaleString()} ac
                </span>
              )}
              {customer.crops && (
                <span className="flex items-center gap-1">
                  <Leaf className="h-3 w-3" />
                  {customer.crops}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={completedCalls === 4 ? "default" : "secondary"}
              className="print:border print:border-foreground/30"
            >
              {completedCalls}/4
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="print:hidden"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 print:space-y-2">
        {CALL_STAGES.map((stage) => {
          const callNum = parseInt(stage.key) as 1 | 2 | 3 | 4;
          const isCompleted = customer[`call_${callNum}_completed` as keyof CallPlanData] as boolean;
          const callDate = customer[`call_${callNum}_date` as keyof CallPlanData] as string | undefined;
          const callNotes = customer[`call_${callNum}_notes` as keyof CallPlanData] as string | undefined;
          
          return (
            <div 
              key={stage.key} 
              className={`p-3 rounded-lg border ${isCompleted ? 'bg-muted/50 border-primary/20' : 'bg-background border-border'} print:p-2 print:bg-transparent`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={(checked) => handleCheckChange(callNum, !!checked)}
                  className="mt-0.5 print:h-5 print:w-5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div>
                      <span className="font-medium text-sm">Call {stage.key}: {stage.label}</span>
                      <p className="text-xs text-muted-foreground print:hidden">{stage.description}</p>
                    </div>
                    <Input
                      type="date"
                      value={callDate || ""}
                      onChange={(e) => handleDateChange(callNum, e.target.value)}
                      className="w-36 h-8 text-sm print:w-28 print:h-6 print:text-xs"
                    />
                  </div>
                  
                  {(expanded || callNotes) && (
                    <Textarea
                      placeholder="Notes..."
                      value={callNotes || ""}
                      onChange={(e) => handleNotesChange(callNum, e.target.value)}
                      className="mt-2 min-h-[60px] text-sm resize-none print:min-h-[40px] print:text-xs"
                    />
                  )}
                  
                  {/* Print-only notes line */}
                  {!callNotes && (
                    <div className="hidden print:block mt-1 border-b border-dashed border-muted-foreground/40 h-6" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
