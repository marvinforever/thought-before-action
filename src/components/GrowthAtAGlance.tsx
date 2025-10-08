import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight } from "lucide-react";

export function GrowthAtAGlance() {
  const navigate = useNavigate();

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Team Growth Overview</CardTitle>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => navigate('/dashboard/growth-roadmap')}
          >
            View Full Roadmap
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Access your team's strategic growth roadmap and get AI-powered insights to drive organizational development.
        </p>

        <Button 
          className="w-full" 
          size="sm"
          onClick={() => {
            const event = new CustomEvent('openJerichoChat', { detail: { contextType: 'growth-path' } });
            window.dispatchEvent(event);
          }}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Chat with Jericho About Your Team's Growth
        </Button>
      </CardContent>
    </Card>
  );
}