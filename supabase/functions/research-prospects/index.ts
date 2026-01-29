import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchRequest {
  companies?: string[];        // List of company names to research
  icp?: string;               // ICP description for discovery mode
  profileId: string;          // User's profile ID for company creation
  limit?: number;             // Max results (default 10)
}

interface ResearchedCompany {
  name: string;
  industry?: string;
  location?: string;
  revenue_estimate?: string;
  employee_count?: string;
  description?: string;
  website?: string;
  key_contacts?: string;
  icp_fit_score?: number;
  citations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Perplexity API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const { companies, icp, profileId, limit = 10 } = await req.json() as ResearchRequest;

    if (!companies?.length && !icp) {
      return new Response(
        JSON.stringify({ error: 'Either companies list or ICP description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: 'Profile ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with auth context
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing companies to avoid duplicates
    const { data: existingCompanies } = await supabase
      .from('sales_companies')
      .select('name')
      .eq('profile_id', profileId);

    const existingNames = new Set(
      (existingCompanies || []).map(c => c.name.toLowerCase().trim())
    );

    console.log(`Research request - mode: ${icp ? 'ICP discovery' : 'named companies'}, existing: ${existingNames.size}`);

    // Build the Perplexity prompt based on mode
    let searchPrompt: string;
    let systemPrompt: string;

    if (companies?.length) {
      // Named company research mode
      searchPrompt = `Research these companies and provide detailed business information for each:
${companies.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each company, find:
- Official company name
- Industry/sector
- Headquarters location (city, state)
- Estimated annual revenue
- Approximate employee count
- Brief business description
- Website URL
- Key decision makers or contacts if available`;

      systemPrompt = `You are a business research assistant. Research the provided companies and return ACCURATE, VERIFIED information with citations. 

CRITICAL: Return your response as valid JSON with this exact structure:
{
  "companies": [
    {
      "name": "Company Name",
      "industry": "Industry/Sector",
      "location": "City, State",
      "revenue_estimate": "$X million" or "$X billion" or "Unknown",
      "employee_count": "Approximate number or range",
      "description": "1-2 sentence description of what they do",
      "website": "https://...",
      "key_contacts": "CEO: Name, etc. or null",
      "citations": ["https://source1.com", "https://source2.com"]
    }
  ],
  "not_found": ["Company names that couldn't be found"]
}

If you cannot find reliable information about a company, include it in the "not_found" array instead.
Only return companies with high confidence information backed by citations.`;
    } else {
      // ICP discovery mode
      searchPrompt = `Find ${Math.min(limit, 15)} real companies that match this ideal customer profile:

"${icp}"

For each company, provide:
- Official company name
- Industry/sector  
- Headquarters location (city, state)
- Estimated annual revenue
- Approximate employee count
- Brief business description
- Website URL
- Why they match the ICP (fit score 1-100)

Focus on finding REAL, VERIFIABLE companies with accurate business information.`;

      systemPrompt = `You are a B2B prospect researcher. Find REAL companies matching the provided Ideal Customer Profile (ICP). 

CRITICAL: Return your response as valid JSON with this exact structure:
{
  "companies": [
    {
      "name": "Company Name",
      "industry": "Industry/Sector",
      "location": "City, State",
      "revenue_estimate": "$X million" or "$X billion",
      "employee_count": "Approximate number or range",
      "description": "1-2 sentence description",
      "website": "https://...",
      "icp_fit_score": 85,
      "icp_fit_reason": "Why this company matches the ICP",
      "citations": ["https://source1.com", "https://source2.com"]
    }
  ]
}

REQUIREMENTS:
- Only include companies you can verify exist with real citations
- Prioritize companies with highest ICP fit scores
- Include diverse companies, not just the largest/most famous
- Each company must have at least one citation source`;
    }

    console.log('Calling Perplexity API for prospect research...');

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: searchPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('Perplexity API error:', perplexityResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to research prospects. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content || '';
    const citations = perplexityData.citations || [];

    console.log('Perplexity response received, parsing...');

    // Parse the JSON response
    let researchedCompanies: ResearchedCompany[] = [];
    let notFound: string[] = [];

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // Try to find JSON object directly
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          jsonStr = objMatch[0];
        }
      }

      const parsed = JSON.parse(jsonStr);
      researchedCompanies = parsed.companies || [];
      notFound = parsed.not_found || [];

      // Add global citations to companies that don't have any
      researchedCompanies = researchedCompanies.map(company => ({
        ...company,
        citations: company.citations?.length ? company.citations : citations.slice(0, 2)
      }));

    } catch (parseError) {
      console.error('Failed to parse Perplexity response as JSON:', parseError);
      console.log('Raw content:', content.substring(0, 500));
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse research results. Please try a more specific query.',
          rawContent: content.substring(0, 1000)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out duplicates and create companies
    const companiesCreated: any[] = [];
    const companiesSkipped: string[] = [];

    for (const company of researchedCompanies) {
      const normalizedName = company.name.toLowerCase().trim();
      
      if (existingNames.has(normalizedName)) {
        companiesSkipped.push(company.name);
        console.log(`Skipping duplicate: ${company.name}`);
        continue;
      }

      // Build notes from researched data
      const notes = [
        company.description,
        company.revenue_estimate ? `Revenue: ${company.revenue_estimate}` : null,
        company.employee_count ? `Employees: ${company.employee_count}` : null,
        company.key_contacts ? `Contacts: ${company.key_contacts}` : null,
        company.icp_fit_score ? `ICP Fit: ${company.icp_fit_score}%` : null,
      ].filter(Boolean).join('\n');

      try {
        const { data: newCompany, error: insertError } = await supabase
          .from('sales_companies')
          .insert({
            name: company.name,
            profile_id: profileId,
            location: company.location || null,
            website: company.website || null,
            notes: notes || null,
            source: 'ai_research',
            research_citations: company.citations,
            research_date: new Date().toISOString(),
          })
          .select('id, name')
          .single();

        if (insertError) {
          console.error(`Failed to create company ${company.name}:`, insertError);
          companiesSkipped.push(company.name);
        } else {
          companiesCreated.push({
            ...company,
            id: newCompany.id,
            dbName: newCompany.name
          });
          existingNames.add(normalizedName);
          console.log(`Created company: ${company.name}`);
        }
      } catch (dbError) {
        console.error(`DB error for ${company.name}:`, dbError);
        companiesSkipped.push(company.name);
      }
    }

    console.log(`Research complete: ${companiesCreated.length} created, ${companiesSkipped.length} skipped, ${notFound.length} not found`);

    return new Response(
      JSON.stringify({
        success: true,
        companiesCreated,
        companiesSkipped,
        notFound,
        totalResearched: researchedCompanies.length,
        mode: icp ? 'icp_discovery' : 'named_research',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Research prospects error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
