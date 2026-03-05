import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileText, Image, FileSpreadsheet, File } from "lucide-react";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  companyId: string;
  customers: { id: string; name: string }[];
  onUploadComplete?: () => void;
}

const ACCEPTED_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'application/msword': 'Word',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.ms-powerpoint': 'PowerPoint',
  'image/jpeg': 'Image',
  'image/png': 'Image',
  'image/webp': 'Image',
  'text/plain': 'Text',
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
  if (type === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
  if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
  return <File className="h-8 w-8 text-muted-foreground" />;
};

export function DocumentUploadDialog({
  open,
  onOpenChange,
  userId,
  companyId,
  customers,
  onUploadComplete,
}: DocumentUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [customerId, setCustomerId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!Object.keys(ACCEPTED_TYPES).includes(selectedFile.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF, Word, Excel, PowerPoint, or image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (20MB max)
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 20MB.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    try {
      // Generate unique storage path
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${companyId}/${userId}/${timestamp}_${safeName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('customer-documents')
        .upload(storagePath, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Create document record
      const { data: doc, error: insertError } = await supabase
        .from('customer_documents')
        .insert({
          company_id: companyId,
          uploaded_by: userId,
          customer_id: (customerId && customerId !== '__none__') ? customerId : null,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          extraction_status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Failed to create record: ${insertError.message}`);
      }

      toast({ title: "📄 Document uploaded!", description: "Extracting content..." });
      setUploading(false);
      setExtracting(true);

      // Trigger extraction
      const { error: extractError } = await supabase.functions.invoke('extract-customer-document', {
        body: { documentId: doc.id },
      });

      if (extractError) {
        console.error('Extraction error:', extractError);
        toast({
          title: "Upload complete",
          description: "Document saved, but content extraction failed. You can try again later.",
          variant: "destructive",
        });
      } else {
        toast({ 
          title: "✅ Document ready!",
          description: "Content extracted. Jericho can now reference this document."
        });
      }

      // Reset and close
      setFile(null);
      setCustomerId("");
      setExtracting(false);
      onOpenChange(false);
      onUploadComplete?.();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setUploading(false);
      setExtracting(false);
    }
  };

  const handleClose = () => {
    if (uploading || extracting) return;
    setFile(null);
    setCustomerId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a document for Jericho to reference. PDFs, Office docs, and images are supported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                {getFileIcon(file.type)}
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-sm">Click to select a file</p>
                <p className="text-xs text-muted-foreground">
                  PDF, Word, Excel, PowerPoint, or images
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={Object.keys(ACCEPTED_TYPES).join(',')}
            onChange={handleFileSelect}
          />

          {/* Customer Association */}
          <div className="space-y-2">
            <Label>Associate with customer (optional)</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="General knowledge (all customers)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">General knowledge (all customers)</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Customer-specific docs appear when discussing that customer. General docs are available for all conversations.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading || extracting}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!file || uploading || extracting}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : extracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
