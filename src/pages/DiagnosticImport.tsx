import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  newProfiles: number;
}

const DiagnosticImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = values[i] || null;
        });
        return obj;
      });
  };

  const mapCSVToDatabase = (row: any) => {
    return {
      department_or_team: row['Department or Team'],
      job_title_or_role: row['Job Title or Role'],
      years_with_company: row['How long have you been with this company?'],
      years_in_current_role: row['How long have you been in your current role?'],
      employment_status: row['Employment Status'],
      manages_others: row['Do you manage or supervise others?'] === '1',
      company_size: row['Approximate company size'],
      has_written_job_description: row['Do you have a written job description that accurately reflects what you actually do?'] === 'Yes',
      role_clarity_score: parseInt(row['How clear are you on what\'s expected of you in your role?']) || null,
      confidence_score: parseInt(row['How confident are you that you can consistently meet your role\'s expectations?']) || null,
      workload_status: row['In a typical week, how manageable is your workload?'],
      burnout_frequency: row['How often do you feel burned out or exhausted by your work?'],
      work_life_sacrifice_frequency: row['How often do you sacrifice personal health, rest, or family time to keep up with work?'],
      sees_growth_path: parseInt(row['I see a clear path for growth and advancement in this company.']) >= 7,
      feels_valued: parseInt(row['I feel valued for my contributions.']) >= 7,
      sees_leadership_path: row['Do you see yourself growing into a leadership role at this company someday?'] === 'Yes, definitely',
      daily_energy_level: row['How energized do you feel about your work most days?'],
      would_stay_if_offered_similar: row['If offered a similar job for similar pay elsewhere today, how likely would you be to stay at this company?'],
      three_year_goal: row['What\'s a professional goal you\'d love to accomplish in the next 3 years?'],
      company_supporting_goal: parseInt(row['Do you feel this organization is actively helping you move toward your career goals?']) >= 7,
      growth_barrier: row['What is the single biggest barrier to your professional growth right now?'],
      learning_preference: (row['Reading (articles, books, documentation)'] ? 'reading' : 
                          row['Video content (YouTube, courses, tutorials)'] ? 'visual' :
                          row['Podcasts or audio content'] ? 'auditory' :
                          row['Hands-on practice and experimentation'] ? 'hands_on' : 'mixed') as 'reading' | 'visual' | 'auditory' | 'hands_on' | 'mixed',
      listens_to_podcasts: row['Podcasts or audio content'] === 'Podcasts or audio content',
      watches_youtube: row['Video content (YouTube, courses, tutorials)'] === 'Video content (YouTube, courses, tutorials)',
      reads_books_articles: row['Reading (articles, books, documentation)'] === 'Reading (articles, books, documentation)',
      weekly_development_hours: parseFloat(row['How much time per week can you realistically dedicate to professional development?']?.split('-')[0]) || null,
      leadership_application_frequency: row['Leadership & People Influence (Examples: Leading projects, delegating, motivating others, managing conflict)'],
      communication_application_frequency: row['Communication & Collaboration (Examples: Presenting ideas, writing effectively, cross-team coordination, active listening)'],
      technical_application_frequency: row['Technical or Role-Specific Expertise (Examples: Core job skills, tools mastery, industry knowledge, technical problem-solving)'],
      strategic_thinking_application_frequency: row['Strategic Thinking & Problem-Solving (Examples: Analyzing complex situations, identifying root causes, developing solutions, planning ahead)'],
      adaptability_application_frequency: row['Adaptability & Learning Agility (Examples: Handling change, learning new skills quickly, pivoting approaches, staying resilient)'],
      work_life_integration_score: parseInt(row['How supported do you feel in maintaining healthy integration between work and personal life?']) || null,
      recent_accomplishment: row['Looking back over the past 3-6 months, what accomplishment are you most proud of at work?'],
      biggest_work_obstacle: row['If you could change ONE thing about your work experience tomorrow, what would it be?'],
      support_needed_from_leadership: row['What\'s the best way Jericho and your organization can support your growth right now?'],
      additional_feedback: row['Is there anything else you\'d like to share that would help us understand your experience and development needs?'],
      typeform_response_id: row['Network ID'],
      typeform_start_date: row['Start Date (UTC)'] ? new Date(row['Start Date (UTC)']).toISOString() : null,
      typeform_submit_date: row['Submit Date (UTC)'] ? new Date(row['Submit Date (UTC)']).toISOString() : null,
      survey_version: '1.0',
      submitted_at: row['Submit Date (UTC)'] ? new Date(row['Submit Date (UTC)']).toISOString() : new Date().toISOString(),
    };
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;
    let newProfilesCount = 0;

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", session.session.user.id)
        .single();

      if (!adminProfile?.company_id) throw new Error("Company not found");

      for (const row of rows) {
        try {
          const email = row['Email Address'];
          if (!email) {
            errors.push(`Row missing email address`);
            failedCount++;
            continue;
          }

          // Find existing profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .eq("company_id", adminProfile.company_id)
            .maybeSingle();

          if (!profile) {
            errors.push(`Employee not found: ${email}. Please create employee account first.`);
            failedCount++;
            continue;
          }

          // Insert diagnostic response
          const diagnosticData = mapCSVToDatabase(row);
          const { error: insertError } = await supabase
            .from("diagnostic_responses")
            .insert([{
              ...diagnosticData,
              profile_id: profile.id,
              company_id: adminProfile.company_id,
            }]);

          if (insertError) {
            errors.push(`Failed to import diagnostic for ${email}: ${insertError.message}`);
            failedCount++;
          } else {
            successCount++;
          }
        } catch (error: any) {
          errors.push(`Error processing row: ${error.message}`);
          failedCount++;
        }
      }

      setResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10), // Show first 10 errors
        newProfiles: newProfilesCount,
      });

      if (successCount > 0) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${successCount} diagnostic responses`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Diagnostic Data</h1>
        <p className="text-muted-foreground">Upload Typeform CSV export to import employee diagnostic responses</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Select the CSV file exported from Typeform. The system will automatically map employee emails to existing profiles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={importing}
            />
            <Button 
              onClick={handleImport} 
              disabled={!file || importing}
              className="min-w-32"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </div>

          {file && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                File selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold">{result.success}</p>
                        <p className="text-sm text-muted-foreground">Imported</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="text-2xl font-bold">{result.failed}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Import Errors:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {result.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                    {result.failed > result.errors.length && (
                      <p className="text-sm mt-2">...and {result.failed - result.errors.length} more errors</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {result.success > 0 && (
                <div className="flex gap-2">
                  <Button onClick={() => navigate("/dashboard")}>
                    View Dashboard
                  </Button>
                  <Button onClick={() => navigate("/dashboard/employees")} variant="outline">
                    View Employees
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>Export your Typeform responses as a CSV file</li>
            <li>Make sure the CSV includes the "Email Address" column</li>
            <li>Upload the CSV file using the form above</li>
            <li>The system will automatically:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Match emails to existing employee profiles</li>
                <li>Create new profiles for employees not in the system</li>
                <li>Import all diagnostic response data</li>
                <li>Update dashboard metrics</li>
              </ul>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosticImport;
