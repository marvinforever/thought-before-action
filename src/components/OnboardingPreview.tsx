import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, RotateCcw } from "lucide-react";
import { PhasedOnboarding } from "./PhasedOnboarding";

export function OnboardingPreview() {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const resetPreview = () => {
    setPreviewKey(prev => prev + 1);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Onboarding Preview
          </CardTitle>
          <CardDescription>
            Preview the phased onboarding experience that new users see
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This allows you to see exactly what new users experience during their onboarding journey, 
            including the phased approach with bite-sized tasks and celebration animations.
          </p>
          <Button onClick={() => setIsPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview Onboarding
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Onboarding Preview</DialogTitle>
              <Button variant="outline" size="sm" onClick={resetPreview}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </DialogHeader>
          <div className="py-4">
            <PhasedOnboarding 
              key={previewKey}
              isPreview={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
