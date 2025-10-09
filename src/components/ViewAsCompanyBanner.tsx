import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { useNavigate } from "react-router-dom";

export function ViewAsCompanyBanner() {
  const { viewAsCompanyName, clearViewAsCompany } = useViewAs();
  const navigate = useNavigate();

  if (!viewAsCompanyName) return null;

  const handleExit = () => {
    clearViewAsCompany();
    navigate("/super-admin");
  };

  return (
    <Alert className="mb-4 bg-primary/10 border-primary">
      <Eye className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          <strong>Viewing as:</strong> {viewAsCompanyName}
        </span>
        <Button size="sm" variant="ghost" onClick={handleExit}>
          <X className="h-4 w-4 mr-1" />
          Exit View
        </Button>
      </AlertDescription>
    </Alert>
  );
}
