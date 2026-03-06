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
    
    const { forceAll } = await req.json().catch(() => ({ forceAll: false }));

    // Process each diagnostic
    for (const diagnostic of diagnostics || []) {
      try {
        // Check if already normalized (skip unless forceAll or has zero scores)
        const { data: existing } = await supabase
          .from('diagnostic_scores')
          .select('id, clarity_score, career_score, learning_score')
          .eq('profile_id', diagnostic.profile_id)
          .single();
          
        const hasZeros = existing && (
          existing.clarity_score === 0 || existing.career_score === 0 || existing.learning_score === 0
        );
        
        if (existing && !hasZeros && !forceAll) {
          console.log(`Skipping ${diagnostic.profile_id} - already normalized with valid scores`);
          results.processed++;
          continue;
        }
        
        if (hasZeros) {
          console.log(`Re-processing ${diagnostic.profile_id} - has zero scores that need fixing`);
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