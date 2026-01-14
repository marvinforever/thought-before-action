import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, FileDown, Loader2, Plus, Trash2, Building2, User, Package, Eye, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface Product {
  id: string;
  name: string;
  pitch: string;
  benefits: string[];
  price?: string;
  included: boolean;
}

interface ExistingCustomer {
  id: string;
  name: string;
  location?: string;
  grower_history?: string;
  operation_details?: any;
}

interface SalesProposalWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationContext?: string;
  companyId?: string;
}

export const SalesProposalWizard = ({ 
  open, 
  onOpenChange, 
  conversationContext,
  companyId 
}: SalesProposalWizardProps) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Existing customers
  const [existingCustomers, setExistingCustomers] = useState<ExistingCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  
  // Step 1: Customer Info
  const [customerName, setCustomerName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [growerContext, setGrowerContext] = useState("");
  
  // Step 2: Products
  const [products, setProducts] = useState<Product[]>([]);
  
  // Step 3: Branding (persistent)
  const [companyName, setCompanyName] = useState("");
  const [salesRepName, setSalesRepName] = useState("");
  const [salesRepTitle, setSalesRepTitle] = useState("Sales Representative");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [salesRepEmail, setSalesRepEmail] = useState("");
  const [tagline, setTagline] = useState("Growing Together");
  const [primaryColor, setPrimaryColor] = useState("#16a34a");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  // Step 4: Additional
  const [introMessage, setIntroMessage] = useState("");
  const [closingMessage, setClosingMessage] = useState("");

  const steps = [
    { number: 1, label: "Customer", icon: User },
    { number: 2, label: "Products", icon: Package },
    { number: 3, label: "Your Info", icon: Building2 },
    { number: 4, label: "Preview", icon: Eye },
  ];

  // Load user profile, customers, and saved branding on open
  useEffect(() => {
    if (open) {
      loadUserInfo();
      loadExistingCustomers();
      if (conversationContext) {
        extractProductsFromChat();
      }
    }
  }, [open, conversationContext]);

  const loadExistingCustomers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: customers } = await supabase
      .from('sales_companies')
      .select('id, name, location, grower_history, operation_details')
      .eq('profile_id', user.id)
      .order('name');

    if (customers) {
      setExistingCustomers(customers);
    }
  };

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, company_id, company_logo_url, companies(name)')
      .eq('id', user.id)
      .single();

    if (profile) {
      setSalesRepName(profile.full_name || '');
      setSalesRepEmail(profile.email || user.email || '');
      setCompanyName((profile.companies as any)?.name || '');
      if (profile.company_logo_url) {
        setLogoUrl(profile.company_logo_url);
        setLogoPreview(profile.company_logo_url);
      }
    }
  };

  const handleCustomerSelect = (value: string) => {
    if (value === "new") {
      setIsNewCustomer(true);
      setSelectedCustomerId("");
      setCustomerName("");
      setFarmName("");
      setGrowerContext("");
    } else {
      setIsNewCustomer(false);
      setSelectedCustomerId(value);
      const customer = existingCustomers.find(c => c.id === value);
      if (customer) {
        // Parse name - might be "Mike Harlan - Harlan Farms" format
        const nameParts = customer.name.split(' - ');
        setCustomerName(nameParts[0] || customer.name);
        setFarmName(nameParts[1] || customer.location || '');
        
        // Set grower context from history
        if (customer.grower_history) {
          setGrowerContext(customer.grower_history);
        }
        if (customer.operation_details && typeof customer.operation_details === 'object') {
          const details = customer.operation_details as Record<string, any>;
          if (details.key_quote) {
            setIntroMessage(`Based on our ongoing partnership and your goal to "${details.key_quote}", I've put together these recommendations specifically for your operation.`);
          }
        }
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Save to profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ company_logo_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      toast.success('Logo saved! It will be used for all future proposals.');
    } catch (err) {
      console.error('Logo upload failed:', err);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ company_logo_url: null })
        .eq('id', user.id);

      setLogoUrl(null);
      setLogoPreview(null);
      toast.success('Logo removed');
    } catch (err) {
      console.error('Failed to remove logo:', err);
    }
  };

  const extractProductsFromChat = async () => {
    if (!conversationContext) return;
    
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-proposal-products', {
        body: { conversationContext }
      });

      if (error) throw error;

      if (data?.products && Array.isArray(data.products)) {
        setProducts(data.products.map((p: any, idx: number) => ({
          id: `product-${idx}`,
          name: p.name || 'Product',
          pitch: p.pitch || '',
          benefits: p.benefits || [],
          price: p.price || '',
          included: true
        })));
      }

      if (data?.customerName) setCustomerName(data.customerName);
      if (data?.farmName) setFarmName(data.farmName);
      if (data?.introMessage && !introMessage) setIntroMessage(data.introMessage);
    } catch (err) {
      console.error('Failed to extract products:', err);
      setProducts([{
        id: 'product-1',
        name: 'Product Recommendation',
        pitch: 'Based on your specific needs',
        benefits: ['Addresses your key challenges', 'Proven results'],
        included: true
      }]);
    } finally {
      setExtracting(false);
    }
  };

  const addProduct = () => {
    setProducts([...products, {
      id: `product-${Date.now()}`,
      name: '',
      pitch: '',
      benefits: [''],
      included: true
    }]);
  };

  const updateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const addBenefit = (productId: string) => {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, benefits: [...p.benefits, ''] } : p
    ));
  };

  const updateBenefit = (productId: string, index: number, value: string) => {
    setProducts(products.map(p => 
      p.id === productId ? { 
        ...p, 
        benefits: p.benefits.map((b, i) => i === index ? value : b) 
      } : p
    ));
  };

  const removeBenefit = (productId: string, index: number) => {
    setProducts(products.map(p => 
      p.id === productId ? { 
        ...p, 
        benefits: p.benefits.filter((_, i) => i !== index) 
      } : p
    ));
  };

  const generatePDF = async () => {
    setLoading(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 22, g: 163, b: 74 };
      };

      const color = hexToRgb(primaryColor);

      // Header bar
      doc.setFillColor(color.r, color.g, color.b);
      doc.rect(0, 0, pageWidth, 40, 'F');

      // Add logo if available
      if (logoUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = logoUrl;
          });
          // Add logo to right side of header
          const logoHeight = 25;
          const logoWidth = (img.width / img.height) * logoHeight;
          doc.addImage(img, 'PNG', pageWidth - margin - logoWidth, 7.5, logoWidth, logoHeight);
        } catch (err) {
          console.warn('Could not add logo to PDF:', err);
        }
      }

      // Company name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName || 'Your Company', margin, 25);

      // Tagline
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(tagline, margin, 33);

      y = 55;

      // Proposal title
      doc.setTextColor(color.r, color.g, color.b);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Product Recommendation', margin, y);
      y += 10;

      // Prepared for
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const preparedFor = `Prepared for: ${customerName}${farmName ? ` - ${farmName}` : ''}`;
      doc.text(preparedFor, margin, y);
      y += 5;
      doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, y);
      y += 15;

      // Intro message
      if (introMessage) {
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(11);
        const introLines = doc.splitTextToSize(introMessage, pageWidth - (margin * 2));
        doc.text(introLines, margin, y);
        y += introLines.length * 6 + 10;
      }

      // Products section
      const includedProducts = products.filter(p => p.included);
      
      for (const product of includedProducts) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        // Product header
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, y, pageWidth - (margin * 2), 10, 2, 2, 'F');
        
        doc.setTextColor(color.r, color.g, color.b);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(product.name, margin + 5, y + 7);
        
        if (product.price) {
          doc.setFontSize(12);
          doc.setTextColor(60, 60, 60);
          const priceWidth = doc.getTextWidth(product.price);
          doc.text(product.price, pageWidth - margin - priceWidth - 5, y + 7);
        }
        y += 15;

        // Product pitch
        if (product.pitch) {
          doc.setTextColor(80, 80, 80);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          const pitchLines = doc.splitTextToSize(product.pitch, pageWidth - (margin * 2) - 10);
          doc.text(pitchLines, margin + 5, y);
          y += pitchLines.length * 5 + 5;
        }

        // Benefits
        const validBenefits = product.benefits.filter(b => b.trim());
        if (validBenefits.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          
          for (const benefit of validBenefits) {
            doc.setFillColor(color.r, color.g, color.b);
            doc.circle(margin + 7, y - 1, 1.5, 'F');
            const benefitLines = doc.splitTextToSize(benefit, pageWidth - (margin * 2) - 20);
            doc.text(benefitLines, margin + 12, y);
            y += benefitLines.length * 5 + 2;
          }
        }

        y += 10;
      }

      // Closing message
      if (closingMessage) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const closingLines = doc.splitTextToSize(closingMessage, pageWidth - (margin * 2));
        doc.text(closingLines, margin, y);
        y += closingLines.length * 6 + 15;
      }

      // Footer with sales rep info
      const footerY = doc.internal.pageSize.getHeight() - 30;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'bold');
      doc.text(salesRepName, margin, footerY);
      doc.setFont('helvetica', 'normal');
      doc.text(salesRepTitle, margin, footerY + 5);
      
      const contactInfo = [salesRepPhone, salesRepEmail].filter(Boolean).join(' | ');
      if (contactInfo) {
        doc.text(contactInfo, margin, footerY + 10);
      }

      // Save
      const fileName = `Proposal_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success('Proposal downloaded!');
      onOpenChange(false);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return customerName.trim().length > 0;
      case 2: return products.filter(p => p.included && p.name.trim()).length > 0;
      case 3: return salesRepName.trim().length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedCustomerId("");
    setIsNewCustomer(true);
    setCustomerName("");
    setFarmName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setGrowerContext("");
    setProducts([]);
    setIntroMessage("");
    setClosingMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetWizard(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Create Sales Proposal
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg">
          {steps.map((s, idx) => (
            <div key={s.number} className="flex items-center">
              <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                  step === s.number 
                    ? 'bg-primary text-primary-foreground' 
                    : step > s.number 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                <s.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${step > s.number ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {extracting && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Sparkles className="h-5 w-5 animate-pulse" />
              <span>Extracting products from conversation...</span>
            </div>
          )}

          {!extracting && step === 1 && (
            <div className="space-y-4">
              {/* Customer dropdown */}
              <div className="space-y-2">
                <Label>Select Customer</Label>
                <Select value={selectedCustomerId || "new"} onValueChange={handleCustomerSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose existing or add new..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">+ Add New Customer</SelectItem>
                    {existingCustomers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} {customer.location && `(${customer.location})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="farmName">Farm/Operation Name</Label>
                <Input
                  id="farmName"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="Smith Family Farms"
                />
              </div>
              
              {growerContext && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <Label className="text-xs text-muted-foreground">Customer History (from CRM)</Label>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {growerContext.substring(0, 500)}...
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="john@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input
                    id="customerPhone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="introMessage">Personal Message</Label>
                <Textarea
                  id="introMessage"
                  value={introMessage}
                  onChange={(e) => setIntroMessage(e.target.value)}
                  placeholder="Thank you for taking the time to discuss your operation. Based on our conversation, I've put together these recommendations..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {!extracting && step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {products.filter(p => p.included).length} product(s) selected
                </p>
                <Button variant="outline" size="sm" onClick={addProduct}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Product
                </Button>
              </div>

              {products.map((product) => (
                <Card key={product.id} className={!product.included ? 'opacity-50' : ''}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={product.included}
                        onCheckedChange={(checked) => updateProduct(product.id, 'included', checked)}
                      />
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                          <Input
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                            placeholder="Product name"
                            className="flex-1"
                          />
                          <Input
                            value={product.price || ''}
                            onChange={(e) => updateProduct(product.id, 'price', e.target.value)}
                            placeholder="Price (optional)"
                            className="w-32"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <Textarea
                          value={product.pitch}
                          onChange={(e) => updateProduct(product.id, 'pitch', e.target.value)}
                          placeholder="One-liner pitch..."
                          rows={2}
                        />
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Benefits</Label>
                          {product.benefits.map((benefit, bIdx) => (
                            <div key={bIdx} className="flex gap-2">
                              <Input
                                value={benefit}
                                onChange={(e) => updateBenefit(product.id, bIdx, e.target.value)}
                                placeholder="Key benefit..."
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBenefit(product.id, bIdx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addBenefit(product.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add benefit
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {products.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No products yet. Add products to include in your proposal.</p>
                </div>
              )}
            </div>
          )}

          {!extracting && step === 3 && (
            <div className="space-y-4">
              {/* Logo upload */}
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img 
                        src={logoPreview} 
                        alt="Company logo" 
                        className="h-16 w-auto object-contain rounded border"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full"
                        onClick={removeLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="h-16 w-32 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted/50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <div className="text-xs text-muted-foreground">
                    <p>Upload once, use forever</p>
                    <p>Max 2MB, PNG/JPG</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Your Company Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Agricultural Supply"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Growing Together"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salesRepName">Your Name *</Label>
                  <Input
                    id="salesRepName"
                    value={salesRepName}
                    onChange={(e) => setSalesRepName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salesRepTitle">Title</Label>
                  <Input
                    id="salesRepTitle"
                    value={salesRepTitle}
                    onChange={(e) => setSalesRepTitle(e.target.value)}
                    placeholder="Sales Representative"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salesRepPhone">Your Phone</Label>
                  <Input
                    id="salesRepPhone"
                    value={salesRepPhone}
                    onChange={(e) => setSalesRepPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salesRepEmail">Your Email</Label>
                  <Input
                    id="salesRepEmail"
                    value={salesRepEmail}
                    onChange={(e) => setSalesRepEmail(e.target.value)}
                    placeholder="jane@company.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Brand Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#16a34a"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="closingMessage">Closing Message</Label>
                <Textarea
                  id="closingMessage"
                  value={closingMessage}
                  onChange={(e) => setClosingMessage(e.target.value)}
                  placeholder="I look forward to discussing these recommendations with you. Please don't hesitate to reach out with any questions."
                  rows={3}
                />
              </div>
            </div>
          )}

          {!extracting && step === 4 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Proposal Preview</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{customerName} {farmName && `- ${farmName}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Products:</span>
                    <span className="font-medium">{products.filter(p => p.included).length} included</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-medium">{salesRepName}, {companyName}</span>
                  </div>
                  {logoPreview && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Logo:</span>
                      <img src={logoPreview} alt="Logo" className="h-8 w-auto" />
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Products included:</p>
                  <div className="flex flex-wrap gap-2">
                    {products.filter(p => p.included).map(p => (
                      <Badge key={p.id} variant="secondary">{p.name}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color preview */}
              <div 
                className="rounded-lg p-4 text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <p className="font-bold text-lg">{companyName || 'Your Company'}</p>
                <p className="text-sm opacity-90">{tagline}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {step < 4 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed() || extracting}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={generatePDF} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Download PDF
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
