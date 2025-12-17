import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Edit, Save, X, Expand, Briefcase, Heart } from "lucide-react";
import { ViewVisionDialog } from "./ViewVisionDialog";

type PersonalGoals = {
  id: string;
  one_year_vision: string | null;
  three_year_vision: string | null;
  personal_one_year_vision: string | null;
  personal_three_year_vision: string | null;
};

export default function PersonalVisionCard() {
  const [goals, setGoals] = useState<PersonalGoals | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("professional");
  
  // Professional vision state
  const [oneYearVision, setOneYearVision] = useState("");
  const [threeYearVision, setThreeYearVision] = useState("");
  
  // Personal vision state
  const [personalOneYearVision, setPersonalOneYearVision] = useState("");
  const [personalThreeYearVision, setPersonalThreeYearVision] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewDialogType, setViewDialogType] = useState<"1-year" | "3-year">("1-year");
  const [viewDialogCategory, setViewDialogCategory] = useState<"professional" | "personal">("professional");
  const { toast } = useToast();

  const openVisionDialog = (type: "1-year" | "3-year", category: "professional" | "personal") => {
    setViewDialogType(type);
    setViewDialogCategory(category);
    setViewDialogOpen(true);
  };

  useEffect(() => {
    loadVisions();
  }, []);

  const loadVisions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("personal_goals")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setGoals(data as PersonalGoals);
        setOneYearVision(data.one_year_vision || "");
        setThreeYearVision(data.three_year_vision || "");
        setPersonalOneYearVision((data as any).personal_one_year_vision || "");
        setPersonalThreeYearVision((data as any).personal_three_year_vision || "");
      }
    } catch (error: any) {
      console.error("Error loading visions:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const payload = {
        profile_id: user.id,
        company_id: profile.company_id,
        one_year_vision: oneYearVision || null,
        three_year_vision: threeYearVision || null,
        personal_one_year_vision: personalOneYearVision || null,
        personal_three_year_vision: personalThreeYearVision || null,
      };

      // Check if this is first time setting vision
      const isFirstVision = !goals?.one_year_vision && !goals?.three_year_vision &&
                           !goals?.personal_one_year_vision && !goals?.personal_three_year_vision;

      const { error } = await supabase
        .from("personal_goals")
        .upsert(payload as any, { onConflict: 'profile_id' });

      if (error) throw error;

      // Award points for setting vision (only first time or significant update)
      if (isFirstVision && (oneYearVision || threeYearVision || personalOneYearVision || personalThreeYearVision)) {
        await supabase.rpc('award_points', {
          p_profile_id: user.id,
          p_activity_type: 'vision_set',
          p_description: 'Set personal/professional vision'
        });
      }

      toast({
        title: "Vision saved",
        description: "Your vision has been updated",
      });

      setIsEditing(false);
      await loadVisions();
    } catch (error: any) {
      toast({
        title: "Error saving vision",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setOneYearVision(goals?.one_year_vision || "");
    setThreeYearVision(goals?.three_year_vision || "");
    setPersonalOneYearVision(goals?.personal_one_year_vision || "");
    setPersonalThreeYearVision(goals?.personal_three_year_vision || "");
    setIsEditing(false);
  };

  const getDialogContent = () => {
    if (viewDialogCategory === "professional") {
      return viewDialogType === "1-year" ? oneYearVision : threeYearVision;
    }
    return viewDialogType === "1-year" ? personalOneYearVision : personalThreeYearVision;
  };

  const renderVisionFields = (
    oneYear: string,
    threeYear: string,
    setOneYear: (val: string) => void,
    setThreeYear: (val: string) => void,
    category: "professional" | "personal"
  ) => {
    const isProfessional = category === "professional";
    
    return (
      <div className="space-y-6">
        <div>
          <label className="text-sm font-semibold mb-2 block">
            1 Year Vision
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            {isProfessional 
              ? "One year from now, what do you want the story to be professionally?"
              : "One year from now, what do you want to achieve personally?"
            }
          </p>
          {isEditing ? (
            <Textarea
              value={oneYear}
              onChange={(e) => setOneYear(e.target.value)}
              placeholder={`Describe your ${isProfessional ? 'professional' : 'personal'} vision for one year from now...`}
              className="min-h-[100px]"
            />
          ) : (
            <div 
              className="group relative cursor-pointer"
              onClick={() => openVisionDialog("1-year", category)}
            >
              <ScrollArea className="h-[100px] rounded-md border bg-muted/50 transition-colors hover:bg-muted/70 hover:border-primary/50">
                <p className="text-sm p-4">
                  {oneYear || `No vision set yet. Click edit to add your 1-year ${isProfessional ? 'professional' : 'personal'} vision.`}
                </p>
              </ScrollArea>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Expand className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
        
        <div>
          <label className="text-sm font-semibold mb-2 block">
            3 Year Vision
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            {isProfessional 
              ? "Three years from now, what professional achievements do you want?"
              : "Three years from now, what personal goals do you want to have achieved?"
            }
          </p>
          {isEditing ? (
            <Textarea
              value={threeYear}
              onChange={(e) => setThreeYear(e.target.value)}
              placeholder={`Describe your ${isProfessional ? 'professional' : 'personal'} vision for three years from now...`}
              className="min-h-[100px]"
            />
          ) : (
            <div 
              className="group relative cursor-pointer"
              onClick={() => openVisionDialog("3-year", category)}
            >
              <ScrollArea className="h-[100px] rounded-md border bg-muted/50 transition-colors hover:bg-muted/70 hover:border-primary/50">
                <p className="text-sm p-4">
                  {threeYear || `No vision set yet. Click edit to add your 3-year ${isProfessional ? 'professional' : 'personal'} vision.`}
                </p>
              </ScrollArea>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Expand className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              My Vision
            </CardTitle>
            <CardDescription>
              Where do you see yourself in the future?
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="professional" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Professional
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Personal
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="professional">
            {renderVisionFields(
              oneYearVision,
              threeYearVision,
              setOneYearVision,
              setThreeYearVision,
              "professional"
            )}
          </TabsContent>
          
          <TabsContent value="personal">
            {renderVisionFields(
              personalOneYearVision,
              personalThreeYearVision,
              setPersonalOneYearVision,
              setPersonalThreeYearVision,
              "personal"
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <ViewVisionDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        type={viewDialogType}
        content={getDialogContent()}
      />
    </Card>
  );
}
