import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle2, Target, AlertCircle } from "lucide-react";
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

interface ParsedRow {
  seller: string;
  farmer_name: string;
  estimated_acres: string;
  type_of_customer: string;
  primary_growth_category: string;
  secondary_growth_category: string;
  third_growth_category: string;
  notes?: string;
}

// Known reps for validation display
const KNOWN_REPS = [
  "Christian O'Banion",
  "Joel Loseke",
  "Ed Lehman",
  "Kally Windschitl",
  "Kelli Barnett",
  "Clay Mogard",
  "Ben Borchardt",
  "Blake Miller",
  "Trevor Kluver",
];

export default function AdminTargetedAccountsImport() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
    errors: number;
    unmatchedSellers: string[];
  } | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (csvText.trim()) {
      const parsed = parseCSV(csvText);
      setParsedData(parsed);
    } else {
      setParsedData([]);
    }
  }, [csvText]);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    
    if (data) {
      setCompanies(data);
      // Default to Stateline if available
      const stateline = data.find(c => c.name.toLowerCase().includes('stateline'));
      if (stateline) {
        setSelectedCompany(stateline.id);
      }
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
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    // Find header row (look for "seller" column)
    let headerIndex = lines.findIndex(line => 
      line.toLowerCase().includes('seller') && line.toLowerCase().includes('farmer')
    );
    
    if (headerIndex === -1) {
      // Try first non-empty row
      headerIndex = 0;
    }

    const headerMap: Record<string, string> = {
      'seller': 'seller',
      'farmer name': 'farmer_name',
      'farmer_name': 'farmer_name',
      'estimated acres': 'estimated_acres',
      'estimated_acres': 'estimated_acres',
      'type of customer': 'type_of_customer',
      'type_of_customer': 'type_of_customer',
      'primary growth category': 'primary_growth_category',
      'primary_growth_category': 'primary_growth_category',
      'secondary growth category': 'secondary_growth_category',
      'secondary_growth_category': 'secondary_growth_category',
      'third growth category': 'third_growth_category',
      'third_growth_category': 'third_growth_category',
      'notes': 'notes',
    };

    const headers = parseCSVLine(lines[headerIndex]).map(h => {
      const normalized = h.trim().toLowerCase();
      return headerMap[normalized] || normalized.replace(/\s+/g, '_');
    });

    const data: ParsedRow[] = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      
      // Only add if we have both seller and farmer name
      if (row.seller && row.farmer_name) {
        data.push(row as unknown as ParsedRow);
      }
    }
    
    return data;
  };

  const isKnownRep = (seller: string): boolean => {
    return KNOWN_REPS.some(rep => 
      rep.toLowerCase() === seller.toLowerCase()
    );
  };

  const handleImport = async () => {
    if (!selectedCompany) {
      toast.error('Please select a company');
      return;
    }

    if (parsedData.length === 0) {
      toast.error('No valid data rows found');
      return;
    }

    try {
      setLoading(true);
      toast.info(`Importing ${parsedData.length} targeted accounts...`);

      const { data, error } = await supabase.functions.invoke('import-targeted-accounts', {
        body: { 
          csvData: parsedData,
          companyId: selectedCompany,
        }
      });

      if (error) throw error;

      setImportResults({
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0,
        unmatchedSellers: data.unmatchedSellers || [],
      });
      setShowSuccessDialog(true);
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "Failed to import data");
    } finally {
      setLoading(false);
    }
  };

  const sellerStats = parsedData.reduce((acc, row) => {
    const seller = row.seller || 'Unknown';
    acc[seller] = (acc[seller] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <AlertDialogTitle>Import Complete</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3">
              {importResults && (
                <div className="text-left space-y-2">
                  <p className="text-base">
                    <span className="font-semibold text-green-600">{importResults.imported}</span> deals created/updated
                  </p>
                  {importResults.skipped > 0 && (
                    <p className="text-base">
                      <span className="font-semibold text-amber-600">{importResults.skipped}</span> skipped (unmatched sellers)
                    </p>
                  )}
                  {importResults.errors > 0 && (
                    <p className="text-base">
                      <span className="font-semibold text-red-600">{importResults.errors}</span> errors
                    </p>
                  )}
                  {importResults.unmatchedSellers.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm font-medium text-amber-800 mb-1">Unmatched Sellers:</p>
                      <p className="text-sm text-amber-700">
                        {importResults.unmatchedSellers.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => {
              setShowSuccessDialog(false);
              setCsvText("");
              setParsedData([]);
            }}>Done</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto p-6 space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              <h2 className="text-2xl font-bold">Import Targeted Accounts</h2>
            </div>
            
            <p className="text-muted-foreground">
              Import targeted prospects and growth customers as deals in the sales pipeline. Each account will be assigned to the appropriate rep with growth category targets.
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
                seller, farmer name, estimated acres, type of customer, primary growth category, secondary growth category, third growth category, notes (optional)
              </p>
            </div>
            
            <Textarea
              placeholder="Paste CSV data here (including header row)..."
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        </Card>

        {parsedData.length > 0 && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Preview: {parsedData.length} accounts</h3>
                <div className="flex gap-2">
                  {Object.entries(sellerStats).map(([seller, count]) => (
                    <Badge 
                      key={seller} 
                      variant={isKnownRep(seller) ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {seller}: {count}
                      {!isKnownRep(seller) && (
                        <AlertCircle className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seller</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead className="text-right">Acres</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Primary</TableHead>
                      <TableHead>Secondary</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 20).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <span className={isKnownRep(row.seller) ? "" : "text-red-600"}>
                            {row.seller}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{row.farmer_name}</TableCell>
                        <TableCell className="text-right">{row.estimated_acres}</TableCell>
                        <TableCell>
                          <Badge variant={row.type_of_customer?.toLowerCase().includes('prospect') ? 'secondary' : 'default'}>
                            {row.type_of_customer?.toLowerCase().includes('prospect') ? 'Prospect' : 'Customer'}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.primary_growth_category}</TableCell>
                        <TableCell>{row.secondary_growth_category}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {row.notes}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedData.length > 20 && (
                <p className="text-sm text-muted-foreground">
                  Showing 20 of {parsedData.length} rows
                </p>
              )}

              <Button 
                onClick={handleImport} 
                disabled={loading || !selectedCompany}
                className="gap-2"
                size="lg"
              >
                <Upload className="w-4 h-4" />
                {loading ? "Importing..." : `Import ${parsedData.length} Targeted Accounts`}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
