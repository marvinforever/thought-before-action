import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BookOpen, Video, Upload } from "lucide-react";
import { importLeadershipBooks } from "@/utils/importLeadershipBooks";
import { importLeadershipVideos } from "@/utils/importLeadershipVideos";

export default function AdminResourceImport() {
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleImportBooks = async () => {
    try {
      setImporting(true);
      
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const results = await importLeadershipBooks(profile.company_id);
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} books${failCount > 0 ? `, ${failCount} failed` : ''}`,
      });
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

  const handleImportVideos = async () => {
    try {
      setImporting(true);
      
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const results = await importLeadershipVideos(profile.company_id);
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} videos${failCount > 0 ? `, ${failCount} failed` : ''}`,
      });
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
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Resource Library Import</h1>
        <p className="text-muted-foreground mt-2">
          Import curated learning resources into your company's library
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <CardTitle>Leadership Books</CardTitle>
            </div>
            <CardDescription>
              Import 14 curated leadership books across all proficiency levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleImportBooks}
              disabled={importing}
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Books
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Video className="h-6 w-6 text-primary" />
              <CardTitle>Leadership Videos</CardTitle>
            </div>
            <CardDescription>
              Import 12 curated YouTube videos for leadership development
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleImportVideos}
              disabled={importing}
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Videos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
