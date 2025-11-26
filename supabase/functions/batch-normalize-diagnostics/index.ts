import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    console.log('Starting batch normalization of all diagnostics...');
    
    // Get all diagnostic responses that don't have scores yet
    const { data: diagnostics, error: fetchError } = await supabase
      .from('diagnostic_responses')
      .select('id, profile_id')
      .order('created_at', { ascending: false });
      
    if (fetchError) {
      console.error('Error fetching diagnostics:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${diagnostics?.length || 0} diagnostics to process`);
    
    const results = {
      total: diagnostics?.length || 0,
      processed: 0,
      failed: 0,
      errors: [] as any[]
    };
    
    // Process each diagnostic
    for (const diagnostic of diagnostics || []) {
      try {
        // Check if already normalized
        const { data: existing } = await supabase
          .from('diagnostic_scores')
          .select('id')
          .eq('profile_id', diagnostic.profile_id)
          .single();
          
        if (existing) {
          console.log(`Skipping ${diagnostic.profile_id} - already normalized`);
          results.processed++;
          continue;
        }
        
        // Call normalization function
        const response = await supabase.functions.invoke('normalize-diagnostic-scores', {
          body: { 
            diagnosticId: diagnostic.id,
            batchMode: true 
          }
        });
        
        if (response.error) {
          console.error(`Failed to normalize ${diagnostic.id}:`, response.error);
          results.failed++;
          results.errors.push({
            diagnostic_id: diagnostic.id,
            error: response.error.message
          });
        } else {
          console.log(`Successfully normalized ${diagnostic.id}`);
          results.processed++;
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error processing ${diagnostic.id}:`, error);
        results.failed++;
        results.errors.push({
          diagnostic_id: diagnostic.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log('Batch normalization complete:', results);
    
    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Batch normalization error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});