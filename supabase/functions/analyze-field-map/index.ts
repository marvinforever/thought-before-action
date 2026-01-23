import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, imageType, mapType, fieldName, customerContext } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build context-aware prompt
    const customerInfo = customerContext 
      ? `\n\nCUSTOMER CONTEXT:
- Customer Name: ${customerContext.name || 'Unknown'}
- Location: ${customerContext.location || 'Unknown'}
- Operation Details: ${customerContext.operationDetails ? JSON.stringify(customerContext.operationDetails) : 'Not available'}
- Crops: ${customerContext.crops || 'Not specified'}
- Total Acres: ${customerContext.totalAcres || 'Unknown'}`
      : '';

    const mapTypeContext = mapType 
      ? `\nMAP TYPE: ${mapType.replace('_', ' ').toUpperCase()}`
      : '';

    const fieldContext = fieldName 
      ? `\nFIELD NAME: ${fieldName}`
      : '';

    const systemPrompt = `You are an expert agricultural consultant and sales analyst specializing in precision agriculture, crop management, and agricultural product recommendations. Your task is to analyze field maps, yield maps, and agricultural imagery to identify sales opportunities for agricultural products and services.

ANALYSIS FRAMEWORK:
1. **Visual Analysis**: Identify patterns, zones, and anomalies in the map
2. **Agronomic Interpretation**: What do these patterns mean for crop health/yield?
3. **Root Cause Analysis**: What might be causing any issues observed?
4. **Product Opportunities**: What products/services could address these issues?
5. **Conversation Starters**: How can a salesperson bring this up naturally?

PRODUCT CATEGORIES TO CONSIDER:
- Seed varieties (drought-tolerant, disease-resistant, high-yield)
- Fertilizers and nutrients (nitrogen, phosphorus, potassium, micronutrients)
- Crop protection (fungicides, herbicides, insecticides)
- Seed treatments (disease protection, insect protection, biologicals)
- Biologicals and biostimulants
- Precision ag services (variable rate application, soil sampling)
- Cover crops and soil health products
- Adjuvants and water management products

OUTPUT FORMAT:
Provide your analysis in a structured format with clear sections for:
1. Map Overview - What type of map is this and what does it show?
2. Key Observations - List 3-5 specific patterns or areas of interest
3. Agronomic Insights - What these observations mean for the operation
4. Sales Opportunities - Specific product recommendations with reasoning
5. Talking Points - Natural conversation starters for a sales call`;

    const userPrompt = `Analyze this agricultural field map and identify sales opportunities.${mapTypeContext}${fieldContext}${customerInfo}

Please provide:
1. A description of what you see in the map
2. Key observations about field variability, problem areas, or patterns
3. Specific product/service recommendations based on your analysis
4. Natural talking points a salesperson could use to discuss these insights

Focus on actionable sales opportunities and practical recommendations.`;

    // Use Gemini 2.5 Pro for best vision analysis
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${imageType || 'image/png'};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI analysis error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content || '';

    // Extract structured insights from the analysis
    const opportunities: string[] = [];
    const lines = analysisText.split('\n');
    let inOpportunities = false;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('sales opportunit') || line.toLowerCase().includes('product recommend')) {
        inOpportunities = true;
        continue;
      }
      if (inOpportunities && line.startsWith('-')) {
        opportunities.push(line.replace(/^-\s*/, '').trim());
      }
      if (inOpportunities && (line.toLowerCase().includes('talking point') || line.startsWith('#'))) {
        inOpportunities = false;
      }
    }

    // Create structured result
    const analysisResult = {
      overview: extractSection(analysisText, 'overview', 'observation'),
      observations: extractSection(analysisText, 'observation', 'insight'),
      insights: extractSection(analysisText, 'insight', 'opportunit'),
      opportunities: extractSection(analysisText, 'opportunit', 'talking'),
      talkingPoints: extractSection(analysisText, 'talking', null),
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysisText,
        structured: analysisResult,
        opportunities: opportunities.length > 0 ? opportunities : extractOpportunityList(analysisText),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-field-map:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to extract sections from the analysis text
function extractSection(text: string, startKeyword: string, endKeyword: string | null): string {
  const lines = text.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes(startKeyword)) {
      inSection = true;
      continue;
    }
    
    if (inSection && endKeyword && lowerLine.includes(endKeyword)) {
      break;
    }
    
    if (inSection) {
      sectionLines.push(line);
    }
  }
  
  return sectionLines.join('\n').trim();
}

// Extract opportunity suggestions as a list
function extractOpportunityList(text: string): string[] {
  const opportunities: string[] = [];
  const patterns = [
    /recommend\s+(?:considering|using|applying)?\s*([^.]+)/gi,
    /opportunity\s+(?:to|for)\s+([^.]+)/gi,
    /could benefit from\s+([^.]+)/gi,
    /suggest\s+(?:considering|using)?\s*([^.]+)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].length > 10 && match[1].length < 200) {
        opportunities.push(match[1].trim());
      }
    }
  }
  
  return [...new Set(opportunities)].slice(0, 5);
}
