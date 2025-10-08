import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Star, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Vendor = {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  is_preferred: boolean;
  is_active: boolean;
  contact_email: string | null;
  contact_phone: string | null;
};

type Course = {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  course_url: string | null;
  cost_per_person: number | null;
  duration_hours: number | null;
  capability_tags: string[] | null;
  delivery_format: string | null;
  difficulty_level: string | null;
  is_active: boolean;
};

export default function SuperAdminVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const { toast } = useToast();

  const [vendorForm, setVendorForm] = useState({
    name: "",
    description: "",
    website_url: "",
    logo_url: "",
    is_preferred: false,
    is_active: true,
    contact_email: "",
    contact_phone: "",
  });

  const [courseForm, setCourseForm] = useState({
    vendor_id: "",
    title: "",
    description: "",
    course_url: "",
    cost_per_person: "",
    duration_hours: "",
    capability_tags: "",
    delivery_format: "online",
    difficulty_level: "intermediate",
    is_active: true,
  });

  useEffect(() => {
    loadVendors();
    loadCourses();
  }, []);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("training_vendors" as any)
        .select("*")
        .order("is_preferred", { ascending: false })
        .order("name");

      if (error) throw error;
      setVendors((data as any) || []);
    } catch (error: any) {
      toast({ title: "Error loading vendors", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("vendor_courses" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses((data as any) || []);
    } catch (error: any) {
      toast({ title: "Error loading courses", description: error.message, variant: "destructive" });
    }
  };

  const handleVendorSubmit = async () => {
    try {
      if (editingVendor) {
        const { error } = await supabase
          .from("training_vendors" as any)
          .update(vendorForm)
          .eq("id", editingVendor.id);
        if (error) throw error;
        toast({ title: "Vendor updated successfully" });
      } else {
        const { error } = await supabase.from("training_vendors" as any).insert(vendorForm);
        if (error) throw error;
        toast({ title: "Vendor created successfully" });
      }
      setDialogOpen(false);
      resetVendorForm();
      loadVendors();
    } catch (error: any) {
      toast({ title: "Error saving vendor", description: error.message, variant: "destructive" });
    }
  };

  const handleCourseSubmit = async () => {
    try {
      const courseData = {
        ...courseForm,
        cost_per_person: courseForm.cost_per_person ? parseFloat(courseForm.cost_per_person) : null,
        duration_hours: courseForm.duration_hours ? parseInt(courseForm.duration_hours) : null,
        capability_tags: courseForm.capability_tags.split(",").map((t) => t.trim()).filter(Boolean),
      };

      if (editingCourse) {
        const { error } = await supabase
          .from("vendor_courses" as any)
          .update(courseData)
          .eq("id", editingCourse.id);
        if (error) throw error;
        toast({ title: "Course updated successfully" });
      } else {
        const { error } = await supabase.from("vendor_courses" as any).insert(courseData);
        if (error) throw error;
        toast({ title: "Course created successfully" });
      }
      setCourseDialogOpen(false);
      resetCourseForm();
      loadCourses();
    } catch (error: any) {
      toast({ title: "Error saving course", description: error.message, variant: "destructive" });
    }
  };

  const openVendorDialog = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      setVendorForm(vendor);
    } else {
      resetVendorForm();
    }
    setDialogOpen(true);
  };

  const openCourseDialog = (vendorId?: string, course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setCourseForm({
        vendor_id: course.vendor_id,
        title: course.title,
        description: course.description || "",
        course_url: course.course_url || "",
        cost_per_person: course.cost_per_person?.toString() || "",
        duration_hours: course.duration_hours?.toString() || "",
        capability_tags: course.capability_tags?.join(", ") || "",
        delivery_format: course.delivery_format || "online",
        difficulty_level: course.difficulty_level || "intermediate",
        is_active: course.is_active,
      });
    } else {
      resetCourseForm();
      if (vendorId) {
        setCourseForm((prev) => ({ ...prev, vendor_id: vendorId }));
      }
    }
    setCourseDialogOpen(true);
  };

  const resetVendorForm = () => {
    setEditingVendor(null);
    setVendorForm({
      name: "",
      description: "",
      website_url: "",
      logo_url: "",
      is_preferred: false,
      is_active: true,
      contact_email: "",
      contact_phone: "",
    });
  };

  const resetCourseForm = () => {
    setEditingCourse(null);
    setCourseForm({
      vendor_id: "",
      title: "",
      description: "",
      course_url: "",
      cost_per_person: "",
      duration_hours: "",
      capability_tags: "",
      delivery_format: "online",
      difficulty_level: "intermediate",
      is_active: true,
    });
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Training Vendor Management</h1>
        <Button onClick={() => openVendorDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Vendor
        </Button>
      </div>

      <Tabs defaultValue="vendors">
        <TabsList>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="courses">Course Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="space-y-4 mt-4">
          {vendors.map((vendor) => (
            <Card key={vendor.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {vendor.name}
                  {vendor.is_preferred && <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />}
                  {!vendor.is_active && <Badge variant="secondary">Inactive</Badge>}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openVendorDialog(vendor)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openCourseDialog(vendor.id)}>
                    Add Course
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{vendor.description}</p>
                {vendor.website_url && (
                  <a href={vendor.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {vendor.website_url}
                  </a>
                )}
                <div className="mt-4">
                  <p className="text-sm font-semibold mb-2">Courses:</p>
                  <div className="space-y-2">
                    {courses.filter((c) => c.vendor_id === vendor.id).map((course) => (
                      <div key={course.id} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <p className="font-medium">{course.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {course.cost_per_person ? `$${course.cost_per_person}` : "Free"} • {course.duration_hours}h • {course.delivery_format}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => openCourseDialog(undefined, course)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="courses" className="space-y-4 mt-4">
          <Button onClick={() => openCourseDialog()}>
            <Plus className="mr-2 h-4 w-4" /> Add Course
          </Button>
          {courses.map((course) => {
            const vendor = vendors.find((v) => v.id === course.vendor_id);
            return (
              <Card key={course.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>{course.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{vendor?.name}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openCourseDialog(undefined, course)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-2">{course.description}</p>
                  <div className="flex gap-4 text-sm">
                    <span>Cost: {course.cost_per_person ? `$${course.cost_per_person}` : "Free"}</span>
                    <span>Duration: {course.duration_hours}h</span>
                    <span>Format: {course.delivery_format}</span>
                    <span>Level: {course.difficulty_level}</span>
                  </div>
                  {course.capability_tags && course.capability_tags.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {course.capability_tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Vendor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendor Name</Label>
              <Input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={vendorForm.description} onChange={(e) => setVendorForm({ ...vendorForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Website URL</Label>
              <Input value={vendorForm.website_url} onChange={(e) => setVendorForm({ ...vendorForm, website_url: e.target.value })} />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input value={vendorForm.contact_email} onChange={(e) => setVendorForm({ ...vendorForm, contact_email: e.target.value })} />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input value={vendorForm.contact_phone} onChange={(e) => setVendorForm({ ...vendorForm, contact_phone: e.target.value })} />
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={vendorForm.is_preferred} onCheckedChange={(checked) => setVendorForm({ ...vendorForm, is_preferred: checked })} />
              <Label>Preferred Vendor (Momentum Company)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={vendorForm.is_active} onCheckedChange={(checked) => setVendorForm({ ...vendorForm, is_active: checked })} />
              <Label>Active</Label>
            </div>
            <Button onClick={handleVendorSubmit} className="w-full">
              {editingVendor ? "Update" : "Create"} Vendor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Dialog */}
      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Edit Course" : "Add Course"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendor</Label>
              <select
                className="w-full p-2 border rounded"
                value={courseForm.vendor_id}
                onChange={(e) => setCourseForm({ ...courseForm, vendor_id: e.target.value })}
              >
                <option value="">Select Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Course Title</Label>
              <Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Course URL</Label>
              <Input value={courseForm.course_url} onChange={(e) => setCourseForm({ ...courseForm, course_url: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cost Per Person ($)</Label>
                <Input type="number" value={courseForm.cost_per_person} onChange={(e) => setCourseForm({ ...courseForm, cost_per_person: e.target.value })} />
              </div>
              <div>
                <Label>Duration (hours)</Label>
                <Input type="number" value={courseForm.duration_hours} onChange={(e) => setCourseForm({ ...courseForm, duration_hours: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Capability Tags (comma-separated)</Label>
              <Input value={courseForm.capability_tags} onChange={(e) => setCourseForm({ ...courseForm, capability_tags: e.target.value })} placeholder="Leadership, Communication, Sales" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Delivery Format</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={courseForm.delivery_format}
                  onChange={(e) => setCourseForm({ ...courseForm, delivery_format: e.target.value })}
                >
                  <option value="online">Online</option>
                  <option value="in-person">In-Person</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="self-paced">Self-Paced</option>
                </select>
              </div>
              <div>
                <Label>Difficulty Level</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={courseForm.difficulty_level}
                  onChange={(e) => setCourseForm({ ...courseForm, difficulty_level: e.target.value })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={courseForm.is_active} onCheckedChange={(checked) => setCourseForm({ ...courseForm, is_active: checked })} />
              <Label>Active</Label>
            </div>
            <Button onClick={handleCourseSubmit} className="w-full">
              {editingCourse ? "Update" : "Create"} Course
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
