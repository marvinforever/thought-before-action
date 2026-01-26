import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle2, FileSpreadsheet, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Company {
  id: string;
  name: string;
}

export default function AdminCustomerHistoryImport() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [importResults, setImportResults] = useState<{
    imported: number;
    errors: number;
  } | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    
    if (data) {
      setCompanies(data);
    }
  };

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

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    // Map header names to our field names
    const headerMap: Record<string, string> = {
      'customer': 'customer_code',
      'customer name': 'customer_name',
      'product description': 'product_description',
      'sale date': 'sale_date',
      'quantity': 'quantity',
      'amount': 'amount',
      'avg price': 'avg_price',
      'u/m': 'unit_of_measure',
      'address 1': 'address_1',
      'address 2': 'address_2',
      'city': 'city',
      'st': 'state',
      'zip code': 'zip_code',
      'phone': 'phone',
      'product': 'product_code',
      'epa number': 'epa_number',
      'rep name': 'rep_name',
      'season': 'season',
      'sort category': 'sort_category',
      'bonus category': 'bonus_category',
      'b amount': 'bonus_amount',
      '11.4 category': 'category_11_4',
      '11.4 quanitiy': 'quantity_11_4',
      '11.4 quantity': 'quantity_11_4',
    };

    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => {
      const normalized = h.trim().toLowerCase();
      return headerMap[normalized] || normalized.replace(/\s+/g, '_');
    });

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim() || '';
      });
      
      // Only add if we have a customer name
      if (row.customer_name) {
        data.push(row);
      }
    }
    
    return data;
  };

  const handleClear = async () => {
    if (!selectedCompany) {
      toast.error('Please select a company first');
      return;
    }

    const company = companies.find(c => c.id === selectedCompany);
    if (!confirm(`Delete all customer purchase history for ${company?.name}? This cannot be undone.`)) {
      return;
    }
    
    try {
      setClearing(true);
      
      const { error } = await supabase
        .from('customer_purchase_history')
        .delete()
        .eq('company_id', selectedCompany);
      
      if (error) throw error;
      
      toast.success(`Cleared all purchase history for ${company?.name}`);
    } catch (error: any) {
      console.error('Clear error:', error);
      toast.error(error.message || "Failed to clear data");
    } finally {
      setClearing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCompany) {
      toast.error('Please select a company');
      return;
    }

    try {
      setLoading(true);
      
      const csvData = parseCSV(csvText);
      
      if (csvData.length === 0) {
        toast.error('No valid data rows found in CSV');
        return;
      }

      toast.info(`Importing ${csvData.length} rows...`);

      const { data, error } = await supabase.functions.invoke('import-customer-history', {
        body: { 
          csvData,
          companyId: selectedCompany,
          sourceFile: `manual_import_${new Date().toISOString()}`
        }
      });

      if (error) throw error;

      setImportResults({
        imported: data.imported || 0,
        errors: data.errors || 0
      });
      setShowSuccessDialog(true);
      setCsvText("");
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "Failed to import data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <AlertDialogTitle>Import Complete</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              {importResults && (
                <div className="text-left space-y-1">
                  <p className="text-base">
                    <span className="font-semibold text-green-600">{importResults.imported.toLocaleString()}</span> purchase records imported successfully
                  </p>
                  {importResults.errors > 0 && (
                    <p className="text-base">
                      <span className="font-semibold text-red-600">{importResults.errors.toLocaleString()}</span> errors encountered
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>Done</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto p-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              <h2 className="text-2xl font-bold">Import Customer Purchase History</h2>
            </div>
            
            <p className="text-muted-foreground">
              Import historical customer transaction data from a CSV export. This data will be available to Jericho for sales coaching.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Company</label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Choose a company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-medium">Expected CSV Columns:</h3>
              <p className="text-sm text-muted-foreground">
                Customer, Customer Name, Product Description, SALE DATE, Quantity, Amount, Avg Price, U/M, 
                Address 1, Address 2, City, ST, Zip Code, Phone, Product, EPA Number, Rep Name, 
                Season, Sort Category, BONUS CATEGORY, B AMOUNT, 11.4 CATEGORY, 11.4 QUANITIY
              </p>
            </div>
            
            <Textarea
              placeholder="Paste CSV data here (including header row)..."
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />

            {csvText && (
              <p className="text-sm text-muted-foreground">
                Preview: {parseCSV(csvText).length.toLocaleString()} rows detected
              </p>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={handleImport} 
                disabled={loading || !csvText.trim() || !selectedCompany}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {loading ? "Importing..." : "Import Purchase History"}
              </Button>
              
              <Button 
                onClick={handleClear} 
                disabled={clearing || !selectedCompany}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {clearing ? "Clearing..." : "Clear Company Data"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
