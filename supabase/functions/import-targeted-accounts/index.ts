import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded rep-to-profile mapping for Stateline
const REP_PROFILE_MAP: Record<string, string> = {
  "christian o'banion": "db6e428d-380f-483a-a259-55b622580a79",
  "joel loseke": "eac605a2-c833-4597-a5c2-cc6e6e5d4e03",
  "ed lehman": "c4e346de-156d-4410-bfcf-ce11d0ac4e6b",
  "kally windschitl": "30b712c0-ad7a-4e1a-bb06-010a1ec9cfee",
  "kelli barnett": "0fae7e33-0a6e-4689-ad65-9e0cb758f6c7",
  "clay mogard": "5ddb139c-4453-4bb4-ad89-9fd7266ec13b",
  "ben borchardt": "2d69e5f5-d964-4bb0-9bca-55bcfba93850",
  "blake miller": "176bee82-5595-4941-956a-52ff8ff0eb90",
  "trevor kluver": "ab3d266a-bd68-4c35-b441-f5e6c7d9fa1b",
};

interface TargetedAccountRow {
  seller: string;
  farmer_name: string;
  estimated_acres: string;
  type_of_customer: string;
  primary_growth_category: string;
  secondary_growth_category: string;
  third_growth_category: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { csvData, companyId } = await req.json() as { csvData: TargetedAccountRow[]; companyId: string };

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No CSV data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Company ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${csvData.length} targeted accounts for company ${companyId}`);

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      unmatchedSellers: new Set<string>(),
    };

    for (const row of csvData) {
      try {
        // Normalize seller name for lookup
        const sellerKey = row.seller?.trim().toLowerCase();
        const profileId = REP_PROFILE_MAP[sellerKey];

        if (!profileId) {
          results.unmatchedSellers.add(row.seller || 'Unknown');
          results.skipped++;
          continue;
        }

        const farmerName = row.farmer_name?.trim();
        if (!farmerName) {
          results.errors.push(`Row missing farmer name`);
          continue;
        }

        // Parse customer type
        let customerType = row.type_of_customer?.trim().toLowerCase();
        if (customerType?.includes('prospect')) {
          customerType = 'prospect';
        } else if (customerType?.includes('current') || customerType?.includes('customer')) {
          customerType = 'current_customer';
        } else {
          customerType = 'prospect'; // Default to prospect
        }

        // Parse acres
        const estimatedAcres = parseInt(row.estimated_acres?.replace(/,/g, ''), 10) || null;

        // Build target categories
        const targetCategories: Record<string, string> = {};
        if (row.primary_growth_category?.trim()) {
          targetCategories.primary = row.primary_growth_category.trim();
        }
        if (row.secondary_growth_category?.trim()) {
          targetCategories.secondary = row.secondary_growth_category.trim();
        }
        if (row.third_growth_category?.trim()) {
          targetCategories.tertiary = row.third_growth_category.trim();
        }

        // Check for existing company or create one
        let companyRecordId: string | null = null;
        const { data: existingCompany } = await supabase
          .from('sales_companies')
          .select('id')
          .eq('profile_id', profileId)
          .ilike('name', farmerName)
          .maybeSingle();

        if (existingCompany) {
          companyRecordId = existingCompany.id;
        } else {
          // Create new company
          const { data: newCompany, error: companyError } = await supabase
            .from('sales_companies')
            .insert({
              profile_id: profileId,
              name: farmerName,
              operation_details: estimatedAcres ? { total_acres: estimatedAcres } : null,
            })
            .select('id')
            .single();

          if (companyError) {
            console.error(`Error creating company for ${farmerName}:`, companyError);
            results.errors.push(`Failed to create company for ${farmerName}: ${companyError.message}`);
            continue;
          }
          companyRecordId = newCompany.id;
        }

        // Check for existing deal with same farmer name for this rep
        const dealName = `${farmerName} - 2026 Growth Target`;
        const { data: existingDeal } = await supabase
          .from('sales_deals')
          .select('id')
          .eq('profile_id', profileId)
          .ilike('deal_name', dealName)
          .maybeSingle();

        if (existingDeal) {
          // Update existing deal with new data
          const { error: updateError } = await supabase
            .from('sales_deals')
            .update({
              estimated_acres: estimatedAcres,
              customer_type: customerType,
              target_categories: Object.keys(targetCategories).length > 0 ? targetCategories : null,
              notes: row.notes?.trim() || null,
              company_id: companyRecordId,
            })
            .eq('id', existingDeal.id);

          if (updateError) {
            results.errors.push(`Failed to update deal for ${farmerName}: ${updateError.message}`);
            continue;
          }
        } else {
          // Create new deal
          const stage = customerType === 'prospect' ? 'prospecting' : 'discovery';
          
          const { error: dealError } = await supabase
            .from('sales_deals')
            .insert({
              profile_id: profileId,
              deal_name: dealName,
              stage: stage,
              company_id: companyRecordId,
              estimated_acres: estimatedAcres,
              customer_type: customerType,
              target_categories: Object.keys(targetCategories).length > 0 ? targetCategories : null,
              notes: row.notes?.trim() || null,
              priority: 2, // Medium-high priority for targeted accounts
            });

          if (dealError) {
            console.error(`Error creating deal for ${farmerName}:`, dealError);
            results.errors.push(`Failed to create deal for ${farmerName}: ${dealError.message}`);
            continue;
          }
        }

        results.imported++;
      } catch (rowError: any) {
        console.error(`Error processing row:`, rowError);
        results.errors.push(rowError.message || 'Unknown error');
      }
    }

    console.log(`Import complete: ${results.imported} imported, ${results.skipped} skipped, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify({
        imported: results.imported,
        skipped: results.skipped,
        errors: results.errors.length,
        errorDetails: results.errors.slice(0, 10),
        unmatchedSellers: Array.from(results.unmatchedSellers),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
