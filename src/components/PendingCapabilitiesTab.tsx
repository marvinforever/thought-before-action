import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, XCircle, Edit, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PendingCapability {
  id: string;
  name: string;
  category: string;
  description: string;
  full_description: string;
  company_id: string;
  created_at: string;
  levels: Array<{
    level: string;
    description: string;
  }>;
}

export const PendingCapabilitiesTab = () => {
  const [pendingCapabilities, setPendingCapabilities] = useState<PendingCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapability, setSelectedCapability] = useState<PendingCapability | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [editedCapability, setEditedCapability] = useState<PendingCapability | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPendingCapabilities();
  }, []);

  const loadPendingCapabilities = async () => {
    try {
      setLoading(true);
      
      // Fetch pending custom capabilities
      const { data: customCaps, error: capsError } = await supabase
        .from('custom_capabilities')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (capsError) throw capsError;

      // Fetch levels for each capability
      const capsWithLevels = await Promise.all(
        (customCaps || []).map(async (cap) => {
          const { data: levels } = await supabase
            .from('capability_levels_pending')
            .select('level, description')
            .eq('custom_capability_id', cap.id)
            .order('level');

          return {
            ...cap,
            levels: levels || []
          };
        })
      );

      setPendingCapabilities(capsWithLevels);
    } catch (error) {
      console.error('Error loading pending capabilities:', error);
      toast({
        title: "Error",
        description: "Failed to load pending capabilities",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (capability: PendingCapability) => {
    setSelectedCapability(capability);
    setEditedCapability(JSON.parse(JSON.stringify(capability))); // Deep copy
    setIsReviewOpen(true);
  };

  const handleApprove = async () => {
    if (!editedCapability) return;

    try {
      setIsApproving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert into capabilities table
      const { data: newCapability, error: capError } = await supabase
        .from('capabilities')
        .insert({
          name: editedCapability.name,
          category: editedCapability.category,
          description: editedCapability.description,
          full_description: editedCapability.full_description,
          is_custom: true,
          status: 'approved',
          created_by_company_id: editedCapability.company_id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (capError) throw capError;

      // Insert capability levels
      const levelsToInsert = editedCapability.levels.map(level => ({
        capability_id: newCapability.id,
        level: level.level,
        description: level.description,
      }));

      const { error: levelsError } = await supabase
        .from('capability_levels')
        .insert(levelsToInsert);

      if (levelsError) throw levelsError;

      // Update custom capability status
      const { error: updateError } = await supabase
        .from('custom_capabilities')
        .update({ 
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', editedCapability.id);

      if (updateError) throw updateError;

      // Check if capability has resources - flag gap if not
      const { data: resources } = await supabase
        .from('resources')
        .select('id')
        .eq('capability_id', newCapability.id)
        .limit(1);

      if (!resources || resources.length === 0) {
        await supabase
          .from('capability_resource_gaps')
          .insert({
            capability_id: newCapability.id,
            flagged_at: new Date().toISOString()
          });
      }

      toast({
        title: "Success",
        description: "Capability approved and added to library",
      });

      setIsReviewOpen(false);
      loadPendingCapabilities();
    } catch (error) {
      console.error('Error approving capability:', error);
      toast({
        title: "Error",
        description: "Failed to approve capability",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedCapability) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('custom_capabilities')
        .update({ 
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedCapability.id);

      if (error) throw error;

      toast({
        title: "Capability rejected",
        description: "The capability has been marked as rejected",
      });

      setIsReviewOpen(false);
      loadPendingCapabilities();
    } catch (error) {
      console.error('Error rejecting capability:', error);
      toast({
        title: "Error",
        description: "Failed to reject capability",
        variant: "destructive",
      });
    }
  };

  const getLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      foundational: 'bg-blue-500',
      advancing: 'bg-green-500',
      independent: 'bg-orange-500',
      mastery: 'bg-purple-500',
    };
    return <Badge className={colors[level] || 'bg-gray-500'}>{level}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending Capabilities</CardTitle>
          <CardDescription>
            Review and approve AI-generated capabilities that didn't match existing library
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingCapabilities.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No pending capabilities to review
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCapabilities.map((cap) => (
                  <TableRow key={cap.id}>
                    <TableCell className="font-medium">{cap.name}</TableCell>
                    <TableCell>{cap.category}</TableCell>
                    <TableCell className="max-w-md truncate">{cap.description}</TableCell>
                    <TableCell>{new Date(cap.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleReview(cap)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Custom Capability</DialogTitle>
            <DialogDescription>
              Review and edit the AI-generated capability before approving
            </DialogDescription>
          </DialogHeader>
          
          {editedCapability && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Capability Name</Label>
                <Input
                  id="name"
                  value={editedCapability.name}
                  onChange={(e) => setEditedCapability({ ...editedCapability, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={editedCapability.category}
                  onChange={(e) => setEditedCapability({ ...editedCapability, category: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Short Description</Label>
                <Textarea
                  id="description"
                  value={editedCapability.description}
                  onChange={(e) => setEditedCapability({ ...editedCapability, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_description">Full Description</Label>
                <Textarea
                  id="full_description"
                  value={editedCapability.full_description}
                  onChange={(e) => setEditedCapability({ ...editedCapability, full_description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-4">
                <Label>Progression Levels</Label>
                {editedCapability.levels.map((level, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        {getLevelBadge(level.level)}
                        <span className="font-medium capitalize">{level.level}</span>
                      </div>
                      <Textarea
                        value={level.description}
                        onChange={(e) => {
                          const newLevels = [...editedCapability.levels];
                          newLevels[index].description = e.target.value;
                          setEditedCapability({ ...editedCapability, levels: newLevels });
                        }}
                        rows={3}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsReviewOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              {isApproving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
