import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe base64 encoding that handles large files without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768; // Process 32KB at a time
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error('documentId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the document record
    const { data: doc, error: docError } = await supabase
      .from('customer_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${docError?.message || 'Unknown error'}`);
    }

    // Update status to processing
    await supabase
      .from('customer_documents')
      .update({ extraction_status: 'processing' })
      .eq('id', documentId);

    console.log(`Processing document: ${doc.file_name} (${doc.file_type})`);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('customer-documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    let extractedText = '';
    let summary = '';
    let documentType = doc.document_type;
    let title = doc.title || doc.file_name;

    const fileType = doc.file_type.toLowerCase();
    const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(fileType);
    const isPdf = fileType === 'application/pdf';
    const isOfficeDoc = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint'
    ].includes(fileType);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (isImage) {
      // For images, use vision model to extract text and describe content
      const base64 = arrayBufferToBase64(await fileData.arrayBuffer());
      const mimeType = doc.file_type;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${base64}` }
                },
                {
                  type: 'text',
                  text: `Analyze this image uploaded for a sales/customer relationship context. Extract ALL text visible in the image. If this is a field map, document, contract, invoice, or handwritten notes, transcribe everything you can see.

Then provide:
1. A suggested document type (one of: field_map, contract, invoice, agronomic_report, notes, proposal, correspondence, other)
2. A suggested title based on the content
3. A 2-3 sentence summary of what this document contains

Format your response as JSON:
{
  "extracted_text": "all text found in the image...",
  "document_type": "field_map",
  "title": "Suggested Title",
  "summary": "Brief summary..."
}`
                }
              ]
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      
      try {
        // Try to parse as JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          extractedText = parsed.extracted_text || content;
          documentType = parsed.document_type || 'other';
          title = parsed.title || title;
          summary = parsed.summary || '';
        } else {
          extractedText = content;
        }
      } catch {
        extractedText = content;
      }

    } else if (isPdf || isOfficeDoc) {
      // For PDFs and Office docs, convert to base64 and use document extraction
      const base64 = arrayBufferToBase64(await fileData.arrayBuffer());

      // Use Gemini's document understanding capabilities
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  file: {
                    filename: doc.file_name,
                    file_data: `data:${doc.file_type};base64,${base64}`
                  }
                },
                {
                  type: 'text',
                  text: `Extract all text content from this document uploaded for a sales/customer relationship context. This could be a contract, proposal, agronomic report, invoice, or other business document.

Provide:
1. The full extracted text content
2. A suggested document type (one of: field_map, contract, invoice, agronomic_report, notes, proposal, correspondence, product_catalog, other)
3. A suggested title based on the content
4. A 2-3 sentence summary of what this document contains

Format your response as JSON:
{
  "extracted_text": "full document text...",
  "document_type": "contract",
  "title": "Suggested Title",
  "summary": "Brief summary..."
}`
                }
              ]
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          extractedText = parsed.extracted_text || content;
          documentType = parsed.document_type || 'other';
          title = parsed.title || title;
          summary = parsed.summary || '';
        } else {
          extractedText = content;
        }
      } catch {
        extractedText = content;
      }

    } else {
      // For text files, just read directly
      extractedText = await fileData.text();
      
      // Generate summary with AI
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: `Analyze this document content uploaded for a sales/customer relationship context:

${extractedText.substring(0, 10000)}

Provide a JSON response with:
{
  "document_type": "one of: field_map, contract, invoice, agronomic_report, notes, proposal, correspondence, product_catalog, other",
  "title": "Suggested title",
  "summary": "2-3 sentence summary"
}`
            }
          ],
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            documentType = parsed.document_type || 'other';
            title = parsed.title || title;
            summary = parsed.summary || '';
          }
        } catch {
          // Keep defaults
        }
      }
    }

    // Update the document with extracted content
    const { error: updateError } = await supabase
      .from('customer_documents')
      .update({
        extracted_text: extractedText.substring(0, 100000), // Limit size
        extraction_status: 'completed',
        document_type: documentType,
        title: title,
        summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    console.log(`Document extraction completed: ${documentId}`);

    return new Response(JSON.stringify({ 
      success: true,
      documentId,
      title,
      summary,
      documentType,
      textLength: extractedText.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error extracting document:', error);
    
    // Try to update the document status to failed
    try {
      const { documentId } = await (async () => {
        try {
          return await (error as any).request?.json() || {};
        } catch {
          return {};
        }
      })();
      
      if (documentId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('customer_documents')
          .update({ 
            extraction_status: 'failed',
            extraction_error: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', documentId);
      }
    } catch {
      // Ignore cleanup errors
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
