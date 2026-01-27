import { useState, useEffect, memo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MapPin, Leaf, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { InitialPlanningExpanded } from "./InitialPlanningExpanded";

interface CallPlanData {
  id?: string;
  customer_name: string;
  total_revenue: number;
  acreage?: number;
  crops?: string;
  precall_plan?: string;
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
  companyId: string;
  userId: string;
  onUpdate: (updates: Partial<CallPlanData>) => Promise<void>;
  onUnsavedChange?: (customerName: string, hasChanges: boolean) => void;
}

const CALL_STAGES = [
  { key: "1", label: "Prepay Review", description: "Pre-season strategic discussion" },
  { key: "2", label: "Pre-Plant Check-in", description: "Final inputs and timing" },
  { key: "3", label: "Season Review", description: "Mid-season assessment" },
  { key: "4", label: "Strategic Recs", description: "Post-harvest planning" },
] as const;

function CustomerCallCardInner({ customer, companyId, userId, onUpdate, onUnsavedChange }: CustomerCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [initialPlanningExpanded, setInitialPlanningExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Local state for ALL editable fields
  const [localData, setLocalData] = useState({
    call_1_completed: customer.call_1_completed,
    call_1_date: customer.call_1_date || "",
    call_1_notes: customer.call_1_notes || "",
    call_2_completed: customer.call_2_completed,
    call_2_date: customer.call_2_date || "",
    call_2_notes: customer.call_2_notes || "",
    call_3_completed: customer.call_3_completed,
    call_3_date: customer.call_3_date || "",
    call_3_notes: customer.call_3_notes || "",
    call_4_completed: customer.call_4_completed,
    call_4_date: customer.call_4_date || "",
    call_4_notes: customer.call_4_notes || "",
    precall_plan: customer.precall_plan || "",
  });

  // Check if there are unsaved changes
  const hasUnsavedChanges = 
    localData.call_1_completed !== customer.call_1_completed ||
    localData.call_1_date !== (customer.call_1_date || "") ||
    localData.call_1_notes !== (customer.call_1_notes || "") ||
    localData.call_2_completed !== customer.call_2_completed ||
    localData.call_2_date !== (customer.call_2_date || "") ||
    localData.call_2_notes !== (customer.call_2_notes || "") ||
    localData.call_3_completed !== customer.call_3_completed ||
    localData.call_3_date !== (customer.call_3_date || "") ||
    localData.call_3_notes !== (customer.call_3_notes || "") ||
    localData.call_4_completed !== customer.call_4_completed ||
    localData.call_4_date !== (customer.call_4_date || "") ||
    localData.call_4_notes !== (customer.call_4_notes || "") ||
    localData.precall_plan !== (customer.precall_plan || "");

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChange?.(customer.customer_name, hasUnsavedChanges);
  }, [hasUnsavedChanges, customer.customer_name, onUnsavedChange]);

  // Sync local data when customer prop changes (e.g., after refresh)
  useEffect(() => {
    setLocalData({
      call_1_completed: customer.call_1_completed,
      call_1_date: customer.call_1_date || "",
      call_1_notes: customer.call_1_notes || "",
      call_2_completed: customer.call_2_completed,
      call_2_date: customer.call_2_date || "",
      call_2_notes: customer.call_2_notes || "",
      call_3_completed: customer.call_3_completed,
      call_3_date: customer.call_3_date || "",
      call_3_notes: customer.call_3_notes || "",
      call_4_completed: customer.call_4_completed,
      call_4_date: customer.call_4_date || "",
      call_4_notes: customer.call_4_notes || "",
      precall_plan: customer.precall_plan || "",
    });
  }, [customer]);

  const completedCalls = [
    localData.call_1_completed,
    localData.call_2_completed,
    localData.call_3_completed,
    localData.call_4_completed,
  ].filter(Boolean).length;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const handleCheckChange = (callNumber: 1 | 2 | 3 | 4, checked: boolean) => {
    const completedField = `call_${callNumber}_completed` as keyof typeof localData;
    const dateField = `call_${callNumber}_date` as keyof typeof localData;
    
    setLocalData(prev => ({
      ...prev,
      [completedField]: checked,
      // Auto-fill date if checking and no date set
      [dateField]: checked && !prev[dateField] ? format(new Date(), "yyyy-MM-dd") : prev[dateField],
    }));
  };

  const handleDateChange = (callNumber: 1 | 2 | 3 | 4, date: string) => {
    const dateField = `call_${callNumber}_date` as keyof typeof localData;
    setLocalData(prev => ({ ...prev, [dateField]: date }));
  };

  const handleNotesChange = (callNumber: 1 | 2 | 3 | 4, notes: string) => {
    const notesField = `call_${callNumber}_notes` as keyof typeof localData;
    setLocalData(prev => ({ ...prev, [notesField]: notes }));
  };

  const handlePrecallPlanChange = (plan: string) => {
    setLocalData(prev => ({ ...prev, precall_plan: plan }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        call_1_completed: localData.call_1_completed,
        call_1_date: localData.call_1_date || undefined,
        call_1_notes: localData.call_1_notes || undefined,
        call_2_completed: localData.call_2_completed,
        call_2_date: localData.call_2_date || undefined,
        call_2_notes: localData.call_2_notes || undefined,
        call_3_completed: localData.call_3_completed,
        call_3_date: localData.call_3_date || undefined,
        call_3_notes: localData.call_3_notes || undefined,
        call_4_completed: localData.call_4_completed,
        call_4_date: localData.call_4_date || undefined,
        call_4_notes: localData.call_4_notes || undefined,
        precall_plan: localData.precall_plan || undefined,
      });
    } finally {
      setSaving(false);
    }
  };


  return (
    <Card className="print:break-inside-avoid print:shadow-none print:border-2 print:border-foreground/20">
      <CardHeader className="pb-3 print:pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-bold text-lg print:text-base">{customer.customer_name}</h3>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground print:text-xs">
              <span>{formatCurrency(customer.total_revenue)} 2025</span>
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
          const isCompleted = localData[`call_${callNum}_completed` as keyof typeof localData] as boolean;
          const callDate = localData[`call_${callNum}_date` as keyof typeof localData] as string;
          const callNotesLocal = localData[`call_${callNum}_notes` as keyof typeof localData] as string;
          
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
                    <div className="flex items-center gap-2">
                      {callNum === 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInitialPlanningExpanded(!initialPlanningExpanded)}
                          className="h-7 text-xs print:hidden"
                        >
                          {initialPlanningExpanded ? "Hide Products" : "Show Products"}
                        </Button>
                      )}
                      <Input
                        type="date"
                        value={callDate || ""}
                        onChange={(e) => handleDateChange(callNum, e.target.value)}
                        className="w-36 h-8 text-sm print:w-28 print:h-6 print:text-xs"
                      />
                    </div>
                  </div>
                  
                  {/* Initial Planning Expanded Section - only for Call 1 */}
                  {callNum === 1 && initialPlanningExpanded && (
                    <InitialPlanningExpanded
                      customerName={customer.customer_name}
                      companyId={companyId}
                      userId={userId}
                      totalRevenue={customer.total_revenue}
                      notes={callNotesLocal}
                      onNotesChange={(notes) => handleNotesChange(1, notes)}
                      savedPrecallPlan={localData.precall_plan}
                      onPrecallPlanChange={handlePrecallPlanChange}
                    />
                  )}
                  
                  {/* Regular notes for non-Call-1 or when Initial Planning is collapsed */}
                  {(callNum !== 1 || !initialPlanningExpanded) && (expanded || callNotesLocal) && (
                    <Textarea
                      placeholder="Notes..."
                      value={callNotesLocal}
                      onChange={(e) => handleNotesChange(callNum, e.target.value)}
                      className="mt-2 min-h-[60px] text-sm resize-none print:min-h-[40px] print:text-xs"
                    />
                  )}
                  
                  {/* Print-only notes line */}
                  {!callNotesLocal && (
                    <div className="hidden print:block mt-1 border-b border-dashed border-muted-foreground/40 h-6" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Save Button */}
        <div className="flex justify-end pt-2 print:hidden">
          <Button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            variant={hasUnsavedChanges ? "default" : "secondary"}
            size="sm"
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {hasUnsavedChanges ? "Save Changes" : "Saved"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Memoized export to prevent unnecessary re-renders of entire list
export const CustomerCallCard = memo(CustomerCallCardInner);

