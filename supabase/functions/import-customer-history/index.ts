import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVRow {
  customer_code: string;
  customer_name: string;
  product_description: string;
  sale_date: string;
  quantity: string;
  amount: string;
  avg_price: string;
  unit_of_measure: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  product_code: string;
  epa_number: string;
  rep_name: string;
  season: string;
  sort_category: string;
  bonus_category: string;
  bonus_amount: string;
  category_11_4: string;
  quantity_11_4: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { csvData, companyId, sourceFile } = await req.json();

    if (!csvData || !Array.isArray(csvData)) {
      throw new Error('Invalid CSV data format - expected array');
    }

    if (!companyId) {
      throw new Error('Company ID is required');
    }

    const results = {
      success: 0,
      errors: 0,
      errorDetails: [] as string[]
    };

    // Process in batches of 500
    const BATCH_SIZE = 500;
    const batches = [];
    
    for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
      batches.push(csvData.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const rows = batch.map((row: CSVRow) => {
        // Parse sale date
        let saleDate = null;
        if (row.sale_date) {
          try {
            // Handle various date formats
            const dateStr = row.sale_date.trim();
            if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                const month = parts[0].padStart(2, '0');
                const day = parts[1].padStart(2, '0');
                const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                saleDate = `${year}-${month}-${day}`;
              }
            } else if (dateStr.includes('-')) {
              saleDate = dateStr;
            }
          } catch (e) {
            console.log('Date parse error for:', row.sale_date);
          }
        }

        // Parse numeric values
        const parseNumber = (val: string): number | null => {
          if (!val || val.trim() === '') return null;
          const cleaned = val.replace(/[$,]/g, '').trim();
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        };

        return {
          company_id: companyId,
          customer_code: row.customer_code?.trim() || null,
          customer_name: row.customer_name?.trim() || 'Unknown',
          product_description: row.product_description?.trim() || null,
          sale_date: saleDate,
          quantity: parseNumber(row.quantity),
          amount: parseNumber(row.amount),
          avg_price: parseNumber(row.avg_price),
          unit_of_measure: row.unit_of_measure?.trim() || null,
          address_1: row.address_1?.trim() || null,
          address_2: row.address_2?.trim() || null,
          city: row.city?.trim() || null,
          state: row.state?.trim() || null,
          zip_code: row.zip_code?.trim() || null,
          phone: row.phone?.trim() || null,
          product_code: row.product_code?.trim() || null,
          epa_number: row.epa_number?.trim() || null,
          rep_name: row.rep_name?.trim() || null,
          season: row.season?.trim() || null,
          sort_category: row.sort_category?.trim() || null,
          bonus_category: row.bonus_category?.trim() || null,
          bonus_amount: parseNumber(row.bonus_amount),
          category_11_4: row.category_11_4?.trim() || null,
          quantity_11_4: parseNumber(row.quantity_11_4),
          source_file: sourceFile || null
        };
      });

      const { error } = await supabase
        .from('customer_purchase_history')
        .insert(rows);

      if (error) {
        console.error('Batch insert error:', error);
        results.errors += batch.length;
        results.errorDetails.push(error.message);
      } else {
        results.success += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: results.success,
        errors: results.errors,
        errorDetails: results.errorDetails.slice(0, 5) // Limit error details
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
