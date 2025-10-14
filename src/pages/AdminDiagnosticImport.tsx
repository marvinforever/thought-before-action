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
  const [clearing, setClearing] = useState(false);

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    };
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      
      // Map CSV columns to our data structure
      row.firstName = values[1]?.trim() || '';
      row.lastName = values[2]?.trim() || '';
      row.phone = values[3]?.trim() || '';
      row.email = values[4]?.trim() || '';
      row.company = values[5]?.trim() || '';
      row.roleClarity = values[6]?.trim() || '';
      row.hasJobDescription = values[7]?.trim() || '';
      row.mostImportantJob = values[8]?.trim() || '';
      row.confidence = values[9]?.trim() || '';
      row.naturalStrength = values[10]?.trim() || '';
      row.biggestDifficulty = values[11]?.trim() || '';
      row.skillToMaster = values[12]?.trim() || '';
      row.workload = values[13]?.trim() || '';
      row.mentalDrain = values[14]?.trim() || '';
      row.focus = values[15]?.trim() || '';
      row.workLifeSacrifice = values[16]?.trim() || '';
      row.energyDrain = values[17]?.trim() || '';
      row.burnout = values[18]?.trim() || '';
      row.learningPreference = values[19]?.trim() || '';
      row.weeklyDevHours = values[20]?.trim() || '';
      row.learningMotivation = values[21]?.trim() || '';
      row.neededTraining = values[22]?.trim() || '';
      row.growthBarrier = values[23]?.trim() || '';
      row.listens_podcasts = values[24]?.trim() || '';
      row.watches_youtube = values[25]?.trim() || '';
      row.reads_books = values[26]?.trim() || '';
      row.seesGrowthPath = values[27]?.trim() || '';
      row.managerSupport = values[28]?.trim() || '';
      row.feelsValued = values[29]?.trim() || '';
      row.energyLevel = values[30]?.trim() || '';
      row.wouldStay = values[31]?.trim() || '';
      row.retentionImprovement = values[32]?.trim() || '';
      row.seesLeadership = values[33]?.trim() || '';
      row.threeYearGoal = values[34]?.trim() || '';
      row.companySupportingGoal = values[35]?.trim() || '';
      row.workObstacle = values[36]?.trim() || '';
      row.biggestFrustration = values[37]?.trim() || '';
      row.whyPeopleLeave = values[38]?.trim() || '';
      row.whatEnjoyMost = values[39]?.trim() || '';
      row.leadershipShouldUnderstand = values[40]?.trim() || '';
      row.additionalFeedback = values[41]?.trim() || '';
      row.recentAccomplishment = values[42]?.trim() || '';
      row.recentChallenge = values[43]?.trim() || '';
      row.neededTrainingEffectiveness = values[44]?.trim() || '';
      row.twelveMonthGoal = values[45]?.trim() || '';
      row.supportFromLeadership = values[46]?.trim() || '';
      row.oneYearVision = values[47]?.trim() || '';
      
      data.push(row);
    }
    
    return data;
  };

  const handleClear = async () => {
    if (!confirm('Delete all diagnostic responses for Stateline Cooperative? This cannot be undone.')) {
      return;
    }
    
    try {
      setClearing(true);
      
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', '%stateline%')
        .single();
      
      if (!company) {
        toast.error('Stateline Cooperative company not found');
        return;
      }
      
      const { error } = await supabase
        .from('diagnostic_responses')
        .delete()
        .eq('company_id', company.id);
      
      if (error) throw error;
      
      toast.success('Cleared all diagnostic responses for Stateline Cooperative');
    } catch (error: any) {
      console.error('Clear error:', error);
      toast.error(error.message || "Failed to clear data");
    } finally {
      setClearing(false);
    }
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
          
          <div className="flex gap-2">
            <Button 
              onClick={handleImport} 
              disabled={loading || !csvText.trim()}
            >
              {loading ? "Importing..." : "Import Diagnostic Data"}
            </Button>
            
            <Button 
              onClick={handleClear} 
              disabled={clearing}
              variant="destructive"
            >
              {clearing ? "Clearing..." : "Clear Stateline Data"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
