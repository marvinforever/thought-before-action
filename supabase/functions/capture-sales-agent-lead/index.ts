import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Your profile ID to receive leads as deals
const OWNER_PROFILE_ID = "0193b955-069e-76da-9a70-b2cc356860c8";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, companyName, role } = await req.json();

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get owner's company_id
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', OWNER_PROFILE_ID)
      .single();

    if (!ownerProfile?.company_id) {
      throw new Error('Owner profile not found');
    }

    // Create a deal in the owner's account
    const dealName = companyName ? `${name} - ${companyName}` : name;
    const roleLabels: Record<string, string> = {
      vp_sales: 'VP of Sales',
      vp_agronomy: 'VP of Agronomy',
      ceo: 'CEO / Owner',
      sales_manager: 'Sales Manager',
      sales_agent: 'Sales Agent',
      agronomist: 'Agronomist',
      sales_rep: 'Sales Representative',
      other: 'Other'
    };

    const notes = [
      `🚀 Lead from Jericho Sales Agent landing page`,
      `📧 Email: ${email}`,
      role ? `👤 Role: ${roleLabels[role] || role}` : null,
      companyName ? `🏢 Company: ${companyName}` : null,
      `📅 Submitted: ${new Date().toLocaleDateString()}`
    ].filter(Boolean).join('\n');

    const { data: deal, error: dealError } = await supabase
      .from('sales_deals')
      .insert({
        profile_id: OWNER_PROFILE_ID,
        company_id: ownerProfile.company_id,
        deal_name: dealName,
        stage: 'prospecting',
        priority: 3,
        notes,
        contact_name: name,
        contact_email: email
      })
      .select()
      .single();

    if (dealError) {
      console.error('Error creating deal:', dealError);
      throw dealError;
    }

    console.log('Lead captured and deal created:', deal.id);

    return new Response(
      JSON.stringify({ success: true, dealId: deal.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in capture-sales-agent-lead:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
