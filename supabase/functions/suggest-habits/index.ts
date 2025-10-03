import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error("user_id is required");
    }

    // Get user profile and context
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, role")
      .eq("id", user_id)
      .single();

    // Get user's capabilities
    const { data: capabilities } = await supabaseClient
      .from("employee_capabilities")
      .select(`
        current_level,
        target_level,
        capability:capabilities(name, description)
      `)
      .eq("profile_id", user_id)
      .limit(5);

    // Get user's 90-day goals
    const { data: goals } = await supabaseClient
      .from("ninety_day_targets")
      .select("goal_text, category, by_when")
      .eq("profile_id", user_id)
      .eq("completed", false)
      .limit(3);

    // Get existing habits to avoid duplicates
    const { data: existingHabits } = await supabaseClient
      .from("leading_indicators")
      .select("habit_name")
      .eq("profile_id", user_id)
      .eq("is_active", true);

    // Build context for AI
    const contextPrompt = `
You are a Kaizen-focused personal development coach helping ${profile?.full_name || "an employee"} build micro-habits.

KAIZEN PHILOSOPHY RULES:
1. Habits must be RIDICULOUSLY SMALL and achievable daily (e.g., "Read 10 pages", "Write 200 words", not "Read 30 minutes")
2. Focus on consistency over intensity - habits should be easy to do every single day
3. Stack on existing routines when possible
4. "Never miss twice" - the goal is building unbreakable streaks
5. Small daily actions compound into extraordinary yearly results (10 pages/day = 12 books/year)

USER CONTEXT:
- Role: ${profile?.role || "Not specified"}
- Top Capabilities Being Developed: ${capabilities?.map((c: any) => c.capability?.name).join(", ") || "None yet"}
- Active 90-Day Goals: ${goals?.map(g => g.goal_text).join("; ") || "None yet"}
- Existing Habits: ${existingHabits?.map(h => h.habit_name).join(", ") || "None yet"}

Generate 3-5 Kaizen micro-habits that:
- Are specific, measurable, and can be completed in 5-15 minutes
- Support their capability development or 90-day goals
- Don't duplicate existing habits
- Follow the Kaizen philosophy strictly

Return ONLY valid JSON in this exact format:
{
  "suggestions": [
    {
      "habit_name": "Read 10 pages from a leadership book",
      "habit_description": "Daily reading builds strategic thinking and leadership capabilities",
      "reasoning": "Supports your strategic thinking capability development. 10 pages = ~15 mins and compounds to 12+ books per year."
    }
  ]
}`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a Kaizen personal development coach. Always respond with valid JSON only, no other text.",
            },
            {
              role: "user",
              content: contextPrompt,
            },
          ],
          temperature: 0.8,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error("AI API request failed");
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content;

    if (!generatedText) {
      throw new Error("No response from AI");
    }

    // Parse AI response
    let suggestions;
    try {
      // Try to extract JSON from the response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions;
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Raw response:", generatedText);
      throw new Error("Failed to parse AI suggestions");
    }

    return new Response(
      JSON.stringify({ suggestions }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in suggest-habits function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
