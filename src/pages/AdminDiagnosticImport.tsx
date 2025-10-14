import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function AdminDiagnosticImport() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const row: any = {};
      
      // Map CSV columns to our data structure
      row.firstName = values[1];
      row.lastName = values[2];
      row.phone = values[3];
      row.email = values[4];
      row.company = values[5];
      row.roleClarity = values[6];
      row.hasJobDescription = values[7];
      row.mostImportantJob = values[8];
      row.confidence = values[9];
      row.naturalStrength = values[10];
      row.biggestDifficulty = values[11];
      row.skillToMaster = values[12];
      row.workload = values[13];
      row.mentalDrain = values[14];
      row.focus = values[15];
      row.workLifeSacrifice = values[16];
      row.energyDrain = values[17];
      row.burnout = values[18];
      row.learningPreference = values[19];
      row.weeklyDevHours = values[20];
      row.learningMotivation = values[21];
      row.neededTraining = values[22];
      row.growthBarrier = values[23];
      row.listens_podcasts = values[24];
      row.watches_youtube = values[25];
      row.reads_books = values[26];
      row.seesGrowthPath = values[27];
      row.managerSupport = values[28];
      row.feelsValued = values[29];
      row.energyLevel = values[30];
      row.wouldStay = values[31];
      row.retentionImprovement = values[32];
      row.seesLeadership = values[33];
      row.threeYearGoal = values[34];
      row.companySupportingGoal = values[35];
      row.workObstacle = values[36];
      row.biggestFrustration = values[37];
      row.whyPeopleLeave = values[38];
      row.whatEnjoyMost = values[39];
      row.leadershipShouldUnderstand = values[40];
      row.additionalFeedback = values[41];
      row.recentAccomplishment = values[42];
      row.recentChallenge = values[43];
      row.neededTrainingEffectiveness = values[44];
      row.twelveMonthGoal = values[45];
      row.supportFromLeadership = values[46];
      row.oneYearVision = values[47];
      
      data.push(row);
    }
    
    return data;
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      
      const csvData = parseCSV(csvText);
      
      const { data, error } = await supabase.functions.invoke('import-diagnostic-csv', {
        body: { csvData }
      });

      if (error) throw error;

      const successCount = data.results.filter((r: any) => r.status === 'success').length;
      const errorCount = data.results.filter((r: any) => r.status === 'error').length;
      const skippedCount = data.results.filter((r: any) => r.status === 'skipped').length;

      toast.success(`Import complete: ${successCount} successful, ${errorCount} errors, ${skippedCount} skipped`);
      
      console.log('Import results:', data.results);
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "Failed to import diagnostic data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            <h2 className="text-2xl font-bold">Import Diagnostic CSV</h2>
          </div>
          
          <p className="text-muted-foreground">
            Paste your CSV data below. Make sure profiles exist for all email addresses.
          </p>
          
          <Textarea
            placeholder="Paste CSV data here..."
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
          
          <Button 
            onClick={handleImport} 
            disabled={loading || !csvText.trim()}
          >
            {loading ? "Importing..." : "Import Diagnostic Data"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
