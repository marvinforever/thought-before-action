import { useState, useEffect, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowRight, Building2, Mail, Phone, GripVertical, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ContactPipelineViewProps {
  userId: string;
  onContactsChange?: () => void;
}

const PIPELINE_STAGES = [
  { key: "prospect", label: "Prospect", color: "bg-blue-500" },
  { key: "active", label: "Active", color: "bg-green-500" },
  { key: "at_risk", label: "At-Risk", color: "bg-amber-500" },
  { key: "won", label: "Won", color: "bg-emerald-600" },
];

interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  pipeline_stage: string;
  last_purchase_date: string | null;
  notes: string | null;
  company_id: string | null;
  sales_companies?: { name: string } | null;
}

export function ContactPipelineView({ userId, onContactsChange }: ContactPipelineViewProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const fetchContacts = async () => {
    if (!userId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("sales_contacts")
      .select("id, name, title, email, phone, pipeline_stage, last_purchase_date, notes, company_id, sales_companies(name)")
      .eq("profile_id", userId)
      .order("name");

    if (error) {
      toast({ title: "Error loading contacts", variant: "destructive" });
    } else {
      setContacts((data || []) as unknown as Contact[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchContacts(); }, [userId]);

  const moveContact = async (contactId: string, newStage: string) => {
    const { error } = await supabase
      .from("sales_contacts")
      .update({ pipeline_stage: newStage })
      .eq("id", contactId)
      .eq("profile_id", userId);

    if (error) {
      toast({ title: "Error moving contact", variant: "destructive" });
    } else {
      toast({ title: "Contact moved" });
      fetchContacts();
      onContactsChange?.();
    }
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setTimeout(() => { (e.target as HTMLElement).style.opacity = "0.5"; }, 0);
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    setDraggedId(null);
    setDragOverStage(null);
    (e.target as HTMLElement).style.opacity = "1";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageKey) setDragOverStage(stageKey);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as HTMLElement;
    if (!related || !e.currentTarget.contains(related)) setDragOverStage(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id && draggedId) {
      const contact = contacts.find(c => c.id === id);
      if (contact && contact.pipeline_stage !== stageKey) {
        await moveContact(id, stageKey);
      }
    }
    setDraggedId(null);
    setDragOverStage(null);
  };

  const getStageContacts = (key: string) => contacts.filter(c => c.pipeline_stage === key);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading pipeline...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {PIPELINE_STAGES.map(stage => (
        <div
          key={stage.key}
          className="space-y-3"
          onDragOver={(e) => handleDragOver(e, stage.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, stage.key)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${stage.color}`} />
              <h3 className="font-semibold text-sm">{stage.label}</h3>
              <Badge variant="secondary" className="text-xs">
                {getStageContacts(stage.key).length}
              </Badge>
            </div>
          </div>

          <div
            className={cn(
              "space-y-2 min-h-[200px] rounded-lg transition-all duration-200 p-1 -m-1",
              dragOverStage === stage.key && draggedId && contacts.find(c => c.id === draggedId)?.pipeline_stage !== stage.key
                ? "bg-primary/10 border-2 border-dashed border-primary"
                : "border-2 border-transparent"
            )}
          >
            {getStageContacts(stage.key).map(contact => (
              <Card
                key={contact.id}
                className={cn(
                  "cursor-grab hover:shadow-md transition-all active:cursor-grabbing",
                  draggedId === contact.id && "opacity-50 scale-95"
                )}
                draggable
                onDragStart={(e) => handleDragStart(e, contact.id)}
                onDragEnd={handleDragEnd}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{contact.name}</p>
                        {contact.title && (
                          <p className="text-xs text-muted-foreground truncate">{contact.title}</p>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {PIPELINE_STAGES.filter(s => s.key !== stage.key).map(s => (
                          <DropdownMenuItem
                            key={s.key}
                            onClick={() => moveContact(contact.id, s.key)}
                          >
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Move to {s.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {contact.sales_companies?.name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Building2 className="h-3 w-3" />
                      {contact.sales_companies.name}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {contact.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </span>
                    )}
                  </div>

                  {contact.last_purchase_date && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last: {format(new Date(contact.last_purchase_date), "MMM d, yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

            {getStageContacts(stage.key).length === 0 && (
              <div className={cn(
                "text-center py-8 text-muted-foreground text-xs border-2 border-dashed rounded-lg transition-colors",
                dragOverStage === stage.key ? "border-primary bg-primary/5" : ""
              )}>
                {dragOverStage === stage.key ? "Drop here" : "No contacts"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
