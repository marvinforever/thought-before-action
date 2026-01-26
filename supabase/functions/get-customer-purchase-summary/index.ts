import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`);

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// Normalize company name for matching
function normalizeNameForSearch(name: string): { searchTerms: string[]; lastName: string; firstName: string } {
  // Remove common suffixes
  const suffixes = /\s*(Bros\.?|Brothers|Farms?|Inc\.?|LLC|Co\.?|Company|Corp\.?|& Sons?|and Sons?)$/gi;
  let cleaned = name.replace(suffixes, '').trim();
  
  // Remove punctuation and extra spaces
  cleaned = cleaned.replace(/[,']/g, ' ').replace(/\s+/g, ' ').trim();
  
  const parts = cleaned.split(' ').filter(Boolean);
  
  // For single word names (like "Zierke Bros"), just use that word
  if (parts.length === 1) {
    return {
      searchTerms: [parts[0].toUpperCase()],
      lastName: parts[0].toUpperCase(),
      firstName: '',
    };
  }
  
  // For "First Last" format, extract both
  const firstName = parts[0].toUpperCase();
  const lastName = parts[parts.length - 1].toUpperCase();
  
  return {
    searchTerms: [lastName, firstName].filter(Boolean),
    lastName,
    firstName,
  };
}

interface PurchaseSummary {
  customerName: string;
  matchedNames: string[];
  totalRevenue: number;
  transactionCount: number;
  topProducts: { name: string; total: number; count: number }[];
  seasons: string[];
  lastPurchaseDate: string | null;
  hasHistory: boolean;
}

async function fetchPurchaseSummary(
  supabase: any,
  companyId: string,
  customerName: string
): Promise<PurchaseSummary> {
  const { searchTerms, lastName, firstName } = normalizeNameForSearch(customerName);
  
  console.log(`[purchase-summary] Searching for: "${customerName}" -> terms: [${searchTerms.join(', ')}]`);
  
  // Start with lastName search (broadest)
  const lastLike = `%${escapeLike(lastName)}%`;
  
  const pageSize = 1000;
  let from = 0;
  const rows: any[] = [];
  
  while (true) {
    let q = supabase
      .from('customer_purchase_history')
      .select('customer_name, amount, product_description, sale_date, season')
      .eq('company_id', companyId)
      .ilike('customer_name', lastLike);
    
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    // Narrow down client-side to ensure firstName is also present when provided
    const filtered = firstName
      ? data.filter((r: any) => String(r.customer_name || '').toUpperCase().includes(firstName))
      : data;
    
    rows.push(...filtered);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  if (rows.length === 0) {
    return {
      customerName,
      matchedNames: [],
      totalRevenue: 0,
      transactionCount: 0,
      topProducts: [],
      seasons: [],
      lastPurchaseDate: null,
      hasHistory: false,
    };
  }
  
  // Aggregate data
  const matchedNames = Array.from(new Set(rows.map(r => r.customer_name).filter(Boolean)));
  const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  
  // Aggregate by product
  const byProduct = new Map<string, { total: number; count: number }>();
  const seasonsSet = new Set<string>();
  let lastPurchaseDate: string | null = null;
  
  for (const r of rows) {
    const p = r.product_description || 'Unknown product';
    const amt = Number(r.amount) || 0;
    const cur = byProduct.get(p) || { total: 0, count: 0 };
    cur.total += amt;
    cur.count += 1;
    byProduct.set(p, cur);
    
    if (r.season) seasonsSet.add(r.season);
    if (r.sale_date && (!lastPurchaseDate || r.sale_date > lastPurchaseDate)) {
      lastPurchaseDate = r.sale_date;
    }
  }
  
  const topProducts = Array.from(byProduct.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, data]) => ({ name, total: data.total, count: data.count }));
  
  return {
    customerName,
    matchedNames,
    totalRevenue,
    transactionCount: rows.length,
    topProducts,
    seasons: Array.from(seasonsSet).sort(),
    lastPurchaseDate,
    hasHistory: true,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const { customerName, companyId: requestedCompanyId } = await req.json();
    
    if (!customerName) {
      return new Response(
        JSON.stringify({ error: 'customerName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
    
    // Check super admin for view-as
    let effectiveCompanyId = profile?.company_id;
    
    const { data: isSuperAdmin } = await supabase.rpc('has_role', { 
      _user_id: user.id, 
      _role: 'super_admin' 
    });
    
    if (isSuperAdmin && requestedCompanyId) {
      effectiveCompanyId = requestedCompanyId;
    }

    if (!effectiveCompanyId) {
      return new Response(
        JSON.stringify({ error: 'No company found for user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const summary = await fetchPurchaseSummary(supabase, effectiveCompanyId, customerName);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-customer-purchase-summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
